/**
 * Source health & latency test — checks every configured source.
 *
 * For each source it opens the first search URL, dismisses the cookie banner,
 * runs the real Tier-1 link extractor, and records: HTTP status, number of
 * listing links found, and latency. Live sites vary, so this reports rather than
 * hard-fails — but it exits non-zero if a source outright errors/404s, so it can
 * gate CI if you want.
 *
 * Run:  node test-sources.mjs   (or: npm run test:sources)
 */

import { SOURCES, dismissCookieBanner } from './src/modules/discovery/crawler.js';
import { chromium } from 'playwright';

const UA = process.platform === 'darwin'
  ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const EXTRA_HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,de;q=0.7',
  'sec-ch-ua': '"Chromium";v="125", "Not.A/Brand";v="24"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"Windows"',
  'Upgrade-Insecure-Requests': '1',
};

async function checkSource(browser, src) {
  const ctx = await browser.newContext({ userAgent: UA, locale: 'fr-LU', timezoneId: 'Europe/Luxembourg', viewport: { width: 1366, height: 900 }, extraHTTPHeaders: EXTRA_HEADERS });
  await ctx.addInitScript(() => { Object.defineProperty(navigator, 'webdriver', { get: () => undefined }); });
  const page = await ctx.newPage();
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', r => r.abort());
  const url = src.searchUrls[0];
  const t0 = Date.now();
  let status = 0, links = 0, error = null;
  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    status = resp ? resp.status() : 0;
    try { await dismissCookieBanner(page); } catch {}
    await page.waitForTimeout(1500);
    const l = await src.extractLinks(page);
    links = Array.isArray(l) ? new Set(l).size : 0;
  } catch (e) {
    error = (e.message || String(e)).split('\n')[0].slice(0, 60);
  } finally {
    await ctx.close();
  }
  const ms = Date.now() - t0;
  const verdict = error || status >= 400 ? 'FAIL' : links > 0 ? 'PASS' : 'WARN';
  return { name: src.name, status, links, ms, error, verdict };
}

(async () => {
  console.log(`Source health & latency test — ${SOURCES.length} sources\n${'='.repeat(64)}`);
  const browser = await chromium.launch({ headless: true, args: ['--disable-blink-features=AutomationControlled'] });
  const results = [];
  try {
    for (const src of SOURCES) {          // sequential for clean latency numbers
      const r = await checkSource(browser, src);
      const icon = r.verdict === 'PASS' ? '✓' : r.verdict === 'WARN' ? '▲' : '✗';
      const line = `${icon} ${r.name.padEnd(18)} ${String(r.links).padStart(3)} links  ${String(r.ms).padStart(6)}ms  [${r.status || 'ERR'}]`;
      console.log(r.error ? `${line}  ${r.error}` : line);
      results.push(r);
    }
  } finally {
    await browser.close();
  }

  const pass = results.filter(r => r.verdict === 'PASS');
  const warn = results.filter(r => r.verdict === 'WARN');
  const fail = results.filter(r => r.verdict === 'FAIL');
  const lat = results.map(r => r.ms).sort((a, b) => a - b);
  const avg = Math.round(lat.reduce((a, b) => a + b, 0) / lat.length);
  const median = lat[Math.floor(lat.length / 2)];

  console.log('='.repeat(64));
  console.log(`PASS ${pass.length}  ·  WARN ${warn.length} (loads, 0 links — login-gated or selector drift)  ·  FAIL ${fail.length}`);
  console.log(`Latency: avg ${avg}ms · median ${median}ms · slowest ${lat[lat.length - 1]}ms`);
  if (warn.length) console.log(`WARN: ${warn.map(r => r.name).join(', ')}`);
  if (fail.length) console.log(`FAIL: ${fail.map(r => `${r.name} (${r.error || r.status})`).join(', ')}`);

  process.exit(fail.length > 0 ? 1 : 0);
})();
