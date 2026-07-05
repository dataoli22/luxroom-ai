/**
 * Opportunity Engine (Module 4) — LuxRoom AI
 * Pure deterministic scoring. No LLM, no external APIs.
 */

export const OPPORTUNITY_THRESHOLD = 8;

/**
 * Parse a rent value from various string formats.
 * Handles: "€550/month", "550 €", "500-600", "550", 550, etc.
 * Returns the numeric value (midpoint for ranges), or null if unparseable.
 * @param {string|number|null|undefined} rentTotal
 * @returns {number|null}
 */
export function parseRent(rentTotal) {
  if (rentTotal === null || rentTotal === undefined) return null;

  if (typeof rentTotal === 'number') {
    return Number.isFinite(rentTotal) && rentTotal >= 0 ? rentTotal : null;
  }

  if (typeof rentTotal !== 'string') return null;

  const cleaned = rentTotal.replace(/[€$£\s,]/g, '').toLowerCase().replace('/month', '').replace('/mo', '').trim();

  if (!cleaned) return null;

  // Range: "500-600"
  const rangeMatch = cleaned.match(/^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/);
  if (rangeMatch) {
    const lo = parseFloat(rangeMatch[1]);
    const hi = parseFloat(rangeMatch[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      return (lo + hi) / 2;
    }
    return null;
  }

  // Single value with possible trailing/leading noise
  const singleMatch = cleaned.match(/(\d+(?:\.\d+)?)/);
  if (singleMatch) {
    const val = parseFloat(singleMatch[1]);
    return Number.isFinite(val) && val >= 0 ? val : null;
  }

  return null;
}

/**
 * Score recency based on how old a listing is.
 * @param {number|string|Date|null|undefined} timestamp — Unix ms, ISO string, or Date
 * @returns {number} 1 | 4 | 7 | 10
 */
function recencyBonus(timestamp) {
  if (timestamp === null || timestamp === undefined) return 1;

  let postedAt;
  if (timestamp instanceof Date) {
    postedAt = timestamp.getTime();
  } else if (typeof timestamp === 'string') {
    const d = new Date(timestamp);
    postedAt = Number.isNaN(d.getTime()) ? null : d.getTime();
  } else if (typeof timestamp === 'number') {
    postedAt = Number.isFinite(timestamp) ? timestamp : null;
  } else {
    postedAt = null;
  }

  if (postedAt === null) return 1;

  const ageMs = Date.now() - postedAt;
  if (ageMs < 0) return 10; // future-dated — treat as brand new
  const ageHours = ageMs / (1000 * 60 * 60);

  if (ageHours < 6) return 10;
  if (ageHours < 24) return 7;
  if (ageHours < 72) return 4;
  return 1;
}

/**
 * Score based on monthly rent, relative to the user's budget when known.
 * With a budget set, value is scored by rent/budget ratio so it works for any
 * budget (room seeker at €700 or apartment seeker at €1500). Falls back to the
 * old fixed Luxembourg room bands when no budget is available.
 * @param {string|number|null|undefined} rentTotal
 * @param {number|null|undefined} maxBudget
 * @returns {number} 0 | 1 | 4 | 7 | 10
 */
function priceScore(rentTotal, maxBudget) {
  const rent = parseRent(rentTotal);
  if (rent === null) return 0;

  if (Number.isFinite(maxBudget) && maxBudget > 0) {
    const ratio = rent / maxBudget;
    if (ratio <= 0.7) return 10;  // well under budget — great value
    if (ratio <= 0.85) return 7;
    if (ratio <= 1.0) return 4;   // right at budget
    if (ratio <= 1.1) return 1;   // slightly over
    return 0;                     // clearly over budget
  }

  // No budget known — fall back to fixed Luxembourg room bands.
  if (rent < 550) return 10;
  if (rent < 650) return 7;
  if (rent < 750) return 4;
  if (rent <= 800) return 1;
  return 0;
}

/**
 * Estimate competition level for a listing.
 * @param {object} listing
 * @param {number} pScore — already-computed priceScore
 * @returns {number} 1–10
 */
function competitionScore(listing, pScore) {
  let score = 5;

  if (pScore < 7) score += 2; // cheaper = more competition

  const source = (listing.source || '').toLowerCase().trim();
  if (source === 'appartager' || source === 'athome') score += 1;

  const bonus = recencyBonus(listing.timestamp ?? listing.postedAt ?? listing.createdAt);
  if (bonus === 10) score += 2; // posted < 6h ago

  return Math.min(score, 10);
}

/**
 * Score an enriched listing and return opportunity metrics.
 *
 * @param {object} enrichedListing — expected shape:
 *   {
 *     housingScore: number,          // 0–10 from housing scorer
 *     rentTotal: string|number,      // raw rent field
 *     source: string,                // e.g. 'appartager', 'athome', 'immotop'
 *     timestamp?: number|string,     // when listing was posted (ms or ISO)
 *     postedAt?: number|string,      // alias
 *     createdAt?: number|string,     // alias
 *   }
 *
 * @returns {{
 *   housingScore: number,
 *   opportunityScore: number,
 *   competitionScore: number,
 *   urgency: 'HIGH'|'NORMAL'
 * }}
 */
export function scoreOpportunity(enrichedListing) {
  if (!enrichedListing || typeof enrichedListing !== 'object') {
    return { housingScore: 0, opportunityScore: 0, competitionScore: 5, urgency: 'NORMAL' };
  }

  const housingScore = typeof enrichedListing.housingScore === 'number' && Number.isFinite(enrichedListing.housingScore)
    ? Math.max(0, Math.min(10, enrichedListing.housingScore))
    : 0;

  const rentField = enrichedListing.rentTotal ?? enrichedListing.rent ?? enrichedListing.price ?? null;
  const maxBudget = Number(enrichedListing.maxBudget);
  const pScore = priceScore(rentField, Number.isFinite(maxBudget) ? maxBudget : null);

  const ts = enrichedListing.timestamp ?? enrichedListing.postedAt ?? enrichedListing.createdAt ?? null;
  const rBonus = recencyBonus(ts);
  const cScore = competitionScore(enrichedListing, pScore);

  // OpportunityScore = (housingScore * 0.5) + (recencyBonus * 0.3) + (priceScore * 0.2)
  const opportunityScore = parseFloat(
    ((housingScore * 0.5) + (rBonus * 0.3) + (pScore * 0.2)).toFixed(4)
  );

  // Urgency: HIGH only if posted < 6h AND score > threshold
  const isRecent = rBonus === 10;
  const urgency = (isRecent && opportunityScore > OPPORTUNITY_THRESHOLD) ? 'HIGH' : 'NORMAL';

  return {
    housingScore,
    opportunityScore,
    competitionScore: cScore,
    urgency,
  };
}
