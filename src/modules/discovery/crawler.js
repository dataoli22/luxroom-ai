/**
 * LuxRoom AI — Discovery / Crawler Module
 *
 * Strategy: Playwright browser automation with LLM-guided fallback (browser-use pattern).
 *
 * Each source has a hardcoded extractLinks() function based on CSS selectors.
 * When that yields < MIN_LINKS_THRESHOLD results, the page HTML is passed to a
 * local Hermes/Ollama model to identify listing URLs from the page structure —
 * making the crawler resilient to site redesigns without any code changes.
 */

import 'dotenv/config';
import { chromium } from 'playwright';
import crypto from 'crypto';
import fetch from 'node-fetch';
import * as db from '../../db/database.js';
import { getSettings } from '../../settings.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DELAY_MIN_MS = 1500;
const DELAY_MAX_MS = 3500;
const MIN_LINKS_THRESHOLD = 3;   // below this → trigger LLM fallback
const LLM_HTML_CHARS = 12_000;   // chars fed to LLM for link discovery

// ---------------------------------------------------------------------------
// LLM-guided link extraction (browser-use pattern)
// ---------------------------------------------------------------------------

/**
 * Ask a local Hermes/Ollama model to identify listing URLs from the page HTML.
 * Used as fallback when CSS selectors yield too few results.
 */
