import { useState, useEffect } from 'react';

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
    anthropicApiKey: '',
    ollamaUrl: 'http://localhost:11434',
    ollamaModel: 'qwen2.5-vl',
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

  useEffect(() => {
    window.luxroom?.settings.get().then((saved) => {
      if (saved) setForm((prev) => ({ ...prev, ...saved }));
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
      await window.luxroom.settings.save(form);
      showToast('Settings saved', false);
    } catch (err) {
      showToast('Failed to save: ' + (err.message || err), true);
    }
  }

  async function handleTestEmail() {
    setEmailTestResult(null);
    setEmailTesting(true);
    try {
      const result = await window.luxroom.email.test(form.notificationEmail);
      setEmailTestResult({ ok: true, msg: result || 'Test email sent successfully.' });
    } catch (err) {
      setEmailTestResult({ ok: false, msg: err.message || String(err) });
    } finally {
      setEmailTesting(false);
    }
  }

  return (
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
        <div style={gridStyle}>
          <Field label="Anthropic API Key" helper="Get yours at console.anthropic.com" fullWidth>
            <input
              type="password"
              style={inputStyle}
              value={form.anthropicApiKey}
              onChange={(e) => set('anthropicApiKey', e.target.value)}
              placeholder="sk-ant-..."
            />
          </Field>
        </div>
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
          <div style={infoBoxStyle}>
            Ollama runs locally on your CPU. Install from{' '}
            <span style={{ color: '#8b5cf6' }}>ollama.com</span>, then run:{' '}
            <code style={{ background: '#1a1a2e', padding: '2px 6px', borderRadius: '4px', color: '#c4b5fd' }}>
              ollama pull qwen2.5-vl
            </code>
          </div>
        </div>
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
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
