/**
 * LuxRoom AI — Extraction Module
 *
 * Inference path (auto-selected from settings):
 *
 *   LOCAL mode (default):
 *     1. hermes3          — Nous Research, best structured-output
 *     2. nous-hermes2     — solid fallback
 *     3. adrienbrault/nous-hermes2pro
 *     4. OLLAMA_MODEL     — user's configured model (default: qwen2.5)
 *     All models run CPU-only via Ollama — zero cloud fees, zero data egress.
 *
 *   CLOUD mode (for low-RAM devices):
 *     OpenAI-compatible endpoint (Groq, OpenRouter, Together AI, etc.)
 *     Uses CLOUD_API_URL + CLOUD_API_KEY + CLOUD_MODEL from settings.
 *     The API key never leaves the device — it is sent only to the chosen endpoint.
 */

import fetch from 'node-fetch';
import { getSettings } from '../../settings.js';

const MAX_HTML_CHARS = 8000;
const MAX_RETRIES    = 1;
const HERMES_MODELS  = ['hermes3', 'nous-hermes2', 'adrienbrault/nous-hermes2pro'];

const EXTRACTION_PROMPT = `You are a structured data extractor for housing listings.

Extract the following fields from the listing HTML provided.
Return ONLY a valid JSON object with exactly these fields. No markdown. No preamble.
Use "unknown" for any field that cannot be determined.

{
  "location": "neighbourhood, city or town",
  "insideLuxembourg": true or false,
  "rentTotal": "€X/month or £X/month" or "unknown",
  "availability": "YYYY-MM-DD or immediately" or "unknown",
  "domiciliationFlag": "ok" or "refused" or "unknown",
  "estimatedCommute": "unknown",
  "furnished": true or false or "unknown",
  "smokingAllowed": true or false or "unknown",
  "genderPolicy": "female-only" or "mixed" or "male-only" or "unknown",
  "listingTitle": "title of the listing",
  "contactName": "name of landlord/agency or unknown",
  "contactMethod": "email address, phone, or contact form URL or unknown",
  "rawDescription": "full description text, max 500 chars"
}

Note: estimatedCommute is always "unknown" — calculated downstream.`;

// ---------------------------------------------------------------------------
// JSON parsing
// ---------------------------------------------------------------------------

function parseJson(text) {
  try { return JSON.parse(text.trim()); } catch (_) {}
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) { try { return JSON.parse(fence[1].trim()); } catch (_) {} }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch (_) {} }
  return null;
}

function prepareHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .slice(0, MAX_HTML_CHARS);
}

// ---------------------------------------------------------------------------
// LOCAL: Ollama
// ---------------------------------------------------------------------------

let _resolvedModel = null;

async function isModelAvailable(baseUrl, model) {
  try {
    const res = await fetch(`${baseUrl}/api/show`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveOllamaModel(baseUrl, configuredModel) {
  if (_resolvedModel) return _resolvedModel;
  // Prefer the model the user explicitly configured in setup, if available.
  if (configuredModel && await isModelAvailable(baseUrl, configuredModel)) {
    console.log(`[extractor] Using configured model: ${configuredModel}`);
    _resolvedModel = configuredModel;
    return configuredModel;
  }
  // Otherwise fall back to probing the known-good Hermes structured-output models.
  for (const m of HERMES_MODELS) {
    if (await isModelAvailable(baseUrl, m)) {
      console.log(`[extractor] Configured model unavailable — Hermes model available: ${m}`);
      _resolvedModel = m;
      return m;
    }
  }
  console.log(`[extractor] No Hermes fallback found — using ${configuredModel}`);
  _resolvedModel = configuredModel;
  return configuredModel;
}

async function callOllama(baseUrl, model, prompt) {
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt,
      stream: false,
      options: { num_gpu: 0 },   // CPU-only — no CUDA required
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Ollama ${model} error ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.response ?? '';
}

async function extractLocal(prompt, settings) {
  const baseUrl = settings.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model   = await resolveOllamaModel(baseUrl, settings.OLLAMA_MODEL || 'qwen2.5');
  return callOllama(baseUrl, model, prompt);
}

// ---------------------------------------------------------------------------
// CLOUD: OpenAI-compatible endpoint (Groq, OpenRouter, Together, etc.)
// ---------------------------------------------------------------------------

async function callCloud(apiUrl, apiKey, model, prompt) {
  const endpoint = apiUrl.replace(/\/$/, '') + '/chat/completions';
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: 'You extract structured JSON from housing listing HTML. Return only valid JSON, no markdown.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cloud API error ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function extractCloud(prompt, settings) {
  const url   = settings.CLOUD_API_URL;
  const key   = settings.CLOUD_API_KEY;
  const model = settings.CLOUD_MODEL;

  if (!url || !key || !model) {
    throw new Error('Cloud inference configured but CLOUD_API_URL / CLOUD_API_KEY / CLOUD_MODEL not set');
  }

  console.log(`[extractor] Cloud inference: ${url} model=${model}`);
  return callCloud(url, key, model, prompt);
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export async function extractListing(rawRecord) {
  const { url, html, timestamp, source } = rawRecord;

  if (!html) {
    console.error(`[extractor] No HTML for ${url}`);
    return null;
  }

  const settings = getSettings();
  const mode     = settings.INFERENCE_MODE === 'cloud' ? 'cloud' : 'local';
  const prepared = prepareHtml(html);

  const prompt = `${EXTRACTION_PROMPT}

---
Listing URL: ${url || 'unknown'}
Source: ${source || 'unknown'}
Timestamp: ${timestamp || 'unknown'}

HTML Content:
${prepared}`;

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) console.warn(`[extractor] Retry ${attempt}/${MAX_RETRIES} for ${url}`);
    try {
      const text   = mode === 'cloud'
        ? await extractCloud(prompt, settings)
        : await extractLocal(prompt, settings);

      const parsed = parseJson(text);
      if (!parsed) {
        lastError = new Error(`JSON parse failed: ${text.slice(0, 200)}`);
        console.error(`[extractor] ${lastError.message}`);
        continue;
      }

      parsed.estimatedCommute = 'unknown';
      console.log(`[extractor] OK (${mode}): ${url}`);
      return parsed;
    } catch (err) {
      lastError = err;
      console.error(`[extractor] Attempt ${attempt + 1} failed for ${url}: ${err.message}`);
      // If Ollama says model not found, clear cache so next attempt re-probes
      if (mode === 'local' && /not found|does not exist/i.test(err.message)) {
        _resolvedModel = null;
      }
    }
  }

  console.error(`[extractor] All attempts failed for ${url}: ${lastError?.message}`);
  return null;
}

export function resetModelCache() { _resolvedModel = null; }
