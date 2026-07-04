/**
 * LuxRoom AI — smoke test
 *
 * Exercises the v1.2.0 scraping-overhaul changes at three levels:
 *   A. DB layer (offline, deterministic) — batch writes + stale detection.  MUST PASS.
 *   B. Analyser budget pre-filter (offline, no network).                    MUST PASS.
 *   C. Analyser provider routing via local Ollama (live LLM).               informational.
 *   D. Live link-extraction against real housing sites.                     informational.
 *
 * Run:  node smoke-test.mjs
 * Deterministic failures (A, B) exit 1. Network/LLM sections never fail the run.
 */

// ── Make settings.js behave as if inside Electron, with an injected profile ──
process.versions.electron = '28.0.0';

import os from 'os';
import fs from 'fs';
import path from 'path';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'luxroom-smoke-'));
process.env.ELECTRON_USER_DATA = tmpDir;
fs.writeFileSync(
  path.join(tmpDir, 'settings.json'),
  JSON.stringify({
    aiProvider: 'ollama',
    OLLAMA_MODEL: 'qwen2.5:7b',
    OLLAMA_BASE_URL: 'http://localhost:11434',
    OPPORTUNITY_THRESHOLD: '8',
    profile: {
      name: 'SmokeTest', city: 'Luxembourg', currency: 'EUR',
      maxBudget: '800', commuteTo: 'Kirchberg', onboardingDone: true,
    },
  }, null, 2),
);

let failures = 0;
const ok  = (m) => console.log(`  ✓ ${m}`);
const bad = (m) => { console.log(`  ✗ ${m}`); failures++; };
function assert(cond, m) { cond ? ok(m) : bad(m); }

const now = () => new Date().toISOString();

// ─────────────────────────────────────────────────────────────────────────────
// A. DB layer — batch writes + stale detection (deterministic)
// ─────────────────────────────────────────────────────────────────────────────
async function testDb() {
  console.log('\n[A] Database layer — batch + stale detection');
  const db = await import('./src/db/database.js');
  await db.initDb();

  const url = 'https://smoke.test/listing/1';

  // Batch: nested begin/end must not throw and must persist writes.
  db.beginBatch();
  db.beginBatch();
  const first = await db.upsertRaw({ url, html: '<h1>a</h1>', htmlHash: 'hash-a', timestamp: now(), source: 'Smoke' });
  assert(first.inserted === true, 'upsertRaw inserts a new raw record');
  db.endBatch();               // depth 1 — deferred
  db.endBatch();               // depth 0 — flush
  assert(true, 'nested beginBatch/endBatch completed without error');

  // Unchanged hash → not re-inserted, but lastSeen still refreshed.
  const second = await db.upsertRaw({ url, html: '<h1>a</h1>', htmlHash: 'hash-a', timestamp: now(), source: 'Smoke' });
  assert(second.inserted === false, 'unchanged htmlHash is not re-inserted');

  // Promote to a full listing.
  await db.upsertListing({ url, source: 'Smoke', listingTitle: 'Test room', verdict: 'STRONG', score: 9, opportunityScore: 8.5, corridor: 'city', htmlHash: 'hash-a' });
  let all = await db.getAllListings();
  const rec = all.find(l => l.url === url);
  assert(!!rec, 'listing is retrievable via getAllListings');
  assert(rec && rec.stale === false, 'fresh listing deserializes stale=false');

  // Stale negative path — fresh lastSeen, 14-day window → not stale.
  await db.markStaleListings(14);
  assert((await db.getListing(url)).stale === false, 'markStaleListings(14) leaves a just-seen listing non-stale');

  // Stale positive path — future cutoff (days=-1) marks everything stale.
  const staleCount = await db.markStaleListings(-1);
  assert(staleCount >= 1, `markStaleListings(-1) flags the listing (count=${staleCount})`);
  assert((await db.getListing(url)).stale === true, 'listing now deserializes stale=true');

  // Revive — a normal window with fresh lastSeen un-flags it.
  await db.markStaleListings(14);
  assert((await db.getListing(url)).stale === false, 'listing is revived (stale reset to false) when seen again');
}

