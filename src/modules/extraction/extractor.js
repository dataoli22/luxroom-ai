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
import { complete } from '../ai/complete.js';

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

// An Ollama account key (optional) unlocks Ollama's hosted models. Local
// servers ignore the header, so it is always safe to send when present.
function ollamaHeaders(apiKey) {
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

async function isModelAvailable(baseUrl, model, apiKey) {
  try {
    const res = await fetch(`${baseUrl}/api/show`, {
      method: 'POST',
      headers: ollamaHeaders(apiKey),
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function resolveOllamaModel(baseUrl, configuredModel, apiKey) {
  if (_resolvedModel) return _resolvedModel;
  // Prefer the model the user explicitly configured in setup, if available.
  if (configuredModel && await isModelAvailable(baseUrl, configuredModel, apiKey)) {
    console.log(`[extractor] Using configured model: ${configuredModel}`);
    _resolvedModel = configuredModel;
    return configuredModel;
  }
  // Otherwise fall back to probing the known-good Hermes structured-output models.
  for (const m of HERMES_MODELS) {
    if (await isModelAvailable(baseUrl, m, apiKey)) {
      console.log(`[extractor] Configured model unavailable — Hermes model available: ${m}`);
      _resolvedModel = m;
      return m;
    }
  }
  console.log(`[extractor] No Hermes fallback found — using ${configuredModel}`);
  _resolvedModel = configuredModel;
  return configuredModel;
}

async function callOllama(baseUrl, model, prompt, apiKey) {
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: ollamaHeaders(apiKey),
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
  const apiKey  = settings.OLLAMA_API_KEY;
  const model   = await resolveOllamaModel(baseUrl, settings.OLLAMA_MODEL || 'qwen2.5', apiKey);
  return callOllama(baseUrl, model, prompt, apiKey);
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
  const prepared = prepareHtml(html);

  const userMessage = `Listing URL: ${url || 'unknown'}
Source: ${source || 'unknown'}
Timestamp: ${timestamp || 'unknown'}

HTML Content:
${prepared}`;

  let lastError = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) console.warn(`[extractor] Retry ${attempt}/${MAX_RETRIES} for ${url}`);
    try {
      // Route through the same provider the user configured (Ollama Cloud, Groq,
      // local Ollama, …) — NOT a hardcoded local-only path.
      const text   = await complete(settings, EXTRACTION_PROMPT, userMessage, { json: true, maxTokens: 1024 });

      const parsed = parseJson(text);
      if (!parsed) {
        lastError = new Error(`JSON parse failed: ${(text || '').slice(0, 200)}`);
        console.error(`[extractor] ${lastError.message}`);
        continue;
      }

      parsed.estimatedCommute = 'unknown';
      console.log(`[extractor] OK: ${url}`);
      return parsed;
    } catch (err) {
      lastError = err;
      console.error(`[extractor] Attempt ${attempt + 1} failed for ${url}: ${err.message}`);
    }
  }

  console.error(`[extractor] All attempts failed for ${url}: ${lastError?.message}`);
  return null;
}

export function resetModelCache() { _resolvedModel = null; }
