/**
 * LuxRoom AI — Discovery / Crawler Module
 *
 * Three-tier extraction strategy per source:
 *
 *  Tier 1 — CSS selectors   fast, hardcoded per site, breaks on redesigns
 *  Tier 2 — LLM extraction  strips HTML → feeds to local model → parses URLs
 *  Tier 3 — Browser-use     agentic loop: LLM sees the page, decides actions
 *                            (dismiss cookie banner, scroll, paginate, click
 *                            "load more"), then extracts — handles SPAs and
 *                            any site the first two tiers can't crack
 *
 * Tiers 2 and 3 kick in automatically when the previous tier finds fewer than
 * MIN_LINKS_THRESHOLD links, so adding a new source only requires a name and
 * search URL — the crawler degrades gracefully.
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

const USER_AGENT = process.platform === 'darwin'
  ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

const DELAY_MIN_MS       = 1500;
const DELAY_MAX_MS       = 3500;
const MIN_LINKS_THRESHOLD = 3;      // tiers 2 & 3 trigger below this
const LLM_HTML_CHARS     = 10_000;  // chars fed per LLM call
const BROWSER_USE_MAX_STEPS = 7;    // max agentic steps before giving up

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Strip scripts/styles and collapse whitespace, preserving href values. */
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, tag => {
      const m = tag.match(/href=["']([^"']+)["']/i);
      return m ? ` ${m[1]} ` : ' ';
    })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Filter a list of URL strings to same-origin, capped at 150. */
function filterSameOrigin(urls, sourceUrl) {
  const origin = new URL(sourceUrl).origin;
  return urls
    .filter(u => { try { return new URL(u).origin === origin; } catch { return false; } })
    .slice(0, 150);
}

// ---------------------------------------------------------------------------
// Tier 0 — unified LLM caller (Ollama chat → generate fallback)
// ---------------------------------------------------------------------------

async function callLlm(prompt) {
  const s       = getSettings();
  const baseUrl = s.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model   = s.OLLAMA_MODEL   || 'llama3.2:3b';
  const opts    = { num_gpu: 0, temperature: 0.1, num_predict: 512 };

  // Prefer /api/chat — better JSON compliance
  try {
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
        format: 'json',
        options: opts,
      }),
      signal: AbortSignal.timeout(50_000),
    });
    if (res.ok) {
      const d = await res.json();
      return d.message?.content ?? '';
    }
  } catch { /* fall through */ }

  // /api/generate fallback (older Ollama versions)
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, stream: false, options: opts }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) return '';
  const d = await res.json();
  return d.response ?? '';
}

// ---------------------------------------------------------------------------
// Tier 2 — LLM text extraction
// ---------------------------------------------------------------------------