async function llmExtractLinks(html, sourceUrl, sourceName) {
  const settings = getSettings();
  const baseUrl  = settings.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model    = settings.OLLAMA_MODEL    || 'hermes3';

  // Strip scripts/styles, keep text and hrefs
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, (tag) => {
      // Keep <a href="..."> content
      const href = tag.match(/href=["']([^"']+)["']/i);
      return href ? ` ${href[1]} ` : ' ';
    })
    .replace(/\s+/g, ' ')
    .slice(0, LLM_HTML_CHARS);

  const prompt = `You are a web scraping assistant. Below is text extracted from a housing listings search page at ${sourceUrl} (site: ${sourceName}).

Find all URLs that point to individual housing listing detail pages (rooms, apartments, studios to rent). A listing URL typically contains an ID, a unique slug, or is structurally different from navigation/footer links.

Return ONLY a JSON array of URL strings. No markdown. No explanation. Example: ["https://example.com/listing/123", "https://example.com/annonce/456"]

If you find no listing URLs, return an empty array: []

Page text:
${stripped}`;

  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { num_gpu: 0 },
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) return [];

    const data = await res.json();
    const text = data.response ?? '';

    // Extract JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];

    const urls = JSON.parse(match[0]);
    if (!Array.isArray(urls)) return [];

    // Filter to same-origin URLs only (security + relevance)
    const origin = new URL(sourceUrl).origin;
    return urls
      .filter(u => {
        try { return new URL(u).origin === origin; } catch { return false; }
      })
      .slice(0, 50);  // cap to prevent runaway
  } catch (err) {
    console.warn(`[crawler:llm] LLM link extraction failed for ${sourceName}: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Source configurations
// ---------------------------------------------------------------------------

const SOURCES = [
  {
    name: 'Appartager',
    searchUrls: [
      'https://www.appartager.lu/annonces/colocation/luxembourg/?region=nord',
      'https://www.appartager.lu/annonces/colocation/luxembourg/',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(
          document.querySelectorAll('a[href*="/annonces/colocation/"]')
        )
          .map(a => a.href)
          .filter(href => /\/annonces\/colocation\/.+\/.+/.test(href));
        return [...new Set(urls)];
      }),
  },
  {
    name: 'Athome',
    searchUrls: [
      'https://www.athome.lu/louer/chambre/luxembourg/trier-date-asc.html',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(
          document.querySelectorAll('a[href*="/louer/chambre/"]')
        )
          .map(a => a.href)
          .filter(href => /\/id-\d+/.test(href) || /\/annonce-/.test(href) || /\d{5,}/.test(href));
        return [...new Set(urls)];
      }),
  },
  {
    name: 'Immotop',
    searchUrls: [
      'https://www.immotop.lu/fr/louer/?propertyTypes=room',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(
          document.querySelectorAll('a[href*="/fr/"]')
        )
          .map(a => a.href)
          .filter(href =>
            /immotop\.lu\/fr\/(louer|annonce|location)\//.test(href) &&
            /\d{4,}/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    name: 'Roomlala',
    searchUrls: [
      'https://www.roomlala.com/fr-LU/chambres-a-louer-luxembourg',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(
          document.querySelectorAll('a[href*="/fr-LU/"]')
        )
          .map(a => a.href)
          .filter(href =>
            /roomlala\.com\/fr-LU\/(annonce|location|chambre|room)/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    name: 'LogementPourEtudiants',
    searchUrls: [
      'https://www.logement-pour-etudiants.lu/annonces/',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href => /\/annonces\/\d/.test(href) || /annonce-\d/.test(href));
        return [...new Set(urls)];
      }),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDelay() {
  return new Promise(resolve => setTimeout(resolve, randomInt(DELAY_MIN_MS, DELAY_MAX_MS)));
}

function md5(input) {
  return crypto.createHash('md5').update(input).digest('hex');
}

async function safeGoto(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return true;
  } catch (err) {
    console.error(`[crawler] Navigation error for ${url}: ${err.message}`);
    return false;
  }
}

async function capturePageData(page) {
  const html       = await page.content();
  const screenshot = await page.screenshot({ encoding: 'base64', fullPage: false });
  return { html, screenshot };
}

// ---------------------------------------------------------------------------
// Core crawl logic
// ---------------------------------------------------------------------------

export async function crawlSource(sourceConfig, browser) {
  await db.initDb();

  const newRecords = [];
  const context    = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 900 },
    locale: 'fr-LU',
    timezoneId: 'Europe/Luxembourg',
  });

  const page = await context.newPage();

  // Block fonts/images to speed up page load
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,ttf}', r => r.abort());

  try {
    const allListingUrls = new Set();

    for (const searchUrl of sourceConfig.searchUrls) {
      console.log(`[${sourceConfig.name}] Visiting: ${searchUrl}`);
      const ok = await safeGoto(page, searchUrl);
      if (!ok) continue;

      await randomDelay();

      // 1. Try hardcoded CSS selector extraction
      let links = [];
      try {
        links = await sourceConfig.extractLinks(page);
      } catch (err) {
        console.error(`[${sourceConfig.name}] Selector extraction error: ${err.message}`);
      }

      // 2. LLM-guided fallback if selectors found too few (browser-use pattern)
      if (links.length < MIN_LINKS_THRESHOLD) {
        console.log(`[${sourceConfig.name}] Only ${links.length} link(s) from selectors — trying LLM extraction…`);
        const html    = await page.content();
        const llmLinks = await llmExtractLinks(html, searchUrl, sourceConfig.name);
        console.log(`[${sourceConfig.name}] LLM found ${llmLinks.length} additional link(s)`);
        links = [...new Set([...links, ...llmLinks])];
      }

      console.log(`[${sourceConfig.name}] Total: ${links.length} listing URLs from ${searchUrl}`);
      for (const link of links) allListingUrls.add(link);

      await randomDelay();
    }

    for (const listingUrl of allListingUrls) {
      console.log(`[${sourceConfig.name}] Visiting listing: ${listingUrl}`);
      const ok = await safeGoto(page, listingUrl);
      if (!ok) { await randomDelay(); continue; }

      await randomDelay();

      let html = '', screenshot = '';
      try {
        ({ html, screenshot } = await capturePageData(page));
      } catch (err) {
        console.error(`[${sourceConfig.name}] Capture error for ${listingUrl}: ${err.message}`);
        continue;
      }

      const htmlHash  = md5(html);
      const timestamp = new Date().toISOString();
      const rawRecord = { url: listingUrl, html, screenshot, timestamp, source: sourceConfig.name, htmlHash };

      let result;
      try {
        result = await db.upsertRaw(rawRecord);
      } catch (err) {
        console.error(`[${sourceConfig.name}] DB error for ${listingUrl}: ${err.message}`);
        continue;
      }

      if (result?.inserted) {
        console.log(`[${sourceConfig.name}] New listing stored: ${listingUrl}`);
        newRecords.push(rawRecord);
      } else {
        console.log(`[${sourceConfig.name}] Unchanged: ${listingUrl}`);
      }
    }
  } finally {
    await context.close();
  }

  return newRecords;
}

export async function crawlAll() {
  await db.initDb();

  const browser        = await chromium.launch({ headless: true });
  const allNewRecords  = [];

  try {
    for (const sourceConfig of SOURCES) {
      console.log(`\n[crawler] Starting source: ${sourceConfig.name}`);
      try {
        const records = await crawlSource(sourceConfig, browser);
        allNewRecords.push(...records);
        console.log(`[crawler] ${sourceConfig.name} — ${records.length} new record(s)`);
      } catch (err) {
        console.error(`[crawler] Error in source ${sourceConfig.name}: ${err.message}`);
      }
    }
  } finally {
    await browser.close();
  }

  console.log(`\n[crawler] Done. Total new records: ${allNewRecords.length}`);
  return allNewRecords;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (process.argv[1] && process.argv[1].endsWith('crawler.js')) {
  crawlAll()
    .then(records => { console.log(`[crawler] ${records.length} new record(s).`); process.exit(0); })
    .catch(err    => { console.error('[crawler] Fatal:', err); process.exit(1); });
}
