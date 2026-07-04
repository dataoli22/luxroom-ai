import { EventEmitter } from 'events';
import { CronJob } from 'cron';
import { getSettings } from './settings.js';
import { crawlAll } from './modules/discovery/crawler.js';
import { extractListing } from './modules/extraction/extractor.js';
import { analyseListing } from './modules/analysis/analyser.js';
import { scoreOpportunity } from './modules/opportunity/scorer.js';
import { notifyAll } from './modules/notifications/notifier.js';
import { generateDraft } from './modules/messaging/messenger.js';
import { initDb, upsertListing, saveDraft } from './db/database.js';

export const logEmitter      = new EventEmitter();
export const approvalsEmitter = new EventEmitter();
export const scanEmitter      = new EventEmitter();

function log(msg) {
  console.log(msg);
  logEmitter.emit('log', msg);
}

function logError(msg, err) {
  console.error(msg, err);
  logEmitter.emit('log', `${msg} ${err?.message ?? err}`);
}

let _running = false;
let _lastCrawl = null;
let _listingCount = 0;
let _scanCycles = 0;
let _job = null;

export function getPipelineStatus() {
  return { running: _running, lastCrawl: _lastCrawl, listingCount: _listingCount, scanCycles: _scanCycles };
}

export async function processNewListings() {
  const config = getSettings();
  const OPPORTUNITY_THRESHOLD = config.OPPORTUNITY_THRESHOLD != null
    ? Number(config.OPPORTUNITY_THRESHOLD)
    : 0.7;

  _running = true;
  let _savedThisCycle = 0;
  log(`[pipeline] Starting crawl — ${new Date().toISOString()}`);

  let rawRecords;
  try {
    rawRecords = await crawlAll();
  } catch (err) {
    logError('[pipeline] crawlAll() failed:', err);
    _running = false;
    return;
  }

  log(`[pipeline] Crawled ${rawRecords.length} raw record(s)`);

  for (let i = 0; i < rawRecords.length; i++) {
    const rawRecord = rawRecords[i];
    const label = rawRecord.url ?? `record[${i}]`;

    log(`[pipeline] Processing (${i + 1}/${rawRecords.length}): ${label}`);

    // Step a: extract
    let extracted;
    try {
      extracted = await extractListing(rawRecord);
    } catch (err) {
      logError(`[pipeline] extractListing() threw for ${label}:`, err);
      continue;
    }

    // Step b: skip if null
    if (extracted == null) {
      log(`[pipeline] Extraction returned null for ${label} — skipping`);
      continue;
    }

    // Step c: analyse
    let analysed;
    try {
      analysed = await analyseListing(extracted);
    } catch (err) {
      logError(`[pipeline] analyseListing() threw for ${label}:`, err);
      continue;
    }

    // Step d: skip if null
    if (analysed == null) {
      log(`[pipeline] Analysis returned null for ${label} — skipping`);
      continue;
    }

    // Step e: score — analyser outputs `score`, scorer expects `housingScore`
    const analysedWithHousingScore = { ...analysed, housingScore: analysed.score ?? 0 };
    let scores;
    try {
      scores = await scoreOpportunity(analysedWithHousingScore);
    } catch (err) {
      logError(`[pipeline] scoreOpportunity() threw for ${label}:`, err);
      continue;
    }

    // Step f: build full ListingRecord
    const record = {
      ...rawRecord,
      ...extracted,
      ...analysed,
      housingScore: analysed.score ?? 0,
      ...scores,
      id: Date.now(),
    };

    // Step g: persist
    try {
      await upsertListing(record);
      _listingCount++;
      _savedThisCycle++;
    } catch (err) {
      logError(`[pipeline] upsertListing() threw for ${label}:`, err);
      continue;
    }

    // Step h: desktop ping for every new STRONG or CONSIDER listing
    if (record.verdict === 'STRONG' || record.verdict === 'CONSIDER') {
      try {
        const { notifyDesktop } = await import('./modules/notifications/notifier.js');
        notifyDesktop(record).catch(() => {});
      } catch {}
    }

    // Step i: full notification + draft path for high-opportunity listings
    if (record.opportunityScore != null && record.opportunityScore > OPPORTUNITY_THRESHOLD) {
      log(`[pipeline] High opportunity listing found: ${record.location ?? label} score ${record.opportunityScore}`);

      // Generate draft first so email can embed approve/discard buttons with the real draftId
      let savedDraft = null;
      try {
        const draft = await generateDraft(record, 'introduction');
        savedDraft = await saveDraft(record.url, draft);
      } catch (err) {
        logError(`[pipeline] generateDraft/saveDraft threw for ${label}:`, err);
      }

      try {
        await notifyAll(record, savedDraft);
      } catch (err) {
        logError(`[pipeline] notifyAll() threw for ${label}:`, err);
      }

      // Emit so main process can refresh the dashboard and handle auto-approve
      if (savedDraft) {
        approvalsEmitter.emit('draft-saved', {
          listingUrl: record.url,
          draftId: savedDraft.id,
          opportunityScore: record.opportunityScore,
        });
      }
      approvalsEmitter.emit('updated');
    }

    // Step i: progress log
    log(`[pipeline] Done (${i + 1}/${rawRecords.length}): ${label} — opportunityScore=${record.opportunityScore ?? 'n/a'}`);
  }

  _lastCrawl = new Date().toISOString();
  _running = false;
  _scanCycles++;
  log(`[pipeline] Crawl cycle complete — ${_lastCrawl}`);
  scanEmitter.emit('complete', { savedCount: _savedThisCycle, scanCycles: _scanCycles });
}

export async function startPipeline() {
  if (_job) return;
  const config = getSettings();
  const hours = parseInt(config.CRAWL_INTERVAL_HOURS ?? config.crawlIntervalHours ?? '3', 10);
  const cronPattern = `0 */${hours} * * *`;

  await initDb();
  log(`[pipeline] LuxRoom AI started — crawling every ${hours} hours`);

  _job = new CronJob(cronPattern, () => {
    processNewListings().catch((err) => logError('[pipeline] Unhandled error in cron run:', err));
  });
  _job.start();
}

export function stopPipeline() {
  if (_job) {
    _job.stop();
    _job = null;
    log('[pipeline] Pipeline stopped.');
  }
}

// CLI entry point — only auto-start when run directly (e.g. npm start)
if (process.argv[1] && process.argv[1].endsWith('pipeline.js')) {
  startPipeline();
}
