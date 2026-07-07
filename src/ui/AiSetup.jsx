import { useState, useEffect } from 'react'

const c = {
  bg: '#0f0f13', panel: '#1a1a24', border: '#2a2a3a', accent: '#7c5cbf',
  text: '#e8e8f0', sub: '#8080a8', green: '#4ade80', greenDim: '#6ee7b7',
}

const QUICK_MODELS = [
  { name: 'qwen2.5:3b',  size: '1.9 GB', note: 'Light & multilingual (FR/DE) — good default' },
  { name: 'llama3.2:3b', size: '2.0 GB', note: 'Balanced quality and speed' },
  { name: 'hermes3',     size: '4.7 GB', note: 'Best analysis quality (needs 16 GB RAM)' },
]

const btn = (bg, color, border, extra = {}) => ({
  background: bg, color, border: `1px solid ${border}`, borderRadius: 8,
  padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', ...extra,
})

/**
 * AI setup — pick how listings get analysed. Free cloud key (fastest) or a local
 * model the app downloads for you (no terminal). Used both as a mandatory
 * first-run gate (blocking) and as an anytime AI panel from the header.
 */
export default function AiSetup({ blocking, onDone, onClose }) {
  const [status, setStatus] = useState(null)
  const [mode, setMode] = useState('cloud') // 'cloud' | 'local'
  const [groqKey, setGroqKey] = useState('')
  const [savingKey, setSavingKey] = useState(false)
  const [keyMsg, setKeyMsg] = useState('')
  const [pull, setPull] = useState(null) // { model, pct, msg, error, done }

  const refresh = () => window.luxroom?.ai?.status().then(setStatus).catch(() => {})
  useEffect(() => { refresh(); const id = setInterval(refresh, 4000); return () => clearInterval(id) }, [])

  const configured = !!status?.configured
  const busy = pull && !pull.done && !pull.error

  async function saveGroq() {
    if (!groqKey.trim()) return
    setSavingKey(true); setKeyMsg('')
    try {
      await window.luxroom?.settings.save({ groqApiKey: groqKey.trim(), aiProvider: 'auto' })
      setKeyMsg('✓ Saved — cloud AI is ready.')
      await refresh()
    } catch (e) {
      setKeyMsg('Could not save: ' + (e?.message || e))
    } finally { setSavingKey(false) }
  }

  async function downloadModel(name) {
    setPull({ model: name, pct: null, msg: 'Preparing…', error: false, done: false })
    const unsub = window.luxroom?.setup?.onProgress(({ phase, message, pct, error }) => {
      if (phase !== 'pull') return
      setPull(p => ({ ...(p || {}), model: name, msg: message, pct: pct ?? p?.pct, error: !!error }))
    })
    try {
      await window.luxroom?.setup?.pullModel(name)
      setPull({ model: name, pct: 100, msg: `${name} is ready ✓`, error: false, done: true })
      await window.luxroom?.settings.save({ OLLAMA_MODEL: name })
      await refresh()
    } catch (e) {
      setPull({ model: name, pct: null, msg: e?.message || 'Download failed', error: true, done: false })
    } finally { unsub?.() }
  }

  const tabBtn = (id, label) => (
    <button onClick={() => setMode(id)} style={{
      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
      border: `1px solid ${mode === id ? c.accent : c.border}`,
      background: mode === id ? '#1e1633' : 'transparent',
      color: mode === id ? '#c4b5fd' : c.sub,
    }}>{label}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 20 }}>
      <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 16, maxWidth: 560, width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '26px 30px', boxShadow: '0 24px 70px rgba(0,0,0,0.6)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 20, fontWeight: 800, color: c.text }}>Set up your AI</h2>
            <p style={{ margin: 0, fontSize: 13, color: c.sub, lineHeight: 1.6 }}>
              LuxRoom uses an AI to read each listing and rank it for you. Pick one — it's free either way.
            </p>
          </div>
          {!blocking && <button onClick={onClose} style={{ background: 'none', border: 'none', color: c.sub, fontSize: 20, cursor: 'pointer' }}>✕</button>}
        </div>

        {/* Status */}
        <div style={{
          margin: '16px 0', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          background: configured ? '#0d1a0d' : '#1a1400',
          border: `1px solid ${configured ? '#1a4a1a' : '#5a4400'}`,
          color: configured ? c.greenDim : '#fbbf24',
        }}>
          {configured
            ? <>✓ AI is ready {status?.provider ? <>— using <strong>{status.provider}</strong></> : null}. You're good to go.</>
            : 'Not set up yet — add a free cloud key or download a local model below.'}
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {tabBtn('cloud', '⚡ Free cloud — fastest')}
          {tabBtn('local', '💻 On my device')}
        </div>

        {mode === 'cloud' && (
          <div>
            <p style={{ fontSize: 13, color: '#9090b8', lineHeight: 1.6, margin: '0 0 12px' }}>
              Groq gives fast AI on a generous free tier — no credit card. Create a key (about a minute) and paste it here.
            </p>
            {status?.hasCloudKey ? (
              <div style={{ color: c.greenDim, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>✓ A cloud key is configured.</div>
            ) : null}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="password" value={groqKey} onChange={e => setGroqKey(e.target.value)} placeholder="Paste your Groq key (gsk_…)"
                style={{ flex: 1, minWidth: 200, background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: '10px 12px', borderRadius: 8, fontSize: 13, outline: 'none' }} />
              <button onClick={saveGroq} disabled={!groqKey.trim() || savingKey} style={btn(groqKey.trim() ? c.accent : c.border, '#fff', c.accent, { cursor: groqKey.trim() ? 'pointer' : 'default' })}>
                {savingKey ? 'Saving…' : 'Save key'}
              </button>
            </div>
            <div style={{ marginTop: 10 }}>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://console.groq.com/keys')}
                style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontWeight: 600 }}>
                Get a free Groq key →
              </button>
              {keyMsg && <span style={{ marginLeft: 12, fontSize: 12, color: keyMsg.startsWith('✓') ? c.green : '#f87171' }}>{keyMsg}</span>}
            </div>
          </div>
        )}

        {mode === 'local' && (
          <div>
            <p style={{ fontSize: 13, color: '#9090b8', lineHeight: 1.6, margin: '0 0 12px' }}>
              Runs free and private on your laptop. The app installs and runs everything for you — <strong>no terminal needed</strong>.
              Downloading a model takes a few minutes, once.
            </p>
            {status?.models?.length > 0 && (
              <div style={{ marginBottom: 12, fontSize: 13, color: c.greenDim }}>
                ✓ Installed: {status.models.map(m => m.name).join(', ')}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {QUICK_MODELS.map(m => {
                const have = status?.models?.some(x => x.name.split(':')[0] === m.name.split(':')[0])
                return (
                  <button key={m.name} onClick={() => !have && !busy && downloadModel(m.name)} disabled={have || busy}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left', padding: '10px 14px', borderRadius: 8, width: '100%',
                      border: `1px solid ${have ? '#1a4a1a' : c.border}`, background: have ? '#0d1a0d' : 'transparent', cursor: have || busy ? 'default' : 'pointer' }}>
                    <div>
                      <div style={{ color: have ? c.greenDim : c.text, fontWeight: 600, fontSize: 13 }}>{have && '✓ '}{m.name}</div>
                      <div style={{ color: c.sub, fontSize: 12 }}>{m.note}</div>
                    </div>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ color: c.sub, fontSize: 12 }}>{m.size}</span>
                      {!have && <span style={{ background: c.accent + '22', color: '#c4b5fd', border: `1px solid ${c.accent}44`, borderRadius: 6, padding: '2px 9px', fontSize: 11 }}>Download</span>}
                    </span>
                  </button>
                )
              })}
            </div>
            {pull && (
              <div style={{ marginTop: 12 }}>
                {pull.pct != null && !pull.done && (
                  <div style={{ height: 6, background: '#1a1a2a', borderRadius: 3, overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ height: '100%', background: c.accent, width: `${pull.pct}%`, transition: 'width 0.4s' }} />
                  </div>
                )}
                <div style={{ fontSize: 12, fontFamily: 'monospace', color: pull.error ? '#f87171' : pull.done ? c.green : '#9090b8' }}>
                  {pull.model}: {pull.msg}
                </div>
                {pull.error && <div style={{ fontSize: 12, color: '#a89060', marginTop: 4 }}>Trouble with local AI? Switch to the ⚡ Free cloud tab — it needs no install.</div>}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 22 }}>
          <button
            onClick={() => configured && onDone?.()}
            disabled={!configured}
            style={{ flex: 1, padding: '13px', borderRadius: 8, border: 'none',
              background: configured ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : c.border,
              color: configured ? '#fff' : c.sub, fontSize: 15, fontWeight: 700,
              cursor: configured ? 'pointer' : 'not-allowed',
              boxShadow: configured ? '0 4px 16px rgba(124,58,237,0.35)' : 'none' }}>
            {configured ? 'Continue →' : 'Set up an option above to continue'}
          </button>
        </div>
      </div>
    </div>
  )
}
