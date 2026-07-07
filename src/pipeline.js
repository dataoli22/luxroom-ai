import { EventEmitter } from 'events';
import { CronJob } from 'cron';
import { getSettings } from './settings.js';
import { crawlAll } from './modules/discovery/crawler.js';
import { extractListing } from './modules/extraction/extractor.js';
import { analyseListing } from './modules/analysis/analyser.js';
import { scoreOpportunity } from './modules/opportunity/scorer.js';
import { notifyAll } from './modules/notifications/notifier.js';
import { generateDraft } from './modules/messaging/messenger.js';
import { initDb, upsertListing, saveDraft, beginBatch, endBatch, markStaleListings } from './db/database.js';

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

// Live scan progress
let _scanPhase = 'idle';     // 'idle' | 'crawling' | 'analysing'
let _scanCurrent = 0;
let _scanTotal = 0;
let _scanStartedAt = null;
let _scanSourcesDone = 0;
let _scanSourcesTotal = 0;

function emitScanProgress() {
  scanEmitter.emit('progress', {
    phase: _scanPhase,
    current: _scanCurrent,
    total: _scanTotal,
    startedAt: _scanStartedAt,
    sourcesDone: _scanSourcesDone,
    sourcesTotal: _scanSourcesTotal,
  });
}

export function getPipelineStatus() {
  return {
    running: _running, lastCrawl: _lastCrawl, listingCount: _listingCount, scanCycles: _scanCycles,
    scanPhase: _scanPhase, scanCurrent: _scanCurrent, scanTotal: _scanTotal, scanStartedAt: _scanStartedAt,
    scanSourcesDone: _scanSourcesDone, scanSourcesTotal: _scanSourcesTotal,
  };
}

export async function processNewListings() {
  const config = getSettings();
  const OPPORTUNITY_THRESHOLD = config.OPPORTUNITY_THRESHOLD != null
    ? Number(config.OPPORTUNITY_THRESHOLD)
    : 0.7;

  _running = true;
  let _savedThisCycle = 0;
  let completed = false;
  _scanPhase = 'crawling';
  _scanCurrent = 0;
  _scanTotal = 0;
  _scanSourcesDone = 0;
  _scanSourcesTotal = 0;
  _scanStartedAt = Date.now();
  emitScanProgress();
  log(`[pipeline] Starting crawl — ${new Date().toISOString()}`);

  // Defer DB writes to disk until the whole cycle is done — sql.js otherwise
  // rewrites the entire DB file on every single insert.
  beginBatch();

  try {
    // Per-listing work — steps a through i. Returns { saved } so the caller can
    // tally results.
    async function processOne(rawRecord) {
      const label = rawRecord.url ?? 'record';
      log(`[pipeline] Processing: ${label}`);

      // Step a: extract
      let extracted;
      try {
        extracted = await extractListing(rawRecord);
      } catch (err) {
        logError(`[pipeline] extractListing() threw for ${label}:`, err);
        return { saved: false };
      }

      // Step b: skip if null
      if (extracted == null) {
        log(`[pipeline] Extraction returned null for ${label} — skipping`);
        return { saved: false };
      }

      // Step c: analyse
      let analysed;
      try {
        analysed = await analyseListing(extracted);
      } catch (err) {
        logError(`[pipeline] analyseListing() threw for ${label}:`, err);
        analysed = null;
      }

      // Step d: if analysis failed, still keep the listing visible (with whatever
      // we extracted) rather than dropping it — every scraped room should show up.
      if (analysed == null) {
        log(`[pipeline] Analysis unavailable for ${label} — saving as REVIEW`);
        analysed = {
          ...extracted,
          verdict: 'REVIEW',
          score: null,
          corridor: extracted.corridor ?? 'unknown',
          pros: [],
          cons: [],
          dealbreakers: [],
          topReason: 'Not auto-analysed — open the listing to review it yourself.',
        };
      }

      // Step e: score — analyser outputs `score`, scorer expects `housingScore`.
      // Pass the user's budget so price scoring scales to their target.
      const analysedWithHousingScore = {
        ...analysed,
        housingScore: analysed.score ?? 0,
        maxBudget: Number(config.profile?.maxBudget) || null,
      };
      let scores;
      try {
        scores = await scoreOpportunity(analysedWithHousingScore);
      } catch (err) {
        logError(`[pipeline] scoreOpportunity() threw for ${label}:`, err);
        return { saved: false };
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
        return { saved: false };
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
      log(`[pipeline] Done: ${label} — opportunityScore=${record.opportunityScore ?? 'n/a'}`);

      return { saved: true };
    }

    // Analyse each source's new records the moment that source finishes crawling,
    // so listings start appearing within a minute or two — not only after the
    // entire crawl (which spans many sites) is done.
    const onSourceRecords = async (records) => {
      _scanPhase = 'analysing';
      _scanTotal += records.length;
      emitScanProgress();
      await mapLimit(records, 3, async (rec) => {
        const r = await processOne(rec);
        _scanCurrent++;
        emitScanProgress();
        return r;
      });
    };

    const onSourceDone = (sourcesDone, sourcesTotal) => {
      _scanSourcesDone = sourcesDone;
      _scanSourcesTotal = sourcesTotal;
      emitScanProgress();
    };

    let crawledTotal = 0;
    try {
      const all = await crawlAll(onSourceRecords, onSourceDone);
      crawledTotal = all.length;
    } catch (err) {
      logError('[pipeline] crawlAll() failed:', err);
      _running = false;
      _scanPhase = 'idle';
      emitScanProgress();
      return;
    }
    log(`[pipeline] Crawl complete — ${crawledTotal} new raw record(s)`);

    // Stale-listing pass — flag anything not seen recently. Never let a failure
    // here break the cycle.
    try {
      const staleCount = await markStaleListings(14);
      log(`[pipeline] Marked ${staleCount} listing(s) as stale (not seen in 14 days)`);
    } catch (err) {
      logError('[pipeline] markStaleListings() threw:', err);
    }

    _lastCrawl = new Date().toISOString();
    _running = false;
    _scanCycles++;
    completed = true;
    log(`[pipeline] Crawl cycle complete — ${_lastCrawl}`);
  } finally {
    // Flush all deferred writes to disk exactly once, before the UI refreshes.
    endBatch();
    _scanPhase = 'idle';
    emitScanProgress();
  }

  if (completed) {
    scanEmitter.emit('complete', { savedCount: _savedThisCycle, scanCycles: _scanCycles });
  }
}

// Run `fn` over `items` with at most `limit` invocations in flight at once.
// Resolves once every item has been processed. No external dependency.
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const poolSize = Math.min(limit, items.length);
  const workers = [];
  for (let w = 0; w < poolSize; w++) workers.push(worker());
  await Promise.all(workers);
  return results;
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
