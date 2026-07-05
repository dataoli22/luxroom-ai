import { useState, useEffect } from 'react';

/**
 * One-time login capture for a login-gated source (e.g. Appartager).
 * Opens a real browser window, the user logs in, then we save the session so
 * the crawler can scrape as the logged-in user. Self-styled for dark surfaces;
 * usable in both onboarding and Settings.
 */
export default function SourceLogin({ source = 'appartager', label = 'Appartager', note }) {
  const [connected, setConnected] = useState(null); // null = loading
  const [phase, setPhase] = useState('idle');        // idle | waiting | saving
  const [error, setError] = useState('');

  const refresh = () =>
    window.luxroom?.auth?.status()
      .then(s => setConnected(!!s?.[source]))
      .catch(() => setConnected(false));

  useEffect(() => { refresh(); }, []);

  async function connect() {
    setError('');
    try {
      const r = await window.luxroom?.auth?.openLogin(source);
      if (r?.ok) { setPhase('waiting'); }
      else { setError(r?.error || 'Could not open the login window.'); setPhase('idle'); }
    } catch (e) {
      setError('Could not open the login window: ' + (e?.message || e));
      setPhase('idle');
    }
  }
  async function done() {
    setPhase('saving');
    const r = await window.luxroom?.auth?.saveLogin(source);
    if (r?.ok) { setPhase('idle'); refresh(); }
    else { setError(r?.error || 'Could not save your session — try again.'); setPhase('waiting'); }
  }
  async function cancel() {
    await window.luxroom?.auth?.cancelLogin().catch(() => {});
    setPhase('idle'); setError('');
  }
  async function disconnect() {
    await window.luxroom?.auth?.clearLogin(source).catch(() => {});
    refresh();
  }

  const btn = (bg, color, border) => ({
    background: bg, color, border: `1px solid ${border}`,
    borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
  });

  return (
    <div style={{
      background: connected ? '#0f1e0f' : '#12121e',
      border: `1px solid ${connected ? '#1a4a1a' : '#2a2a3a'}`,
      borderRadius: 10, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#e8e8f0', fontWeight: 600, fontSize: 14 }}>{label}</span>
            {connected === true && (
              <span style={{ color: '#4ade80', fontSize: 12, fontWeight: 700 }}>✓ Connected</span>
            )}
          </div>
          <div style={{ color: '#7a7a9a', fontSize: 12, lineHeight: 1.5, marginTop: 3 }}>
            {note || `${label} only shows listings to logged-in members. Log in once and LuxRoom AI will scan it for you.`}
          </div>
        </div>

        {phase === 'idle' && connected !== true && (
          <button onClick={connect} style={btn('#2a1f4a', '#c4b5fd', '#5a4a8a')}>Connect {label}</button>
        )}
        {phase === 'idle' && connected === true && (
          <button onClick={disconnect} style={btn('transparent', '#8080a8', '#3a3a5a')}>Disconnect</button>
        )}
        {(phase === 'waiting' || phase === 'saving') && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={done} disabled={phase === 'saving'} style={btn('#0d2b1a', '#6ee7b7', '#1a4a1a')}>
              {phase === 'saving' ? 'Saving…' : "I've logged in"}
            </button>
            <button onClick={connect} disabled={phase === 'saving'} style={btn('#2a1f4a', '#c4b5fd', '#5a4a8a')}>
              ⟳ Open login window
            </button>
            <button onClick={cancel} style={btn('transparent', '#8080a8', '#3a3a5a')}>Cancel</button>
          </div>
        )}
      </div>

      {(phase === 'waiting' || phase === 'saving') && (
        <div style={{
          marginTop: 12, background: '#1a1400', border: '1px solid #5a4400',
          borderLeft: '3px solid #fbbf24', borderRadius: 7, padding: '10px 13px',
          fontSize: 13, color: '#d0b070', lineHeight: 1.6,
        }}>
          A <strong style={{ color: '#fbbf24' }}>{label}</strong> login window should have opened. Log in there,
          then click <strong style={{ color: '#6ee7b7' }}>“I've logged in”</strong> here.
          If you don't see it, click <strong style={{ color: '#c4b5fd' }}>“Open login window”</strong>.
        </div>
      )}

      {error && (
        <div style={{ marginTop: 10, color: '#f87171', fontSize: 12 }}>{error}</div>
      )}
    </div>
  );
}
