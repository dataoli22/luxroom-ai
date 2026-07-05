/**
 * LuxRoom AI — Messaging Engine (Module 6)
 * Generates draft outreach messages for approved listings.
 */

import { randomUUID } from 'crypto';
import { getSettings } from '../../settings.js';
import { complete } from '../ai/complete.js';

function buildSystemPrompt(profile = {}) {
  const name = profile.name?.trim() || 'the applicant';
  const city = profile.city?.trim() || 'the city';
  const moveInBy = profile.moveInBy
    ? `arriving around ${new Date(profile.moveInBy).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
    : 'looking to move in soon';
  const langs = (profile.languages ?? ['en']).join(', ');
  const nonSmoker = !profile.smokingAllowed ? 'non-smoker, ' : '';
  const extras = [
    profile.domiciliationRequired && 'needs to register an official address (domiciliation)',
    profile.petsAllowed && 'has a pet',
  ].filter(Boolean).join('; ');

  return `You are writing housing enquiry messages on behalf of ${name}, who is ${moveInBy} in ${city}.

Write messages that are:
- Warm but professional
- Concise (under 150 words)
- Present ${name} as a ${nonSmoker}respectful tenant
- End with a clear call to action (schedule a viewing, request availability, etc.)
- Do NOT invent personal details not provided
${extras ? `- Note: ${extras}` : ''}

The detected language of the listing will be specified in the request — always write in THAT language (even if it differs from the user's native languages). Writing in the landlord's language significantly increases response rates. The user can read: ${langs}.

Return only the message body. No subject line. No markdown.`;
}

// ---------------------------------------------------------------------------
// Language detection
// ---------------------------------------------------------------------------

const LANG_KEYWORDS = {
  fr: ['chambre', 'louer', 'disponible', 'mois', 'libre', 'appartement', 'cherche', 'pour'],
  de: ['Zimmer', 'mieten', 'verfügbar', 'Monat', 'frei', 'Wohnung', 'suche', 'für'],
  lb: ['Kummer', 'lounen', 'disponibel', 'Mount', 'fräi'],
};

/**
 * Detect the language of a listing description using keyword heuristics.
 * @param {string} rawDescription
 * @returns {'en' | 'fr' | 'de' | 'lb'}
 */
export function detectLanguage(rawDescription) {
  if (!rawDescription || typeof rawDescription !== 'string') return 'en';

  const scores = { fr: 0, de: 0, lb: 0 };

  for (const [lang, keywords] of Object.entries(LANG_KEYWORDS)) {
    for (const kw of keywords) {
      // Case-sensitive match for German/Luxembourgish (capitalised nouns matter)
      if (rawDescription.includes(kw)) {
        scores[lang]++;
      }
      // Also check lower-case for French keywords
      if (lang === 'fr' && rawDescription.toLowerCase().includes(kw.toLowerCase())) {
        scores[lang]++;
      }
    }
    // Deduplicate double-counts for French (each keyword counted once max)
    if (lang === 'fr') scores.fr = Math.min(scores.fr, LANG_KEYWORDS.fr.length);
  }

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];

  // Default to 'en' on a tie or fewer than 2 hits
  if (best[1] < 2) return 'en';

  // Check for tie: if the top two scores are equal, default to 'en'
  const sorted = Object.values(scores).sort((a, b) => b - a);
  if (sorted[0] === sorted[1] && sorted[0] >= 2) return 'en';

  return /** @type {'en' | 'fr' | 'de' | 'lb'} */ (best[0]);
}

// ---------------------------------------------------------------------------
// Condensed listing representation for the prompt
// ---------------------------------------------------------------------------

/**
 * Produce a compact JSON string of the listing for inclusion in the prompt.
 * @param {object} listing
 * @returns {string}
 */
function condenseListing(listing) {
  // Use the ACTUAL ListingRecord field names (see src/db/database.js) so the
  // draft can accurately reference rent, availability, area, etc.
  const keys = [
    'listingTitle', 'location', 'corridor', 'rentTotal', 'availability',
    'estimatedCommute', 'furnished', 'genderPolicy', 'contactName',
    'insideLuxembourg', 'rawDescription',
  ];

  const condensed = {};
  for (const key of keys) {
    if (listing[key] !== undefined && listing[key] !== null && listing[key] !== 'unknown') {
      condensed[key] = listing[key];
    }
  }

  // Truncate very long descriptions to avoid blowing the context window
  if (condensed.rawDescription && condensed.rawDescription.length > 600) {
    condensed.rawDescription = condensed.rawDescription.slice(0, 600) + '…';
  }

  return JSON.stringify(condensed, null, 2);
}

// ---------------------------------------------------------------------------
// Main export: generateDraft
// ---------------------------------------------------------------------------

/**
 * Generate a draft outreach message for an approved listing.
 *
 * @param {object} listing - The listing object (from the database / scraper).
 * @param {'introduction' | 'viewing_request' | 'availability' | 'follow_up' | 'reminder' | 'negotiation'} [type='introduction']
 * @returns {Promise<{
 *   id: string,
 *   type: string,
 *   language: 'en' | 'fr' | 'de' | 'lb',
 *   body: string,
 *   generatedAt: string,
 *   approved: boolean,
 *   approvedAt: null,
 *   discarded: boolean,
 * }>}
 */
export async function generateDraft(listing, type = 'introduction') {
  const language = detectLanguage(listing.rawDescription ?? '');
  const listingJson = condenseListing(listing);

  const userMessage = `Listing details:\n${listingJson}\n\nMessage type: ${type}\nTarget language: ${language}\n\nWrite a ${type} message.`;

  const settings = getSettings();
  const systemPrompt = buildSystemPrompt(settings.profile);

  // Prose output (not JSON) through the shared free-first provider layer, so
  // drafts work on Ollama/Hermes/Groq/Gemini too — not only paid Anthropic.
  const body = (await complete(settings, systemPrompt, userMessage, { json: false, maxTokens: 512 })).trim();

  return {
    id: randomUUID(),
    type,
    language,
    body,
    generatedAt: new Date().toISOString(),
    approved: false,
    approvedAt: null,
    discarded: false,
  };
}
