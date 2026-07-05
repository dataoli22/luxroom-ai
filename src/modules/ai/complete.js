/**
 * LuxRoom AI — shared LLM completion layer.
 *
 * One place that knows how to talk to every supported provider, with a
 * free-first default (Ollama) and a safe fallback: if a paid/cloud provider is
 * selected but its key is missing, we fall back to free local Ollama so the app
 * never silently stops working — or starts costing money by surprise.
 *
 * Both the analyser (JSON output) and the messenger (prose drafts) use this.
 * Pass { json: true } for structured output, { json: false } for prose.
 */

import Anthropic from "@anthropic-ai/sdk";
import fetch from "node-fetch";

function resolveProvider(settings) {
  let provider = (settings.aiProvider || "ollama").toLowerCase();
  const hasAnthropic = settings.anthropicApiKey || settings.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (provider === "openai" && !settings.openaiApiKey) {
    console.warn("[ai] OpenAI selected but no API key — falling back to local Ollama");
    provider = "ollama";
  } else if (provider === "gemini" && !settings.geminiApiKey) {
    console.warn("[ai] Gemini selected but no API key — falling back to local Ollama");
    provider = "ollama";
  } else if (provider === "groq" && !settings.groqApiKey) {
    console.warn("[ai] Groq selected but no API key — falling back to local Ollama");
    provider = "ollama";
  } else if (provider === "anthropic" && !hasAnthropic) {
    console.warn("[ai] Anthropic selected but no API key — falling back to local Ollama");
    provider = "ollama";
  }
  return provider;
}

async function callAnthropic(settings, systemPrompt, userMessage, { maxTokens }) {
  const client = new Anthropic({
    apiKey: settings.anthropicApiKey || settings.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
  });
  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  return response.content?.[0]?.text ?? "";
}

async function callOpenAICompatible(url, apiKey, model, systemPrompt, userMessage, { json, maxTokens }) {
  const body = {
    model,
    temperature: 0,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  };
  if (json) body.response_format = { type: "json_object" };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${url} error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

async function callGemini(settings, systemPrompt, userMessage, { json, maxTokens }) {
  const model = settings.geminiModel || "gemini-2.0-flash";
  const generationConfig = { temperature: 0, maxOutputTokens: maxTokens };
  if (json) generationConfig.responseMimeType = "application/json";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${settings.geminiApiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userMessage }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(60000),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
}

async function callOllama(settings, model, systemPrompt, userMessage, { json, maxTokens }) {
  const baseUrl = settings.OLLAMA_BASE_URL || "http://localhost:11434";
  const headers = { "Content-Type": "application/json" };
  if (settings.OLLAMA_API_KEY) headers.Authorization = `Bearer ${settings.OLLAMA_API_KEY}`;
  const body = {
    model,
    prompt: systemPrompt + "\n\n" + userMessage,
    stream: false,
    options: { num_gpu: 0, temperature: 0, num_predict: maxTokens },
  };
  if (json) body.format = "json";
  const res = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ollama error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.response ?? "";
}

/**
 * Run a completion through the user's selected provider.
 * @returns {Promise<string>} raw model text (throws on failure)
 */
export async function complete(settings, systemPrompt, userMessage, opts = {}) {
  const o = { json: false, maxTokens: 1024, ...opts };
  const provider = resolveProvider(settings);
  switch (provider) {
    case "openai":
      return callOpenAICompatible("https://api.openai.com/v1/chat/completions", settings.openaiApiKey, settings.openaiModel || "gpt-4o", systemPrompt, userMessage, o);
    case "groq":
      return callOpenAICompatible("https://api.groq.com/openai/v1/chat/completions", settings.groqApiKey, settings.groqModel || "llama-3.3-70b-versatile", systemPrompt, userMessage, o);
    case "gemini":
      return callGemini(settings, systemPrompt, userMessage, o);
    case "hermes":
      return callOllama(settings, settings.hermesModel || "hermes3", systemPrompt, userMessage, o);
    case "anthropic":
      return callAnthropic(settings, systemPrompt, userMessage, o);
    case "ollama":
    default:
      return callOllama(settings, settings.OLLAMA_MODEL || "qwen2.5", systemPrompt, userMessage, o);
  }
}
