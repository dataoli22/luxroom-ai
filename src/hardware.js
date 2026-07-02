/**
 * LuxRoom AI — Hardware Detection
 *
 * Detects CPU, RAM, and GPU to determine the optimal compute tier and
 * recommend the best local Ollama model(s) for the user's device.
 *
 * Runs in the Electron main process (Node.js), never in the renderer.
 */

import os from 'os';
import { execSync } from 'child_process';

// ---------------------------------------------------------------------------
// GPU detection
// ---------------------------------------------------------------------------

function detectGpus() {
  const platform = process.platform;
  try {
    if (platform === 'win32') {
      const out = execSync(
        'wmic path win32_VideoController get Name,AdapterRAM /format:list',
        { timeout: 6000, encoding: 'utf8', stdio: ['pipe','pipe','ignore'] }
      );
      const entries = [];
      let current = {};
      for (const line of out.split(/\r?\n/)) {
        const [key, ...rest] = line.split('=');
        const val = rest.join('=').trim();
        if (!val) { if (current.name) { entries.push(current); current = {}; } continue; }
        if (key === 'AdapterRAM') current.vram = Math.round(Number(val) / 1024 / 1024);
        if (key === 'Name') current.name = val;
      }
      if (current.name) entries.push(current);
      return entries;
    }

    if (platform === 'darwin') {
      const out = execSync(
        'system_profiler SPDisplaysDataType 2>/dev/null | grep -E "Chipset Model|VRAM"',
        { timeout: 6000, encoding: 'utf8', shell: true }
      );
      return out.split('\n')
        .filter(l => l.includes('Chipset Model:'))
        .map(l => ({ name: l.replace('Chipset Model:', '').trim(), vram: null }));
    }

    if (platform === 'linux') {
      try {
        const out = execSync(
          'lspci | grep -i "vga\\|3d\\|display" 2>/dev/null',
          { timeout: 6000, encoding: 'utf8' }
        );
        return out.split('\n').filter(Boolean).map(l => ({ name: l, vram: null }));
      } catch {
        return [];
      }
    }
  } catch {
    // Ignore detection errors — fall back to empty
  }
  return [];
}

function hasDiscreteGpu(gpus) {
  return gpus.some(g =>
    /nvidia|geforce|rtx|gtx|quadro|radeon rx|radeon pro|radeon r[579]|arc a[357]/i.test(g.name) &&
    !/intel iris|intel uhd|intel hd|intel arc a3[^0-9]/i.test(g.name)
  );
}

function getDiscreteVramMB(gpus) {
  const discrete = gpus.find(g =>
    /nvidia|geforce|rtx|gtx|radeon rx|arc a[357]/i.test(g.name) &&
    !/intel iris|intel uhd|intel hd/i.test(g.name)
  );
  return discrete?.vram ?? 0;
}

// ---------------------------------------------------------------------------
// Compute tier
// ---------------------------------------------------------------------------

/**
 * @typedef {'high' | 'medium' | 'low' | 'cloud'} ComputeTier
 *
 * high   — 16GB+ RAM with discrete GPU, or 32GB+ RAM
 * medium — 12–16GB RAM or 8GB+ RAM with a mid-range discrete GPU
 * low    — 6–12GB RAM, no discrete GPU (can run 3B models comfortably)
 * cloud  — < 6GB RAM, or shared memory only; recommend API-based inference
 */
function getTier(totalRamGB, discrete, vramMB) {
  if (discrete && vramMB >= 6000) return 'high';
  if (discrete && vramMB >= 3000) return 'medium';
  if (totalRamGB >= 32)           return 'high';
  if (totalRamGB >= 16)           return 'medium';
  if (totalRamGB >= 8)            return 'low';
  return 'cloud';
}

// ---------------------------------------------------------------------------
// Model recommendations per tier
// ---------------------------------------------------------------------------

