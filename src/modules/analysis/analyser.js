import { getSettings } from "../../settings.js";
import { complete } from "../ai/complete.js";

// ---------------------------------------------------------------------------
// Dynamic system prompt — built from the user's onboarding profile
// ---------------------------------------------------------------------------

function buildSystemPrompt(profile = {}) {
  const name = profile.name?.trim() || "the user";
  const city = profile.city?.trim() || "their target city";
  const currency = profile.currency || "EUR";
  const symbol = currency === 'GBP' ? '£' : currency === 'USD' ? '$' : currency === 'CHF' ? 'CHF ' : '€';
  const maxBudget = profile.maxBudget ? `${symbol}${profile.maxBudget}/month` : "unspecified";
  const commuteTo = profile.commuteTo?.trim() || city;
  const maxCommuteMins = profile.maxCommuteMins ?? 75;
  const moveInBy = profile.moveInBy ? `by ${profile.moveInBy}` : "as soon as possible";
  const housingType = {
    room: "a room in a shared flat",
    studio: "a studio apartment",
    apartment: "an apartment",
    any: "any housing",
  }[profile.housingType] ?? "housing";
  const furnishedPref =
    profile.furnished === "yes" ? "Furnished only."
    : profile.furnished === "no" ? "Unfurnished preferred."
    : "Furnished or unfurnished.";

  const extras = [
    profile.domiciliationRequired && "Must allow domiciliation (official address registration) — non-negotiable.",
    !profile.smokingAllowed && "Non-smoking environment required.",
    profile.petsAllowed && "Must allow pets.",
    profile.parkingRequired && "Parking required.",
    profile.genderPolicy === "female_only" && "Female-only colocation preferred.",
    profile.genderPolicy === "male_only" && "Male-only colocation preferred.",
    profile.preferredAreas?.trim() && `Preferred areas: ${profile.preferredAreas}.`,
    profile.additionalNotes?.trim() && `Additional context: ${profile.additionalNotes}`,
  ].filter(Boolean).map(s => `- ${s}`).join("\n");

  // Luxembourg-specific commute intelligence — biased toward the student's campus
  const campus = profile.campus || (commuteTo.toLowerCase().includes('belval') || commuteTo.toLowerCase().includes('esch') ? 'belval' : 'kirchberg');
  const campusContext = campus === 'belval' ? `
- The student commutes to the BELVAL campus (Esch-sur-Alzette, in the south / Minett). Score southern towns HIGHEST on commute: Belval, Esch-sur-Alzette, Differdange, Schifflange, Dudelange, Bettembourg are all close (~5–20 min). CFL Line 60 / 90 serves this corridor.
- Luxembourg City is ~35–45 min from Belval by train — acceptable but not ideal. Northern (Line 10) towns are FAR from Belval — penalise them on commute for this student.` : `
- The student commutes to the KIRCHBERG campus (Luxembourg City). Score city neighbourhoods and the CFL Line 10 north corridor (Mersch, Ettelbruck, Schieren, Lintgen, Lorentzweiler) HIGHEST — Line 10 connects DIRECTLY to Pfaffenthal-Kirchberg station (Mersch ~25 min, Ettelbruck ~35 min). These northern towns are UNDERRATED and should score well despite being outside the city.
- Southern towns (Esch, Belval, Differdange) are ~35–45 min from Kirchberg — acceptable but not ideal for this student.`;

  const luxembourgContext = city.toLowerCase().includes("luxembourg") || commuteTo.toLowerCase().includes('belval') || commuteTo.toLowerCase().includes('kirchberg') ? `

COMMUTE CONTEXT FOR LUXEMBOURG:${campusContext}
- Must be INSIDE Luxembourg (not France, Belgium, or Germany) if domiciliation is required — a Luxembourg address is needed for residence permits.

Set the "corridor" field as:
- "north-line10" for Mersch, Ettelbruck, Schieren, Lintgen, Lorentzweiler, Diekirch, Colmar-Berg
- "city" for Luxembourg City neighbourhoods (Kirchberg, Bonnevoie, Hollerich, Belair, Gare, Limpertsberg etc)
- "south" for Esch-sur-Alzette, Bettembourg, Differdange, Belval, Dudelange
- "other" for anywhere else` : `

Set the "corridor" field to the district/area name of the listing, or "unknown" if not determinable.`;

  return `You are a housing analyst helping ${name} find ${housingType} in ${city}.

Their criteria:
- Maximum rent: ${maxBudget}
- Commute destination: ${commuteTo}
- Max commute: ${maxCommuteMins} minutes by public transport
- Availability needed: ${moveInBy}
- ${furnishedPref}
${extras ? extras + "\n" : ""}
Analyse the listing provided and return ONLY a JSON object (no markdown, no preamble) with this exact structure:
{
  "verdict": "STRONG" | "CONSIDER" | "SKIP",
  "score": 1-10,
  "location": "neighbourhood, city",
  "insideLuxembourg": true | false,
  "estimatedCommute": "X min by [mode]" or "unknown",
  "rentTotal": "${symbol}X/month" or "unknown",
  "domiciliationFlag": "ok" | "refused" | "unknown",
  "availability": "date or immediately" or "unknown",
  "corridor": "area or zone of listing",
  "pros": ["short pro 1", "short pro 2"],
  "cons": ["short con 1", "short con 2"],
  "dealbreakers": ["dealbreaker 1"] or [],
  "topReason": "one sentence summary of the verdict"
}

Score 8–10 = strong match. Score 5–7 = worth considering. Score 1–4 = poor fit.
"verdict" must match the score: STRONG=8+, CONSIDER=5-7, SKIP=1-4.
${luxembourgContext}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserMessage(record) {
  const {
    rawDescription = "",
    location = "unknown",
    rentTotal = "unknown",
    availability = "unknown",
    domiciliationFlag = "unknown",
    genderPolicy = "unknown",
    furnished = "unknown",
    smokingAllowed = "unknown",
  } = record;

  return `Analyse this listing:\n\n${rawDescription}\n\nLocation: ${location}\nRent: ${rentTotal}\nAvailability: ${availability}\nDomiciliation: ${domiciliationFlag}\nGender policy: ${genderPolicy}\nFurnished: ${furnished}\nSmoking: ${smokingAllowed}`;
}

function parseAnalysis(text) {
  let cleaned = text.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function analyseListing(extractedRecord) {
  const settings = getSettings();
  const profile = settings.profile || {};
  const systemPrompt = buildSystemPrompt(settings.profile);
  const userMessage = buildUserMessage(extractedRecord);

  // -------------------------------------------------------------------------
  // Cheap budget pre-filter — skip the expensive model call for listings that
  // are clearly far over budget. CONSERVATIVE: only skips when a rent number
  // is confidently parsed AND a positive budget is set AND rent > budget*1.6.
  // -------------------------------------------------------------------------
  const rentMatch = String(extractedRecord.rentTotal ?? "").match(/\d[\d.,\s]*/);
  const maxBudget = Number(profile.maxBudget);
  if (rentMatch) {
    // Normalize European/US formats: drop a trailing 2-digit cents part first,
    // then strip thousands separators — so "1.200,50 €" → 1200, not 120050.
    const numStr = rentMatch[0]
      .replace(/\s/g, "")
      .replace(/[.,]\d{2}$/, "")
      .replace(/[.,]/g, "");
    const parsedRent = Number(numStr);
    if (
      Number.isFinite(parsedRent) &&
      parsedRent > 0 &&
      Number.isFinite(maxBudget) &&
      maxBudget > 0 &&
      parsedRent > maxBudget * 1.6
    ) {
      console.log(
        `[analyser] Pre-filter skip (rent ${parsedRent} > budget ${maxBudget}): ${extractedRecord.url}`
      );
      return {
        ...extractedRecord,
        verdict: "SKIP",
        score: 2,
        corridor: extractedRecord.corridor ?? "unknown",
        pros: [],
        cons: ["Rent significantly above budget"],
        dealbreakers: ["Over budget"],
        topReason: "Rent is well above the configured maximum budget.",
        estimatedCommute: extractedRecord.estimatedCommute ?? "unknown",
      };
    }
  }

  // -------------------------------------------------------------------------
  // Run through the shared provider layer (free-first, with safe fallback).
  // -------------------------------------------------------------------------
  let text;
  try {
    text = await complete(settings, systemPrompt, userMessage, { json: true, maxTokens: 1024 });
  } catch (err) {
    console.error("[analyser] API call failed:", err.message);
    return null;
  }

  if (!text) {
    console.error("[analyser] Empty response from API");
    return null;
  }

  const analysis = parseAnalysis(text);
  if (!analysis) {
    console.error("[analyser] Failed to parse JSON from response:", text);
    return null;
  }

  return { ...extractedRecord, ...analysis };
}