async function llmExtractLinks(html, sourceUrl, sourceName) {
  const stripped = stripHtml(html).slice(0, LLM_HTML_CHARS);
  const prompt =
`You are a web scraping assistant. Below is text from a housing search page at ${sourceUrl} (${sourceName}).

Find all URLs pointing to individual housing listing detail pages (rooms, apartments, studios to rent). Listing URLs typically contain a numeric ID or unique slug and differ structurally from nav/footer links.

Return ONLY a JSON array of absolute URL strings. No markdown, no explanation.
Example: ["https://example.com/listing/123","https://example.com/annonce/456"]
If none found return: []

Page text:
${stripped}`;

  try {
    const text  = await callLlm(prompt);
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const urls = JSON.parse(match[0]);
    if (!Array.isArray(urls)) return [];
    return filterSameOrigin(urls, sourceUrl);
  } catch (err) {
    console.warn(`[crawler:tier2] ${sourceName}: ${err.message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Tier 3 — Browser-use agentic loop
// ---------------------------------------------------------------------------

/**
 * Common cookie / GDPR banner patterns across European sites.
 * Tries each selector silently — no error if not found.
 */
async function dismissCookieBanner(page) {
  const candidates = [
    // text-based (most reliable)
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Accepter tout")',
    'button:has-text("Tout accepter")',
    'button:has-text("Accepter")',
    'button:has-text("Accept")',
    'button:has-text("Akzeptieren")',
    'button:has-text("Alle akzeptieren")',
    'button:has-text("J\'accepte")',
    'button:has-text("OK")',
    'button:has-text("Agree")',
    'button:has-text("I agree")',
    'button:has-text("Got it")',
    'button:has-text("Continue")',
    'button:has-text("Continuer")',
    // attribute-based fallbacks
    '[id*="accept"][id*="cookie"]',
    '[class*="accept"][class*="cookie"]',
    '[id*="cookie-accept"]',
    '[class*="cookie-accept"]',
    '[data-testid*="accept"]',
    '#onetrust-accept-btn-handler',
    '.cc-accept',
    '.cc-btn.cc-allow',
  ];
  for (const sel of candidates) {
    try {
      const el = await page.$(sel);
      if (el && await el.isVisible()) {
        await el.click();
        await page.waitForTimeout(700);
        console.log(`[crawler:banner] Dismissed cookie banner (${sel})`);
        return true;
      }
    } catch { /* silent */ }
  }
  return false;
}

/**
 * Agentic browser-use loop.
 *
 * The LLM observes the current page (as stripped HTML) and returns a JSON
 * action. Playwright executes it. Repeat until links are found, the LLM
 * signals done, or we hit BROWSER_USE_MAX_STEPS.
 *
 * Actions the LLM can choose:
 *   extract   — current page has links, run tier-2 extraction now
 *   scroll    — scroll down to reveal lazy-loaded listings
 *   click     — click a button/link (provide CSS selector or visible text)
 *   next_page — follow pagination to gather more listing URLs
 *   done      — no more listings available
 */
async function browserUseAgent(page, sourceUrl, sourceName) {
  console.log(`[crawler:tier3] Browser-use agent starting for ${sourceName}`);
  const collectedLinks = new Set();
  const history = [];  // keeps the LLM context-aware of what's been tried

  for (let step = 0; step < BROWSER_USE_MAX_STEPS; step++) {
    const currentUrl = page.url();
    const html       = await page.content();
    const stripped   = stripHtml(html).slice(0, LLM_HTML_CHARS);

    const prompt =
`You are an autonomous browser agent finding housing listings on ${sourceName}.
Start URL: ${sourceUrl}
Current URL: ${currentUrl}
Steps taken: ${history.length === 0 ? 'none yet' : history.map(h => `${h.action}(${h.target ?? ''})`).join(' → ')}
Links collected so far: ${collectedLinks.size}

Current page content (truncated):
${stripped}

Choose the single best next action to collect housing listing URLs.
Respond with ONLY valid JSON — one of these shapes:
{"action":"extract","reason":"<why links are visible now>"}
{"action":"scroll","reason":"<why scrolling will reveal more>"}
{"action":"click","target":"<exact CSS selector or visible button text>","reason":"<why>"}
{"action":"next_page","target":"<CSS selector for next-page link/button>","reason":"<why>"}
{"action":"done","reason":"<why no more listings>"}`;

    let decision = { action: 'done', reason: 'llm call failed' };
    try {
      const raw   = await callLlm(prompt);
      const match = raw.match(/\{[\s\S]*?\}/);
      if (match) decision = JSON.parse(match[0]);
    } catch (err) {
      console.warn(`[crawler:tier3] LLM decision failed (step ${step}): ${err.message}`);
      break;
    }

    console.log(`[crawler:tier3] Step ${step + 1}/${BROWSER_USE_MAX_STEPS} — ${decision.action}${decision.target ? ':' + decision.target : ''}`);
    history.push(decision);

    if (decision.action === 'done') break;

    if (decision.action === 'extract') {
      const links = await llmExtractLinks(html, sourceUrl, sourceName);
      links.forEach(l => collectedLinks.add(l));
      console.log(`[crawler:tier3] Extracted ${links.size ?? links.length} links (total ${collectedLinks.size})`);
      if (collectedLinks.size >= MIN_LINKS_THRESHOLD) break;
    }

    if (decision.action === 'scroll') {
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * 2));
      await page.waitForTimeout(1200);
    }

    if (decision.action === 'click' && decision.target) {
      try {
        // Try CSS selector first, then visible text match
        let el = await page.$(decision.target).catch(() => null);
        if (!el) el = await page.getByText(decision.target, { exact: false }).first().catch(() => null);
        if (el && await el.isVisible()) {
          await el.click();
          await page.waitForTimeout(1800);
        } else {
          console.warn(`[crawler:tier3] click target not found: ${decision.target}`);
        }
      } catch (err) {
        console.warn(`[crawler:tier3] click failed: ${err.message}`);
      }
    }

    if (decision.action === 'next_page') {
      // Harvest what's on screen before paginating
      const links = await llmExtractLinks(html, sourceUrl, sourceName);
      links.forEach(l => collectedLinks.add(l));

      const nextCandidates = [
        decision.target,
        'a[rel="next"]', '[aria-label="Next page"]', '[aria-label="Page suivante"]',
        'a:has-text("Next")', 'a:has-text("Suivant")', 'a:has-text("Weiter")',
        '.pagination .next', '.pager-next', 'button:has-text(">")',
      ].filter(Boolean);

      let paginated = false;
      for (const sel of nextCandidates) {
        try {
          const el = await page.$(sel);
          if (el && await el.isVisible()) {
            await el.click();
            await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
            await page.waitForTimeout(1500);
            paginated = true;
            break;
          }
        } catch { /* try next candidate */ }
      }
      if (!paginated) {
        console.log(`[crawler:tier3] next_page: no clickable element found, stopping`);
        break;
      }
    }
  }

  // Final extraction pass on whatever page we're on
  const finalHtml  = await page.content();
  const finalLinks = await llmExtractLinks(finalHtml, sourceUrl, sourceName);
  finalLinks.forEach(l => collectedLinks.add(l));

  console.log(`[crawler:tier3] Agent finished — ${collectedLinks.size} total links for ${sourceName}`);
  return [...collectedLinks];
}

// ---------------------------------------------------------------------------
// Tier 4 — Pure Playwright fallback (no LLM required)
// ---------------------------------------------------------------------------

/**
 * URL path segments that strongly suggest a listing detail page.
 * Language-agnostic: covers English, French, German, Luxembourgish patterns.
 */
const LISTING_PATH_PATTERNS = [
  // generic ID-based
  /\/\d{4,}/,
  /[-_]\d{4,}/,
  /[?&]id=\d+/,
  // English
  /\/(listing|property|room|flat|apartment|studio|rental|ad|offer)\//i,
  /\/(listing|property|room|flat|apartment|studio|rental|ad|offer)[-_]\d/i,
  /\/(listing|property|room|flat|apartment|studio|rental|ad|offer)\/[\w-]{6,}/i,
  // French
  /\/(annonce|location|logement|chambre|colocation|louer|bien|offre)\//i,
  /\/(annonce|location|logement|chambre|colocation|louer|bien|offre)[-_]?\d/i,
  // German / Luxembourgish
  /\/(mieten|zimmer|wohnung|angebot|inserat|unterkunft|wg)\//i,
  /\/(mieten|zimmer|wohnung|angebot|inserat|unterkunft|wg)[-_]?\d/i,
  // slug patterns (≥2 words joined by hyphens, suggests detail page not index)
  /\/[\w]+-[\w]+-[\w]+-[\w]+-\d/,
];

/** URL segments that indicate nav/footer/utility pages — exclude these. */
const NOISE_PATH_PATTERNS = [
  /\/(login|register|signup|contact|about|faq|help|terms|privacy|legal|cookie|blog|news|press)\b/i,
  /\/(search|recherche|suche|results|resultats|ergebnisse)\b/i,
  /\.(pdf|docx?|xlsx?|zip|png|jpg|jpeg|gif|svg|css|js)(\?|$)/i,
  /^(mailto:|tel:|javascript:)/i,
  /^#/,
];

function looksLikeListingUrl(href, sourceOrigin) {
  try {
    const u = new URL(href);
    // Must be same origin
    if (u.origin !== sourceOrigin) return false;
    const path = u.pathname + u.search;
    // Reject noise
    if (NOISE_PATH_PATTERNS.some(re => re.test(path))) return false;
    // Must match at least one listing pattern
    return LISTING_PATH_PATTERNS.some(re => re.test(path));
  } catch {
    return false;
  }
}

/**
 * Pure Playwright fallback — no LLM dependency.
 *
 * 1. Scrolls the full page to trigger lazy-loaded content
 * 2. Collects every <a href> on the page
 * 3. Scores each URL by how many listing-path patterns it matches
 * 4. Returns the top candidates, deduped and capped
 *
 * Runs when Ollama is unavailable or all three LLM tiers failed.
 */
async function playwrightFallback(page, sourceUrl, sourceName) {
  console.log(`[crawler:tier4] Playwright fallback for ${sourceName}`);
  const origin = new URL(sourceUrl).origin;

  // Scroll to the bottom in increments — triggers lazy loading and infinite scroll
  try {
    await page.evaluate(async () => {
      await new Promise(resolve => {
        let last = 0;
        const id = setInterval(() => {
          window.scrollBy(0, window.innerHeight);
          if (document.body.scrollHeight === last) { clearInterval(id); resolve(); }
          last = document.body.scrollHeight;
        }, 600);
        // hard timeout — don't scroll forever
        setTimeout(() => { clearInterval(id); resolve(); }, 8000);
      });
    });
  } catch { /* page may not support scrolling */ }

  // Collect and score all hrefs
  const candidates = await page.evaluate(() =>
    Array.from(document.querySelectorAll('a[href]'))
      .map(a => a.href)
      .filter(Boolean)
  );

  const origin_ = origin; // closure-safe name
  const scored = candidates
    .filter(href => looksLikeListingUrl(href, origin_))
    .map(href => {
      const score = LISTING_PATH_PATTERNS.filter(re => re.test(href)).length;
      return { href, score };
    })
    .sort((a, b) => b.score - a.score)
    .map(x => x.href);

  const deduped = [...new Set(scored)].slice(0, 150);
  console.log(`[crawler:tier4] ${deduped.length} candidate URL(s) for ${sourceName}`);
  return deduped;
}

// ---------------------------------------------------------------------------
// Tier 1 pagination — follow "next page" links and re-run CSS extraction
// ---------------------------------------------------------------------------

/**
 * After Tier-1 extraction, follow up to maxPages "next page" links, re-running
 * sourceConfig.extractLinks on each and accumulating the results. Stops early
 * when no next-page element is found. Uses the same next-candidate selector
 * list as the tier-3 next_page block.
 */
async function paginateAndExtract(page, sourceConfig, maxPages) {
  const collected = new Set();

  const nextCandidates = [
    'a[rel="next"]', '[aria-label="Next page"]', '[aria-label="Page suivante"]',
    'a:has-text("Next")', 'a:has-text("Suivant")', 'a:has-text("Weiter")',
    '.pagination .next', '.pager-next', 'button:has-text(">")',
  ];

  let pagesVisited = 0;
  for (let i = 0; i < maxPages; i++) {
    // Find a clickable next-page element
    let paginated = false;
    for (const sel of nextCandidates) {
      try {
        const el = await page.$(sel);
        if (el && await el.isVisible()) {
          await el.click();
          await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
          await page.waitForTimeout(1500);
          paginated = true;
          break;
        }
      } catch { /* try next candidate */ }
    }
    if (!paginated) break;

    pagesVisited++;

    // Re-run Tier-1 CSS extraction on the new page
    try {
      const links = await sourceConfig.extractLinks(page);
      links.forEach(l => collected.add(l));
    } catch (err) {
      console.error(`[${sourceConfig.name}] Pagination extract error: ${err.message}`);
    }
  }

  console.log(`[${sourceConfig.name}] Pagination: visited ${pagesVisited} extra page(s), ${collected.size} link(s)`);
  return [...collected];
}

// ---------------------------------------------------------------------------
// Source configurations
// ---------------------------------------------------------------------------

export const SOURCES = [
  // ── Already live ────────────────────────────────────────────────────────────
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
    // NOTE (2026-07): the old /louer/chambre/... URL now 404s. Athome moved to
    // /en/rent/<type>/<city>/ with id-<digits>.html detail pages. Verified live.
    searchUrls: [
      'https://www.athome.lu/en/rent/apartment/luxembourg/',
      'https://www.athome.lu/en/srp/?tr=rent&prop=house-apartment&loc=L2-luxembourg',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href => /athome\.lu\/(en\/rent|louer)\//.test(href) && /id-\d+/.test(href));
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

  // ── New sources ─────────────────────────────────────────────────────────────

  {
    // Boutique colocation agency in Luxembourg City
    name: 'Loft68',
    searchUrls: [
      'https://www.loft68.lu/en/rent/',
      'https://www.loft68.lu/fr/louer/',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /loft68\.lu\/.+\/(rent|louer|property|bien|listing|annonce)/.test(href) ||
            /loft68\.lu\/.+\/\d+/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    // Student/young professional residence near Fort Vauban, Luxembourg
    name: 'VaubanFort',
    searchUrls: [
      'https://www.vaubanfort.lu/en/',
      'https://www.vaubanfort.lu/fr/',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /vaubanfort\.lu\/.*(room|chambre|studio|apartment|appartement|logement|unit)/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    // LuxMill — student residence at Belval campus (Uni of Luxembourg)
    name: 'LuxMill',
    searchUrls: [
      'https://www.luxmill.lu/en/rooms/',
      'https://www.luxmill.lu/fr/chambres/',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /luxmill\.lu\/.*(room|studio|apartment|flat|chambre|logement|unit|book)/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    // Free rental classifieds — Luxembourg section
    name: 'FreeRentAds',
    searchUrls: [
      'https://www.freerentads.com/luxembourg/',
      'https://www.freerentads.com/luxembourg/rooms/',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /freerentads\.com\/.+\/(ad|listing|annonce|room|property).*\d/.test(href) ||
            (/freerentads\.com\/luxembourg\//.test(href) && /\d{3,}/.test(href))
          );
        return [...new Set(urls)];
      }),
  },
  {
    // Student housing platform — Luxembourg listings
    name: 'ImmoJeune',
    searchUrls: [
      'https://www.immojeune.com/location-etudiant/luxembourg.html',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /immojeune\.com\/location-etudiant\/luxembourg\/.+\.html/.test(href) ||
            /immojeune\.com\/.+\/\d+/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    // LuxFriends — Luxembourg expat community classifieds
    name: 'LuxFriends',
    searchUrls: [
      'https://www.luxfriends.eu/classifieds/housing/',
      'https://www.luxfriends.eu/classifieds/rooms/',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /luxfriends\.eu\/(classifieds|ad|listing|annonce)\/.+\d/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    // French colocation platform — Luxembourg listings
    name: 'RechercheColocation',
    searchUrls: [
      'https://www.recherche-colocation.com/colocation-luxembourg.html',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /recherche-colocation\.com\/.*(colocation|annonce|colocataire).*\d/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    // JustArrived.lu — expat relocation portal with housing classifieds
    name: 'JustArrived',
    searchUrls: [
      'https://www.justarrived.lu/en/classifieds/housing/rooms-to-rent/',
      'https://www.justarrived.lu/en/classifieds/housing/apartments-to-rent/',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /justarrived\.lu\/.*(housing|room|apartment|flat|property)\/.+/.test(href) &&
            /\d{3,}/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    // MyResidHome — managed student residences, Luxembourg properties
    name: 'MyResidHome',
    searchUrls: [
      'https://www.myresidhome.com/en/student-residence/luxembourg.html',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /myresidhome\.com\/(en|fr)\/(residence|logement|room|studio|apartment)/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    // Roomie-Radar — European room-finding platform
    name: 'RoomieRadar',
    searchUrls: [
      'https://www.roomie-radar.com/rooms/luxembourg/',
      'https://www.roomie-radar.com/flatshares/luxembourg/',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /roomie-radar\.com\/(listing|room|flat|post|ad|property)\/.+/.test(href) ||
            (/roomie-radar\.com\//.test(href) && /\d{3,}/.test(href))
          );
        return [...new Set(urls)];
      }),
  },
  {
    // Wortimmo — major Luxembourg real-estate portal (Luxemburger Wort)
    name: 'Wortimmo',
    searchUrls: [
      'https://www.wortimmo.lu/en/renting?transaction=2&propertyType=8',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /wortimmo\.lu\/(en|fr|de)\/.*(annonce|listing|detail|property|immo).*\d/.test(href) ||
            (/wortimmo\.lu/.test(href) && /\d{5,}/.test(href))
          );
        return [...new Set(urls)];
      }),
  },
  {
    // HousingAnywhere — international student housing marketplace
    name: 'HousingAnywhere',
    searchUrls: [
      'https://housinganywhere.com/s/Luxembourg--Luxembourg',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /housinganywhere\.com\/(room|apartment|studio|listing)\/.+/.test(href) ||
            (/housinganywhere\.com/.test(href) && /\/\d{4,}/.test(href))
          );
        return [...new Set(urls)];
      }),
  },
  {
    // Spotahome — mid/long-term rental marketplace, Luxembourg listings
    name: 'Spotahome',
    searchUrls: [
      'https://www.spotahome.com/luxembourg',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /spotahome\.com\/.*(listing|property|for-rent)\/.+/.test(href) ||
            (/spotahome\.com/.test(href) && /\/\d{5,}/.test(href))
          );
        return [...new Set(urls)];
      }),
  },
  {
    // Uniplaces — student accommodation platform, Luxembourg listings
    name: 'Uniplaces',
    searchUrls: [
      'https://www.uniplaces.com/accommodation/luxembourg',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /uniplaces\.com\/accommodation\/luxembourg\/\d+/.test(href)
          );
        return [...new Set(urls)];
      }),
  },
  {
    // Immoweb — Belgian real-estate portal covering Luxembourg province
    name: 'Immoweb',
    searchUrls: [
      'https://www.immoweb.be/en/search/house-and-apartment/for-rent/luxembourg/province',
    ],
    extractLinks: async (page) =>
      page.evaluate(() => {
        const urls = Array.from(document.querySelectorAll('a[href]'))
          .map(a => a.href)
          .filter(href =>
            /immoweb\.be\/en\/classified\/.+\/\d{6,}/.test(href) ||
            /immoweb\.be\/en\/classified/.test(href)
          );
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

/**
 * Bounded-concurrency map — runs `fn` over `items` with at most `limit`
 * in flight at once. Results are returned in the original item order.
 * Avoids pulling in an external concurrency-pool dependency.
 */
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function safeGoto(page, url) {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    return true;
  } catch (err) {
    console.error(`[crawler] Navigation error for ${url}: ${err.message}`);
    // One retry with a 3-second backoff before giving up
    console.log(`[crawler] Retrying ${url} in 3s…`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      return true;
    } catch (retryErr) {
      console.error(`[crawler] Retry failed for ${url}: ${retryErr.message}`);
      return false;
    }
  }
}

async function capturePageData(page) {
  // Screenshot capture dropped — the analyser never uses it and it bloats the DB.
  // Shape is preserved (screenshot: null) so downstream rawRecord code still works.
  const html = await page.content();
  return { html, screenshot: null };
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

      // Always try to dismiss cookie/GDPR banner first — blocks link extraction on many EU sites
      await dismissCookieBanner(page);
      await randomDelay();

      // ── Tier 1: CSS selectors ──────────────────────────────────────────────
      let links = [];
      try {
        links = await sourceConfig.extractLinks(page);
        console.log(`[${sourceConfig.name}] Tier 1 (CSS): ${links.length} link(s)`);
      } catch (err) {
        console.error(`[${sourceConfig.name}] Tier 1 error: ${err.message}`);
      }

      // ── Tier 1 pagination: follow "next page" links to gather more ──────────
      // Only for working CSS sources that haven't yet hit the same-origin cap.
      if (links.length > 0 && links.length < 150) {
        console.log(`[${sourceConfig.name}] Tier 1 pagination (up to 5 pages)…`);
        const pagedLinks = await paginateAndExtract(page, sourceConfig, 5);
        links = [...new Set([...links, ...pagedLinks])];
      }

      // ── Tier 2: LLM text extraction ────────────────────────────────────────
      if (links.length < MIN_LINKS_THRESHOLD) {
        console.log(`[${sourceConfig.name}] Tier 2 (LLM extract)…`);
        const html     = await page.content();
        const llmLinks = await llmExtractLinks(html, searchUrl, sourceConfig.name);
        console.log(`[${sourceConfig.name}] Tier 2: ${llmLinks.length} link(s)`);
        links = [...new Set([...links, ...llmLinks])];
      }

      // ── Tier 3: Browser-use agentic loop ───────────────────────────────────
      if (links.length < MIN_LINKS_THRESHOLD) {
        console.log(`[${sourceConfig.name}] Tier 3 (browser-use agent)…`);
        const agentLinks = await browserUseAgent(page, searchUrl, sourceConfig.name);
        console.log(`[${sourceConfig.name}] Tier 3: ${agentLinks.length} link(s)`);
        links = [...new Set([...links, ...agentLinks])];
      }

      // ── Tier 4: Pure Playwright fallback (no LLM) ──────────────────────────
      if (links.length < MIN_LINKS_THRESHOLD) {
        console.log(`[${sourceConfig.name}] Tier 4 (Playwright fallback — no LLM)…`);
        const pwLinks = await playwrightFallback(page, searchUrl, sourceConfig.name);
        console.log(`[${sourceConfig.name}] Tier 4: ${pwLinks.length} link(s)`);
        links = [...new Set([...links, ...pwLinks])];
      }

      console.log(`[${sourceConfig.name}] Total: ${links.length} listing URL(s) from ${searchUrl}`);
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
    // Crawl up to 3 sources at once — each crawlSource opens its own browser
    // context, and Chromium handles many concurrent contexts per instance.
    await mapLimit(SOURCES, 3, async (sourceConfig) => {
      console.log(`\n[crawler] Starting source: ${sourceConfig.name}`);
      try {
        const records = await crawlSource(sourceConfig, browser);
        allNewRecords.push(...records);
        console.log(`[crawler] ${sourceConfig.name} — ${records.length} new record(s)`);
      } catch (err) {
        console.error(`[crawler] Error in source ${sourceConfig.name}: ${err.message}`);
      }
    });
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
