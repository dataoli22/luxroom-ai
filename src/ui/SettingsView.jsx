import { useState, useEffect } from 'react';
import SourceLogin from './SourceLogin.jsx';

const inputStyle = {
  background: '#0f0f13',
  border: '1px solid #2a2a3a',
  color: '#e8e8f0',
  padding: '8px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
};

const labelStyle = {
  display: 'block',
  color: '#a0a0b8',
  fontSize: '12px',
  fontWeight: '600',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const helperStyle = {
  color: '#5a5a7a',
  fontSize: '12px',
  marginTop: '4px',
};

const sectionStyle = {
  marginBottom: '32px',
};

const sectionHeaderStyle = {
  color: '#c8b8f0',
  fontSize: '14px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  marginBottom: '16px',
  paddingBottom: '8px',
  borderBottom: '1px solid #1e1e2e',
};

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '16px',
};

const infoBoxStyle = {
  background: '#0d0d1a',
  border: '1px solid #2a2a4a',
  borderRadius: '8px',
  padding: '12px 16px',
  color: '#8080a8',
  fontSize: '13px',
  lineHeight: '1.6',
  gridColumn: '1 / -1',
};

const toggleRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  marginBottom: '12px',
};

const checkboxStyle = {
  width: '16px',
  height: '16px',
  accentColor: '#8b5cf6',
  cursor: 'pointer',
};

const linkBtnStyle = {
  background: 'none', border: 'none', color: '#818cf8',
  fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0,
  fontWeight: 500,
};

// Free-first ordering. `cost` drives the little tag under each picker button.
const PROVIDERS = [
  { id: 'auto',      label: 'Auto',      cost: 'Recommended' },
  { id: 'ollama',    label: 'Ollama',    cost: 'Free · Local' },
  { id: 'hermes',    label: 'Hermes',    cost: 'Free · Local' },
  { id: 'groq',      label: 'Groq',      cost: 'Free tier' },
  { id: 'gemini',    label: 'Gemini',    cost: 'Free tier' },
  { id: 'anthropic', label: 'Anthropic', cost: 'Paid' },
  { id: 'openai',    label: 'OpenAI',    cost: 'Paid' },
];
const costColor = (cost) => cost.startsWith('Free') ? '#6ee7b7' : cost === 'Recommended' ? '#c4b5fd' : '#f0a868';

// The UI uses camelCase field names, but the backend (notifier, pipeline,
// extractor) reads these UPPERCASE env-style keys. Map between them on save/load
// so edits in Settings actually take effect. (Provider keys like anthropicApiKey
// already match what the analyser reads, so they're not in this map.)
const KEY_MAP = {
  ollamaUrl: 'OLLAMA_BASE_URL',
  ollamaModel: 'OLLAMA_MODEL',
  smtpHost: 'SMTP_HOST',
  smtpPort: 'SMTP_PORT',
  smtpUser: 'SMTP_USER',
  smtpPassword: 'SMTP_PASS',
  smtpFrom: 'SMTP_FROM',
  notificationEmail: 'NOTIFICATION_EMAIL',
  telegramBotToken: 'TELEGRAM_BOT_TOKEN',
  telegramChatId: 'TELEGRAM_CHAT_ID',
  crawlIntervalHours: 'CRAWL_INTERVAL_HOURS',
  opportunityThreshold: 'OPPORTUNITY_THRESHOLD',
  emailEnabled: 'ENABLE_EMAIL_NOTIFICATIONS',
  telegramEnabled: 'ENABLE_TELEGRAM_NOTIFICATIONS',
  desktopNotificationsEnabled: 'ENABLE_DESKTOP_NOTIFICATIONS',
};

function Field({ label, helper, children, fullWidth }) {
  return (
    <div style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <label style={labelStyle}>{label}</label>
      {children}
      {helper && <p style={helperStyle}>{helper}</p>}
    </div>
  );
}