// ─────────────────────────────────────────────────────────────────────────────
// B. Analyser budget pre-filter (offline — short-circuits before any model call)
// ─────────────────────────────────────────────────────────────────────────────
async function testPreFilter() {
  console.log('\n[B] Analyser budget pre-filter (no network)');
  const { analyseListing } = await import('./src/modules/analysis/analyser.js');

  // Budget is 800; 1.6x = 1280. A 2.500 EU-format rent must be skipped with NO model call.
  const t0 = Date.now();
  const r = await analyseListing({ url: 'https://smoke.test/listing/2', rentTotal: '€2.500,00/month', location: 'Kirchberg', rawDescription: 'Luxury flat' });
  const ms = Date.now() - t0;
  assert(r && r.verdict === 'SKIP', 'over-budget listing returns synthetic SKIP');
  assert(r && Array.isArray(r.dealbreakers) && r.dealbreakers.includes('Over budget'), 'SKIP carries "Over budget" dealbreaker');
  assert(ms < 1000, `pre-filter short-circuits fast (${ms}ms — proves no model call)`);
}

// ─────────────────────────────────────────────────────────────────────────────
// C. Analyser via local Ollama qwen2.5:7b (live — informational)
// ─────────────────────────────────────────────────────────────────────────────
async function testAnalyserLive() {
  console.log('\n[C] Analyser routing → local Ollama qwen2.5:7b (live, informational)');
  const { analyseListing } = await import('./src/modules/analysis/analyser.js');
  try {
    const t0 = Date.now();
    const r = await analyseListing({
      url: 'https://smoke.test/listing/3',
      rentTotal: '€650/month',
      location: 'Mersch',
      rawDescription: 'Bright room in a shared flat in Mersch, 2 min from the CFL train station, direct line to Luxembourg City. Available immediately. Domiciliation possible. Furnished.',
    });
    const ms = Date.now() - t0;
    if (r && r.verdict) {
      console.log(`  ℹ Ollama analysed in ${(ms / 1000).toFixed(1)}s → verdict=${r.verdict}, score=${r.score ?? 'n/a'}`);
      console.log(`  ℹ Multi-provider routing to Ollama WORKS (real JSON parsed).`);
    } else {
      console.log(`  ℹ Ollama returned no parseable verdict (${(ms / 1000).toFixed(1)}s) — routing ran but model output wasn't JSON. Not a failure.`);
    }
  } catch (err) {
    console.log(`  ℹ Ollama path threw (not counted as failure): ${err.message}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// D. Live link-extraction against real sites (informational)
// ─────────────────────────────────────────────────────────────────────────────
async function testCrawlLive() {
  console.log('\n[D] Live link-extraction from real sites (informational)');
  const { SOURCES } = await import('./src/modules/discovery/crawler.js');
  const { chromium } = await import('playwright');

  const wanted = ['Athome', 'Appartager', 'HousingAnywhere', 'Immoweb'];
  const sample = SOURCES.filter(s => wanted.includes(s.name));
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.log(`  ℹ Could not launch Chromium (${err.message}) — skipping live crawl.`);
    return;
  }

  for (const src of sample) {
    const ctx = await browser.newContext({ userAgent: UA, locale: 'fr-LU' });
    const page = await ctx.newPage();
    await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', r => r.abort());
    try {
      await page.goto(src.searchUrls[0], { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2500);
      const links = await src.extractLinks(page);
      const n = Array.isArray(links) ? links.length : 0;
      console.log(`  ℹ ${src.name.padEnd(16)} → ${n} listing link(s)${n > 0 ? '  ✓ selectors live' : '  (0 — may need cookie dismissal / selector refresh)'}`);
    } catch (err) {
      console.log(`  ℹ ${src.name.padEnd(16)} → unreachable: ${err.message.slice(0, 60)}`);
    } finally {
      await ctx.close();
    }
  }
  await browser.close();
}

// ─────────────────────────────────────────────────────────────────────────────
(async () => {
  console.log('LuxRoom AI smoke test\n=====================');
  try {
    await testDb();
    await testPreFilter();
    await testAnalyserLive();
    await testCrawlLive();
  } catch (err) {
    console.error('\nFATAL:', err);
    failures++;
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  }

  console.log('\n=====================');
  if (failures > 0) {
    console.log(`RESULT: ${failures} deterministic check(s) FAILED.`);
    process.exit(1);
  }
  console.log('RESULT: all deterministic checks PASSED (see ℹ lines for live results).');
  process.exit(0);
})();
