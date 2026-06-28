import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const DEFAULT_PROFILE = {
  name: '',
  languages: ['en'],
  housingType: 'room',
  furnished: 'any',
  smokingAllowed: false,
  genderPolicy: 'any',
  city: '',
  preferredAreas: '',
  commuteTo: '',
  maxCommuteMins: 75,
  maxBudget: '',
  currency: 'EUR',
  moveInBy: '',
  domiciliationRequired: false,
  petsAllowed: false,
  parkingRequired: false,
  additionalNotes: '',
  onboardingDone: false,
};

const DEFAULT_SETTINGS = {
  ANTHROPIC_API_KEY: '',
  TELEGRAM_BOT_TOKEN: '',
  TELEGRAM_CHAT_ID: '',
  OLLAMA_BASE_URL: 'http://localhost:11434',
  OLLAMA_MODEL: 'qwen2.5-vl',
  SMTP_HOST: 'smtp.gmail.com',
  SMTP_PORT: '587',
  SMTP_USER: '',
  SMTP_PASS: '',
  SMTP_FROM: '',
  NOTIFICATION_EMAIL: '',
  CRAWL_INTERVAL_HOURS: '3',
  OPPORTUNITY_THRESHOLD: '8',
  ENABLE_EMAIL_NOTIFICATIONS: 'true',
  ENABLE_TELEGRAM_NOTIFICATIONS: 'true',
  ENABLE_DESKTOP_NOTIFICATIONS: 'true',
  // Inference mode — 'local' uses Ollama on-device; 'cloud' uses OpenAI-compatible API
  INFERENCE_MODE: 'local',
  CLOUD_API_URL: '',
  CLOUD_API_KEY: '',
  CLOUD_MODEL: '',
  // Approval mode — 'manual' = always review before sending; 'auto' = send immediately if score >= threshold
  APPROVAL_MODE: 'manual',
  AUTO_APPROVE_THRESHOLD: '9',
  profile: DEFAULT_PROFILE,
};

function isElectron() {
  if (process.versions && process.versions.electron) return true;
  if (process.execPath && process.execPath.toLowerCase().includes('electron')) return true;
  return false;
}

function getSettingsFilePath() {
  // main.js sets ELECTRON_USER_DATA before importing any modules
  if (process.env.ELECTRON_USER_DATA) {
    return path.join(process.env.ELECTRON_USER_DATA, 'settings.json');
  }
  // CLI fallback: settings.json next to project root
  return path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'settings.json');
}

function readSettingsFile() {
  const filePath = getSettingsFilePath();
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeSettingsFile(data) {
  const filePath = getSettingsFilePath();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Returns merged default settings + saved settings (Electron mode)
 * or process.env values mapped to the same keys (CLI mode).
 */
export function getSettings() {
  if (isElectron()) {
    const saved = readSettingsFile();
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      profile: { ...DEFAULT_PROFILE, ...(saved.profile ?? {}) },
    };
  }

  // CLI mode: read from process.env, fall back to defaults
  const result = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    result[key] = process.env[key] !== undefined ? process.env[key] : DEFAULT_SETTINGS[key];
  }
  return result;
}

/**
 * Merges partial settings into the saved settings file (Electron mode only).
 * In CLI mode this is a no-op (env vars are not writable this way).
 */
export function saveSettings(partial) {
  if (!isElectron()) {
    // In CLI mode apply to process.env as best-effort
    for (const [key, value] of Object.entries(partial)) {
      process.env[key] = String(value);
    }
    return;
  }

  const current = readSettingsFile();
  const updated = { ...current, ...partial };
  writeSettingsFile(updated);
}

/**
 * Copies all settings keys into process.env.
 * Call this early in main.js so that all modules that read process.env get the values.
 */
export function applyToEnv(settings) {
  for (const [key, value] of Object.entries(settings)) {
    if (value !== undefined && value !== null) {
      process.env[key] = String(value);
    }
  }
}
