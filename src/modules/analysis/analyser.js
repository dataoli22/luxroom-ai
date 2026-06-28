import Anthropic from "@anthropic-ai/sdk";
import { getSettings } from "../../settings.js";

const client = new Anthropic();

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

  // Luxembourg-specific commute intelligence
  const luxembourgContext = city.toLowerCase().includes("luxembourg") ? `

COMMUTE CONTEXT FOR LUXEMBOURG:
- The CFL Line 10 north corridor (Mersch, Ettelbruck, Schieren, Lintgen, Lorentzweiler) connects DIRECTLY to Pfaffenthal-Kirchberg station — Mersch is only ~25 min, Ettelbruck ~35 min. These northern towns are UNDERRATED and should score well on commute despite being outside Luxembourg City.
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
  const systemPrompt = buildSystemPrompt(settings.profile);
  const userMessage = buildUserMessage(extractedRecord);

  let response;
  try {
    response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });
  } catch (err) {
    console.error("[analyser] API call failed:", err.message);
    return null;
  }

  const text = response.content?.[0]?.text;
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