const MODEL_RECS = {
  high: [
    { model: 'hermes3:8b',      size: '4.7 GB', note: 'Best quality — Nous Research Hermes 3 8B' },
    { model: 'qwen2.5:7b',      size: '4.4 GB', note: 'Great general-purpose alternative' },
    { model: 'nous-hermes2:7b', size: '3.8 GB', note: 'Lightweight Hermes option' },
  ],
  medium: [
    { model: 'hermes3',         size: '4.7 GB', note: 'Hermes 3 8B — may be slow, but works' },
    { model: 'qwen2.5:7b',      size: '4.4 GB', note: 'Good balance of speed and quality' },
    { model: 'nous-hermes2',    size: '3.8 GB', note: 'Reliable Hermes 2 (7B)' },
  ],
  low: [
    { model: 'qwen2.5:3b',      size: '1.9 GB', note: 'Recommended — fast on CPU, good JSON output' },
    { model: 'hermes3:2b',      size: '1.5 GB', note: 'Smallest Hermes option' },
    { model: 'phi3:mini',       size: '2.2 GB', note: 'Microsoft Phi-3 Mini, very efficient' },
  ],
  cloud: [
    { model: 'qwen2.5:3b',      size: '1.9 GB', note: 'Smallest usable local model (borderline)' },
    { model: 'hermes3:2b',      size: '1.5 GB', note: 'Try this if RAM allows' },
  ],
};

const CLOUD_PRESETS = [
  {
    label: 'Groq (Recommended — free tier)',
    url: 'https://api.groq.com/openai/v1',
    model: 'gemma2-9b-it',
    note: 'Free tier: 14 400 requests/day. Sign up at console.groq.com',
    models: ['gemma2-9b-it', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  },
  {
    label: 'OpenRouter',
    url: 'https://openrouter.ai/api/v1',
    model: 'nousresearch/hermes-3-llama-3.1-8b:free',
    note: 'Free models available. Sign up at openrouter.ai',
    models: ['nousresearch/hermes-3-llama-3.1-8b:free', 'meta-llama/llama-3.2-3b-instruct:free'],
  },
  {
    label: 'Together AI',
    url: 'https://api.together.xyz/v1',
    model: 'togethercomputer/llama-2-7b-chat',
    note: '$25 free credit on signup. together.ai',
    models: ['togethercomputer/llama-2-7b-chat', 'mistralai/Mistral-7B-Instruct-v0.2'],
  },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function detectHardware() {
  const cpus        = os.cpus();
  const totalRamGB  = Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10;
  const freeRamGB   = Math.round(os.freemem()  / 1024 / 1024 / 1024 * 10) / 10;
  const cpuModel    = cpus[0]?.model?.trim() ?? 'Unknown CPU';
  const cpuCores    = cpus.length;

  const gpus        = detectGpus();
  const discrete    = hasDiscreteGpu(gpus);
  const vramMB      = getDiscreteVramMB(gpus);
  const tier        = getTier(totalRamGB, discrete, vramMB);

  return {
    cpu:          cpuModel,
    cpuCores,
    totalRamGB,
    freeRamGB,
    gpus:         gpus.map(g => g.name),
    hasDiscreteGpu: discrete,
    discreteVramMB: vramMB,
    tier,
    tierLabel:    { high: 'High', medium: 'Medium', low: 'Low (CPU-only)', cloud: 'Cloud Recommended' }[tier],
    modelRecs:    MODEL_RECS[tier],
    cloudPresets: CLOUD_PRESETS,
    warning: tier === 'cloud'
      ? `Only ${totalRamGB} GB RAM detected. Running 7B models risks Out-Of-Memory crashes. A free cloud inference API (e.g. Groq) is strongly recommended.`
      : tier === 'low'
      ? `${totalRamGB} GB RAM detected. Stick to 3B models (< 2 GB) for stable performance. 7B models may run slowly or crash.`
      : null,
  };
}