export default function SettingsView({ onEditProfile }) {
  const [form, setForm] = useState({
    aiProvider: 'auto',
    anthropicApiKey: '',
    openaiApiKey: '',
    openaiModel: 'gpt-4o',
    geminiApiKey: '',
    geminiModel: 'gemini-2.0-flash',
    groqApiKey: '',
    groqModel: 'llama-3.3-70b-versatile',
    hermesModel: 'hermes3',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5-vl',
    OLLAMA_API_KEY: '',
    telegramEnabled: false,
    telegramBotToken: '',
    telegramChatId: '',
    emailEnabled: false,
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpFrom: '',
    notificationEmail: '',
    desktopNotificationsEnabled: false,
    crawlIntervalHours: 6,
    opportunityThreshold: 8,
  });

  const [toast, setToast] = useState(null);
  const [emailTestResult, setEmailTestResult] = useState(null);
  const [emailTesting, setEmailTesting] = useState(false);
  const [pull, setPull] = useState(null); // { model, pct, msg, error, done }

  async function downloadModel(name) {
    if (!name || !name.trim()) return;
    const model = name.trim();
    setPull({ model, pct: null, msg: 'Starting…', error: false, done: false });
    const unsub = window.luxroom?.setup?.onProgress(({ phase, message, pct, error }) => {
      if (phase !== 'pull') return;
      setPull(p => ({ ...(p || {}), model, msg: message, pct: pct ?? p?.pct, error: !!error }));
    });
    try {
      await window.luxroom?.setup?.pullModel(model);
      setPull({ model, pct: 100, msg: `${model} is ready ✓`, error: false, done: true });
    } catch (e) {
      setPull({ model, pct: null, msg: e?.message || 'Download failed', error: true, done: false });
    } finally {
      unsub?.();
    }
  }

  function renderPull(name, sizeHint) {
    const active = pull && pull.model === name;
    const busy = active && !pull.done && !pull.error;
    return (
      <div style={{ gridColumn: '1 / -1' }}>
        <button
          onClick={() => downloadModel(name)}
          disabled={busy}
          style={{
            background: busy ? '#2a2a4a' : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            border: 'none', color: '#fff', padding: '10px 18px', borderRadius: 8,
            fontSize: 14, fontWeight: 700, cursor: busy ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Downloading…' : `⬇ Download ${name} now — no terminal needed`}
        </button>
        <span style={{ color: '#5a5a7a', fontSize: 12, marginLeft: 12 }}>{sizeHint}</span>
        {active && (
          <div style={{ marginTop: 10 }}>
            {pull.pct != null && !pull.done && (
              <div style={{ height: 5, background: '#1a1a2a', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                <div style={{ height: '100%', background: '#7c5cbf', width: `${pull.pct}%`, transition: 'width 0.4s' }} />
              </div>
            )}
            <div style={{ fontSize: 12, fontFamily: 'monospace', color: pull.error ? '#f87171' : pull.done ? '#4ade80' : '#9090b8' }}>
              {pull.msg}
            </div>
            {pull.error && (
              <div style={{ fontSize: 12, color: '#a89060', marginTop: 4 }}>
                Make sure Ollama is installed and running, then try again.
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  useEffect(() => {
    window.luxroom?.settings.get().then((saved) => {
      if (!saved) return;
      // Read the backend's UPPERCASE values back into the camelCase form fields.
      const mapped = { ...saved };
      for (const [camel, upper] of Object.entries(KEY_MAP)) {
        if (saved[upper] !== undefined) {
          mapped[camel] = camel === 'emailEnabled' || camel === 'telegramEnabled' || camel === 'desktopNotificationsEnabled'
            ? saved[upper] === 'true' || saved[upper] === true
            : saved[upper];
        }
      }
      setForm((prev) => ({ ...prev, ...mapped }));
    }).catch(() => {});
  }, []);

  function set(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function showToast(msg, isError) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSave() {
    try {
      // Translate camelCase UI fields → the UPPERCASE keys the backend reads.
      const payload = { ...form };
      // App passwords (esp. Gmail's) are pasted with spaces — strip them.
      if (payload.smtpPassword) payload.smtpPassword = payload.smtpPassword.replace(/\s+/g, '');
      for (const [camel, upper] of Object.entries(KEY_MAP)) {
        if (form[camel] !== undefined) {
          const v = form[camel];
          payload[upper] = typeof v === 'boolean' ? String(v) : v;
          delete payload[camel];
        }
      }
      await window.luxroom.settings.save(payload);
      showToast('Settings saved', false);
    } catch (err) {
      showToast('Failed to save: ' + (err.message || err), true);
    }
  }

  async function handleTestEmail() {
    setEmailTestResult(null);
    setEmailTesting(true);
    try {
      const config = {
        host: form.smtpHost,
        port: form.smtpPort,
        user: form.smtpUser || form.notificationEmail,
        pass: (form.smtpPassword || '').replace(/\s+/g, ''),
        from: form.smtpFrom || form.notificationEmail,
      };
      const result = await window.luxroom.email.test(form.notificationEmail, config);
      if (result && result.ok) {
        setEmailTestResult({ ok: true, msg: 'Test email sent — check your inbox.' });
      } else {
        setEmailTestResult({ ok: false, msg: (result && result.error) || 'Failed to send test email.' });
      }
    } catch (err) {
      setEmailTestResult({ ok: false, msg: err.message || String(err) });
    } finally {
      setEmailTesting(false);
    }
  }

  return (
    <div style={{
      height: '100%',
      overflowY: 'auto',
    }}>
      <div style={{
        padding: '32px',
        maxWidth: '780px',
        margin: '0 auto',
        color: '#e8e8f0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        position: 'relative',
      }}>
      <h2 style={{ color: '#e8e8f0', fontSize: '22px', fontWeight: '700', marginBottom: '28px', marginTop: 0 }}>
        Settings
      </h2>

      {/* Section 0 — Search Profile */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Search Profile</div>
        <div style={{
          background: '#0d0d1a',
          border: '1px solid #2a2a4a',
          borderRadius: '10px',
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}>
          <div>
            <div style={{ color: '#e8e8f0', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
              {form.profile?.name ? `${form.profile.name}'s search profile` : 'No profile set'}
            </div>
            <div style={{ color: '#8080a8', fontSize: '13px', lineHeight: '1.5' }}>
              {[
                form.profile?.city && form.profile.city,
                form.profile?.maxBudget && `${form.profile.currency || '€'}${form.profile.maxBudget}/mo max`,
                form.profile?.commuteTo && `→ ${form.profile.commuteTo}`,
              ].filter(Boolean).join(' · ') || 'Complete the onboarding wizard to tune the AI analysis and message drafts for you.'}
            </div>
          </div>
          <button
            onClick={onEditProfile}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: '1px solid #7c3aed',
              background: 'transparent',
              color: '#c4b5fd',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            Edit Profile
          </button>
        </div>
      </div>

      {/* Section 1 — AI & Analysis */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>AI &amp; Analysis</div>

        <p style={{ color: '#7a7a9a', fontSize: 13, margin: '0 0 14px', lineHeight: 1.6 }}>
          Choose who analyses each listing. <span style={{ color: '#6ee7b7' }}>Local (Ollama / Hermes)</span> runs on your
          laptop for free. <span style={{ color: '#6ee7b7' }}>Groq and Gemini</span> have generous free tiers.
          Anthropic and OpenAI are paid per listing.
        </p>

        {/* Provider picker */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {PROVIDERS.map(p => {
            const active = form.aiProvider === p.id;
            return (
              <button
                key={p.id}
                onClick={() => set('aiProvider', p.id)}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2,
                  padding: '7px 16px', borderRadius: 12, cursor: 'pointer',
                  border: `1px solid ${active ? '#7c3aed' : '#2a2a3a'}`,
                  background: active ? '#7c3aed' : 'transparent',
                  transition: 'all 0.15s',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? '#fff' : '#c8c8d8' }}>{p.label}</span>
                <span style={{ fontSize: 10, fontWeight: 600, color: active ? 'rgba(255,255,255,0.85)' : costColor(p.cost) }}>{p.cost}</span>
              </button>
            );
          })}
        </div>

        {/* Auto (recommended) */}
        {(form.aiProvider === 'auto' || !form.aiProvider) && (
          <div style={gridStyle}>
            <div style={{ gridColumn: '1 / -1', background: '#12102a', border: '1px solid #2a2060', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#c4b5fd', lineHeight: 1.6 }}>
              ✓ Recommended — LuxRoom automatically uses your best option. If you add a free <strong>Groq</strong> key (fast cloud),
              it's used automatically; otherwise it runs free on your device with <strong>Ollama</strong>. Nothing else to configure.
            </div>
            <div style={{ gridColumn: '1 / -1', fontSize: 12.5, color: '#8080a8', lineHeight: 1.7 }}>
              Priority: <span style={{ color: '#6ee7b7' }}>Groq (if key added)</span> → <span style={{ color: '#6ee7b7' }}>local Ollama</span>.
              To add a key, pick <strong style={{ color: '#c4b5fd' }}>Groq</strong> above, paste your free key, and Auto will use it.
            </div>
          </div>
        )}

        {/* Anthropic */}
        {form.aiProvider === 'anthropic' && (
          <div style={gridStyle}>
            <Field label="Anthropic API Key" fullWidth>
              <input type="password" style={inputStyle} value={form.anthropicApiKey}
                onChange={(e) => set('anthropicApiKey', e.target.value)} placeholder="sk-ant-..." />
            </Field>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://console.anthropic.com')}
                style={linkBtnStyle}>Get API key → console.anthropic.com</button>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://docs.anthropic.com')}
                style={linkBtnStyle}>Documentation →</button>
            </div>
          </div>
        )}

        {/* OpenAI */}
        {form.aiProvider === 'openai' && (
          <div style={gridStyle}>
            <Field label="OpenAI API Key" fullWidth>
              <input type="password" style={inputStyle} value={form.openaiApiKey || ''}
                onChange={(e) => set('openaiApiKey', e.target.value)} placeholder="sk-..." />
            </Field>
            <Field label="OpenAI Model" helper="e.g. gpt-4o, gpt-4o-mini">
              <input type="text" style={inputStyle} value={form.openaiModel || 'gpt-4o'}
                onChange={(e) => set('openaiModel', e.target.value)} placeholder="gpt-4o" />
            </Field>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://platform.openai.com/api-keys')}
                style={linkBtnStyle}>Get API key → platform.openai.com</button>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://platform.openai.com/docs')}
                style={linkBtnStyle}>Documentation →</button>
            </div>
          </div>
        )}

        {/* Gemini */}
        {form.aiProvider === 'gemini' && (
          <div style={gridStyle}>
            <Field label="Gemini API Key" fullWidth>
              <input type="password" style={inputStyle} value={form.geminiApiKey || ''}
                onChange={(e) => set('geminiApiKey', e.target.value)} placeholder="AIza..." />
            </Field>
            <Field label="Gemini Model" helper="e.g. gemini-2.0-flash, gemini-1.5-pro">
              <input type="text" style={inputStyle} value={form.geminiModel || 'gemini-2.0-flash'}
                onChange={(e) => set('geminiModel', e.target.value)} placeholder="gemini-2.0-flash" />
            </Field>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://aistudio.google.com/app/apikey')}
                style={linkBtnStyle}>Get API key → aistudio.google.com</button>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://ai.google.dev/gemini-api/docs')}
                style={linkBtnStyle}>Documentation →</button>
            </div>
          </div>
        )}

        {/* Ollama (local) */}
        {form.aiProvider === 'ollama' && (
          <div style={gridStyle}>
            <div style={{ gridColumn: '1 / -1', background: '#0d1a0d', border: '1px solid #1a4a1a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#6ee7b7' }}>
              ✓ Free — Ollama runs entirely on your device, no API key needed. Download your model below — no terminal needed.
            </div>
            {renderPull(form.ollamaModel || 'qwen2.5', 'one-time download')}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://ollama.com')}
                style={linkBtnStyle}>Install Ollama → ollama.com</button>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://ollama.com/library')}
                style={linkBtnStyle}>Browse models →</button>
            </div>
          </div>
        )}

        {/* Hermes (local, via Ollama) */}
        {form.aiProvider === 'hermes' && (
          <div style={gridStyle}>
            <div style={{ gridColumn: '1 / -1', background: '#0d1a0d', border: '1px solid #1a4a1a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#6ee7b7' }}>
              ✓ Free — Hermes runs locally through Ollama and is tuned for clean JSON output, so it's a great analysis model. Download it once with the button below — no terminal needed.
            </div>
            <Field label="Hermes Model" helper="Runs via Ollama, entirely on your device.">
              <input type="text" style={inputStyle} value={form.hermesModel || 'hermes3'}
                onChange={(e) => set('hermesModel', e.target.value)} placeholder="hermes3" />
            </Field>
            {renderPull(form.hermesModel || 'hermes3', '≈ 4.7 GB · one-time, a few minutes')}
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://ollama.com/library/hermes3')}
                style={linkBtnStyle}>About Hermes → ollama.com/library/hermes3</button>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://ollama.com')}
                style={linkBtnStyle}>Install Ollama →</button>
            </div>
          </div>
        )}

        {/* Groq (free cloud tier) */}
        {form.aiProvider === 'groq' && (
          <div style={gridStyle}>
            <div style={{ gridColumn: '1 / -1', background: '#0d1a0d', border: '1px solid #1a4a1a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#6ee7b7' }}>
              ✓ Free tier — Groq offers fast cloud inference with a generous free allowance. Create a free key, no card required.
            </div>
            <Field label="Groq API Key" fullWidth>
              <input type="password" style={inputStyle} value={form.groqApiKey || ''}
                onChange={(e) => set('groqApiKey', e.target.value)} placeholder="gsk_..." />
            </Field>
            <Field label="Groq Model" helper="e.g. llama-3.3-70b-versatile, llama-3.1-8b-instant">
              <input type="text" style={inputStyle} value={form.groqModel || 'llama-3.3-70b-versatile'}
                onChange={(e) => set('groqModel', e.target.value)} placeholder="llama-3.3-70b-versatile" />
            </Field>
            <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://console.groq.com/keys')}
                style={linkBtnStyle}>Get free API key → console.groq.com</button>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://console.groq.com/docs')}
                style={linkBtnStyle}>Documentation →</button>
            </div>
          </div>
        )}
      </div>

      {/* Section 2 — Local Extraction */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Local Extraction (Ollama)</div>
        <div style={gridStyle}>
          <Field label="Ollama URL">
            <input
              type="text"
              style={inputStyle}
              value={form.ollamaUrl}
              onChange={(e) => set('ollamaUrl', e.target.value)}
              placeholder="http://localhost:11434"
            />
          </Field>
          <Field label="Ollama Model">
            <input
              type="text"
              style={inputStyle}
              value={form.ollamaModel}
              onChange={(e) => set('ollamaModel', e.target.value)}
              placeholder="qwen2.5-vl"
            />
          </Field>
          <Field
            label="Ollama API Key (optional — highly recommended)"
            helper="Enables Ollama's hosted models when your laptop is low on memory. Get a free key at ollama.com → Settings → Keys. Leave blank to run fully local."
            fullWidth
          >
            <input
              type="password"
              style={inputStyle}
              value={form.OLLAMA_API_KEY || ''}
              onChange={(e) => set('OLLAMA_API_KEY', e.target.value)}
              placeholder="Paste your Ollama key — or leave blank for fully local"
            />
          </Field>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: -4 }}>
            <button onClick={() => window.luxroom?.shell?.openExternal('https://ollama.com/settings/keys')}
              style={linkBtnStyle}>Get your free Ollama key →</button>
          </div>
          <div style={infoBoxStyle}>
            Ollama runs locally on your CPU. Install from{' '}
            <span style={{ color: '#8b5cf6' }}>ollama.com</span>, then run:{' '}
            <code style={{ background: '#1a1a2e', padding: '2px 6px', borderRadius: '4px', color: '#c4b5fd' }}>
              ollama pull qwen2.5-vl
            </code>
          </div>
        </div>
      </div>

      {/* Section 2b — Connected Accounts */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Connected Accounts</div>
        <p style={{ color: '#7a7a9a', fontSize: 13, margin: '0 0 12px', lineHeight: 1.6 }}>
          Some sites only show listings to logged-in members. Connect once and LuxRoom AI scans them
          as you. If a source stops returning listings, your session may have expired — just reconnect.
        </p>
        <SourceLogin source="appartager" label="Appartager" />
      </div>

      {/* Section 3 — Notifications */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Notifications</div>

        {/* Telegram */}
        <div style={{ marginBottom: '20px', background: '#0d0d1a', borderRadius: '8px', padding: '16px', border: '1px solid #1e1e2e' }}>
          <div style={toggleRowStyle}>
            <input
              type="checkbox"
              style={checkboxStyle}
              id="telegramEnabled"
              checked={form.telegramEnabled}
              onChange={(e) => set('telegramEnabled', e.target.checked)}
            />
            <label htmlFor="telegramEnabled" style={{ color: '#e8e8f0', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              Enable Telegram
            </label>
          </div>
          {form.telegramEnabled && (
            <div style={{ ...gridStyle, marginTop: '8px' }}>
              <Field label="Telegram Bot Token" helper="Create a bot via @BotFather on Telegram">
                <input
                  type="password"
                  style={inputStyle}
                  value={form.telegramBotToken}
                  onChange={(e) => set('telegramBotToken', e.target.value)}
                  placeholder="123456:ABC-DEF..."
                />
              </Field>
              <Field label="Telegram Chat ID">
                <input
                  type="text"
                  style={inputStyle}
                  value={form.telegramChatId}
                  onChange={(e) => set('telegramChatId', e.target.value)}
                  placeholder="-100123456789"
                />
              </Field>
            </div>
          )}
        </div>

        {/* Email */}
        <div style={{ marginBottom: '20px', background: '#0d0d1a', borderRadius: '8px', padding: '16px', border: '1px solid #1e1e2e' }}>
          <div style={toggleRowStyle}>
            <input
              type="checkbox"
              style={checkboxStyle}
              id="emailEnabled"
              checked={form.emailEnabled}
              onChange={(e) => set('emailEnabled', e.target.checked)}
            />
            <label htmlFor="emailEnabled" style={{ color: '#e8e8f0', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              Enable Email
            </label>
          </div>
          {form.emailEnabled && (
            <div style={{ ...gridStyle, marginTop: '8px' }}>
              <Field label="SMTP Host">
                <input
                  type="text"
                  style={inputStyle}
                  value={form.smtpHost}
                  onChange={(e) => set('smtpHost', e.target.value)}
                  placeholder="smtp.gmail.com"
                />
              </Field>
              <Field label="SMTP Port">
                <input
                  type="number"
                  style={inputStyle}
                  value={form.smtpPort}
                  onChange={(e) => set('smtpPort', Number(e.target.value))}
                  placeholder="587"
                />
              </Field>
              <Field label="SMTP User">
                <input
                  type="text"
                  style={inputStyle}
                  value={form.smtpUser}
                  onChange={(e) => set('smtpUser', e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Field label="SMTP Password">
                <input
                  type="password"
                  style={inputStyle}
                  value={form.smtpPassword}
                  onChange={(e) => set('smtpPassword', e.target.value)}
                  placeholder="••••••••"
                />
              </Field>
              <Field label="From Address">
                <input
                  type="email"
                  style={inputStyle}
                  value={form.smtpFrom}
                  onChange={(e) => set('smtpFrom', e.target.value)}
                  placeholder="LuxRoom AI <noreply@yourdomain.com>"
                />
              </Field>
              <Field label="Notification Recipient Email">
                <input
                  type="email"
                  style={inputStyle}
                  value={form.notificationEmail}
                  onChange={(e) => set('notificationEmail', e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <button
                  onClick={handleTestEmail}
                  disabled={emailTesting || !form.notificationEmail}
                  style={{
                    background: emailTesting ? '#2a2a4a' : '#1e1e3a',
                    border: '1px solid #3a3a5a',
                    color: '#c4b5fd',
                    padding: '8px 16px',
                    borderRadius: '6px',
                    fontSize: '13px',
                    cursor: emailTesting || !form.notificationEmail ? 'not-allowed' : 'pointer',
                    fontWeight: '600',
                    opacity: !form.notificationEmail ? 0.5 : 1,
                  }}
                >
                  {emailTesting ? 'Sending...' : 'Send test email'}
                </button>
                {emailTestResult && (
                  <span style={{ fontSize: '13px', color: emailTestResult.ok ? '#6ee7b7' : '#f87171' }}>
                    {emailTestResult.msg}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop notifications */}
        <div style={{ background: '#0d0d1a', borderRadius: '8px', padding: '16px', border: '1px solid #1e1e2e' }}>
          <div style={toggleRowStyle}>
            <input
              type="checkbox"
              style={checkboxStyle}
              id="desktopEnabled"
              checked={form.desktopNotificationsEnabled}
              onChange={(e) => set('desktopNotificationsEnabled', e.target.checked)}
            />
            <label htmlFor="desktopEnabled" style={{ color: '#e8e8f0', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              Enable Desktop Notifications
            </label>
          </div>
        </div>
      </div>

      {/* Section 4 — Crawl Settings */}
      <div style={sectionStyle}>
        <div style={sectionHeaderStyle}>Crawl Settings</div>
        <div style={gridStyle}>
          <Field label="Crawl Interval (hours)" helper="How often to check for new listings (1–24 hours)">
            <input
              type="number"
              style={inputStyle}
              value={form.crawlIntervalHours}
              onChange={(e) => set('crawlIntervalHours', Math.min(24, Math.max(1, Number(e.target.value))))}
              min={1}
              max={24}
            />
          </Field>
          <Field label="Opportunity Threshold (1–10)" helper="Listings scoring above this value trigger notifications">
            <input
              type="number"
              style={inputStyle}
              value={form.opportunityThreshold}
              onChange={(e) => set('opportunityThreshold', Math.min(10, Math.max(1, Number(e.target.value))))}
              min={1}
              max={10}
            />
          </Field>
        </div>
      </div>

      {/* Save button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSave}
          style={{
            background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
            border: 'none',
            color: '#fff',
            padding: '12px 32px',
            borderRadius: '8px',
            fontSize: '15px',
            fontWeight: '700',
            cursor: 'pointer',
            letterSpacing: '0.03em',
            boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
          }}
        >
          Save Settings
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed',
          bottom: '32px',
          right: '32px',
          background: toast.isError ? '#3b1010' : '#0d2b1a',
          border: `1px solid ${toast.isError ? '#f87171' : '#6ee7b7'}`,
          color: toast.isError ? '#f87171' : '#6ee7b7',
          padding: '12px 20px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          zIndex: 9999,
        }}>
          {toast.msg}
        </div>
      )}
      </div>
    </div>
  );
}
