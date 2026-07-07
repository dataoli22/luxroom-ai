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

// Ollama Cloud models (ollama.com/search?c=cloud, July 2026). Lighter ones are
// gentler on the free tier's daily quota — good defaults for listing analysis.
const CLOUD_MODELS = [
  { name: 'gpt-oss:20b',       note: 'Recommended — light, great JSON, easy on free quota' },
  { name: 'qwen3.5',           note: 'Strong multilingual (FR/DE)' },
  { name: 'gemma4',            note: 'Google — light and accurate' },
  { name: 'deepseek-v4-flash', note: 'Fast reasoning' },
  { name: 'glm-4.7',           note: 'Solid all-rounder' },
  { name: 'gpt-oss:120b',      note: 'Highest quality — uses quota faster' },
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
  const [ollamaKey, setOllamaKey] = useState('')
  const [cloudModel, setCloudModel] = useState('gpt-oss:20b')
  const [savingKey, setSavingKey] = useState('')   // which key is saving
  const [keyMsg, setKeyMsg] = useState('')
  const [pull, setPull] = useState(null) // { model, pct, msg, error, done }
  const [showGuide, setShowGuide] = useState(false)
  const [showLocalWarn, setShowLocalWarn] = useState(false) // warn before entering local

  const refresh = () => window.luxroom?.ai?.status().then(setStatus).catch(() => {})
  useEffect(() => { refresh(); const id = setInterval(refresh, 4000); return () => clearInterval(id) }, [])
  useEffect(() => {
    window.luxroom?.settings.get().then(s => { if (s?.ollamaCloudModel) setCloudModel(s.ollamaCloudModel) }).catch(() => {})
  }, [])

  const configured = !!status?.configured
  const busy = pull && !pull.done && !pull.error

  async function savePayload(which, payload) {
    setSavingKey(which); setKeyMsg('')
    try {
      await window.luxroom?.settings.save({ ...payload, aiProvider: 'auto' })
      setKeyMsg('✓ Saved — cloud AI is ready.')
      await refresh()
    } catch (e) {
      setKeyMsg('Could not save: ' + (e?.message || e))
    } finally { setSavingKey('') }
  }

  // Local setup is a mandatory two-step: install Ollama (if missing), then pull the
  // model. The blocking gate won't let the user continue until a model is present,
  // so choosing local means actually completing this — no half-configured state.
  async function installLocal(name) {
    setPull({ model: name, pct: null, msg: 'Checking Ollama…', error: false, done: false })
    const unsub = window.luxroom?.setup?.onProgress(({ phase, message, pct, error }) => {
      setPull(p => ({ ...(p || {}), model: name, msg: message, pct: pct ?? p?.pct, error: !!error }))
    })
    try {
      // Step 1 — Ollama must be installed & running.
      const check = await window.luxroom?.setup?.checkOllama()
      if (!check?.installed) {
        setPull(p => ({ ...(p || {}), msg: 'Installing Ollama…', pct: null }))
        await window.luxroom?.setup?.installOllama()
      }
      // Step 2 — pull the model (multi-GB; can take a few minutes).
      setPull(p => ({ ...(p || {}), msg: `Downloading ${name}…`, pct: null }))
      await window.luxroom?.setup?.pullModel(name)
      setPull({ model: name, pct: 100, msg: `${name} is ready ✓`, error: false, done: true })
      await window.luxroom?.settings.save({ OLLAMA_MODEL: name, aiProvider: 'auto' })
      await refresh()
    } catch (e) {
      // A long pull can surface a transient error yet still finish — verify before failing.
      let present = false
      try {
        const models = await window.luxroom?.setup?.listModels()
        present = Array.isArray(models) && models.some(m => (m.name || '').split(':')[0] === name.split(':')[0])
      } catch {}
      if (present) {
        setPull({ model: name, pct: 100, msg: `${name} is ready ✓`, error: false, done: true })
        await window.luxroom?.settings.save({ OLLAMA_MODEL: name, aiProvider: 'auto' })
        await refresh()
      } else {
        setPull({ model: name, pct: null, msg: e?.message || 'Setup failed', error: true, done: false })
      }
    } finally { unsub?.() }
  }

  const tabBtn = (id, label, onClick) => (
    <button onClick={onClick || (() => setMode(id))} style={{
      flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 700,
      border: `1px solid ${mode === id ? c.accent : c.border}`,
      background: mode === id ? '#1e1633' : 'transparent',
      color: mode === id ? '#c4b5fd' : c.sub,
    }}>{label}</button>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001, padding: 20 }}>

      {/* Warning shown before entering the local tab — the user must read & close it. */}
      {showLocalWarn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10002, padding: 20 }}>
          <div style={{ background: c.panel, border: '1px solid #5a4400', borderRadius: 16, maxWidth: 440, width: '100%', padding: '26px 28px', boxShadow: '0 24px 70px rgba(0,0,0,0.65)' }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>⚠️</div>
            <h3 style={{ margin: '0 0 10px', fontSize: 18, fontWeight: 800, color: c.text }}>Before you choose local AI</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13.5, color: '#b8b8c8', lineHeight: 1.65 }}>
              Running the AI on your own device means a <strong style={{ color: '#fbbf24' }}>one-time download of about 4.7 GB</strong> (Ollama + the Hermes model). A few things to know:
            </p>
            <ul style={{ margin: '0 0 16px', paddingLeft: 18, fontSize: 13, color: '#9090b8', lineHeight: 1.7 }}>
              <li>The app installs and runs everything for you — <strong>no terminal needed</strong>.</li>
              <li>It can take <strong>several minutes</strong> and needs the space + a decent connection.</li>
              <li>Analysis is <strong>slower</strong> (runs on your CPU) and works best with 16 GB RAM.</li>
              <li>You <strong>must finish the download to continue</strong> — there's no half-setup.</li>
            </ul>
            <div style={{ background: '#0d1a0d', border: '1px solid #1a4a1a', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: c.greenDim, lineHeight: 1.55, marginBottom: 18 }}>
              Prefer to skip all this? The <strong>☁️ Cloud</strong> option is faster, free, and needs no download.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { setShowLocalWarn(false); setMode('local') }}
                style={{ flex: 1, padding: '12px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                I understand — continue
              </button>
              <button onClick={() => setShowLocalWarn(false)}
                style={{ padding: '12px 18px', borderRadius: 8, border: `1px solid ${c.border}`, background: 'transparent', color: c.sub, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Use cloud instead
              </button>
            </div>
          </div>
        </div>
      )}

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
          {tabBtn('cloud', '☁️ Cloud — fast (recommended)')}
          {tabBtn('local', '💻 On my device (fallback)', () => { if (mode !== 'local') setShowLocalWarn(true) })}
        </div>

        {mode === 'cloud' && (
          <div>
            <p style={{ fontSize: 13, color: '#9090b8', lineHeight: 1.6, margin: '0 0 14px' }}>
              Cloud AI runs on powerful servers — <strong>fast, and it won't strain your laptop</strong>. Add either key below (a
              1-minute signup). This is the recommended way to run LuxRoom.
            </p>
            {status?.hasCloudKey && (
              <div style={{ color: c.greenDim, fontSize: 13, fontWeight: 600, marginBottom: 10 }}>✓ A cloud key is configured.</div>
            )}

            {/* Groq */}
            <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 14px', marginBottom: 10 }}>
              <div style={{ color: c.text, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Groq <span style={{ color: c.greenDim, fontWeight: 600, fontSize: 11 }}>· free, no card</span></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input type="password" value={groqKey} onChange={e => setGroqKey(e.target.value)} placeholder="Paste your Groq key (gsk_…)"
                  style={{ flex: 1, minWidth: 180, background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: '10px 12px', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                <button onClick={() => savePayload('groq', { groqApiKey: groqKey.trim() })} disabled={!groqKey.trim() || savingKey} style={btn(groqKey.trim() ? c.accent : c.border, '#fff', c.accent, { cursor: groqKey.trim() ? 'pointer' : 'default' })}>
                  {savingKey === 'groq' ? 'Saving…' : 'Save'}
                </button>
              </div>
              <button onClick={() => window.luxroom?.shell?.openExternal('https://console.groq.com/keys')}
                style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: '8px 0 0', fontWeight: 600 }}>
                Get a free Groq key →
              </button>
            </div>

            {/* Ollama Cloud */}
            <div style={{ border: `1px solid ${c.border}`, borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ color: c.text, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Ollama Cloud <span style={{ color: c.sub, fontWeight: 600, fontSize: 11 }}>· hosted models via your Ollama key</span></div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                <input type="password" value={ollamaKey} onChange={e => setOllamaKey(e.target.value)} placeholder="Paste your Ollama API key"
                  style={{ flex: 1, minWidth: 180, background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: '10px 12px', borderRadius: 8, fontSize: 13, outline: 'none' }} />
                <button onClick={() => savePayload('ollama', { OLLAMA_API_KEY: ollamaKey.trim(), ollamaCloudModel: cloudModel })} disabled={!ollamaKey.trim() || savingKey} style={btn(ollamaKey.trim() ? c.accent : c.border, '#fff', c.accent, { cursor: ollamaKey.trim() ? 'pointer' : 'default' })}>
                  {savingKey === 'ollama' ? 'Saving…' : 'Save'}
                </button>
              </div>
              {/* Cloud model picker */}
              <label style={{ display: 'block', color: c.sub, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 5 }}>Cloud model</label>
              <select value={CLOUD_MODELS.some(m => m.name === cloudModel) ? cloudModel : '__custom'}
                onChange={e => { if (e.target.value !== '__custom') setCloudModel(e.target.value) }}
                style={{ width: '100%', background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: '9px 10px', borderRadius: 8, fontSize: 13, outline: 'none' }}>
                {CLOUD_MODELS.map(m => <option key={m.name} value={m.name}>{m.name} — {m.note}</option>)}
                <option value="__custom">Custom…</option>
              </select>
              {!CLOUD_MODELS.some(m => m.name === cloudModel) && (
                <input value={cloudModel} onChange={e => setCloudModel(e.target.value)} placeholder="e.g. qwen3-coder"
                  style={{ width: '100%', marginTop: 6, background: c.bg, border: `1px solid ${c.border}`, color: c.text, padding: '9px 10px', borderRadius: 8, fontSize: 13, outline: 'none' }} />
              )}
              <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                <button onClick={() => window.luxroom?.shell?.openExternal('https://ollama.com/settings/keys')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontWeight: 600 }}>
                  Get your Ollama key →
                </button>
                <button onClick={() => window.luxroom?.shell?.openExternal('https://ollama.com/search?c=cloud')}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0, fontWeight: 600 }}>
                  Browse cloud models →
                </button>
              </div>
            </div>
            {keyMsg && <div style={{ marginTop: 10, fontSize: 12, color: keyMsg.startsWith('✓') ? c.green : '#f87171' }}>{keyMsg}</div>}
          </div>
        )}

        {mode === 'local' && (() => {
          const haveHermes = status?.models?.some(x => x.name.split(':')[0] === 'hermes3')
          const LIGHTER = QUICK_MODELS.filter(m => m.name.split(':')[0] !== 'hermes3')
          return (
          <div>
            <p style={{ fontSize: 13, color: '#9090b8', lineHeight: 1.6, margin: '0 0 12px' }}>
              Runs free and private on your laptop — but it's <strong>slower</strong> (uses your CPU). The app installs
              Ollama and downloads the model for you, <strong>no terminal needed</strong>. You'll need to
              <strong> finish this download to continue</strong> — cloud above is faster if you'd rather skip it.
            </p>
            {status?.models?.length > 0 && (
              <div style={{ marginBottom: 12, fontSize: 13, color: c.greenDim }}>
                ✓ Installed: {status.models.map(m => m.name).join(', ')}
              </div>
            )}

            {/* Primary, recommended local setup: Ollama + Hermes */}
            <button onClick={() => !haveHermes && !busy && installLocal('hermes3')} disabled={haveHermes || busy}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, textAlign: 'left', padding: '14px 16px', borderRadius: 10, width: '100%',
                border: `1.5px solid ${haveHermes ? '#1a4a1a' : c.accent}`, background: haveHermes ? '#0d1a0d' : '#1a1233', cursor: haveHermes || busy ? 'default' : 'pointer' }}>
              <div>
                <div style={{ color: haveHermes ? c.greenDim : '#c4b5fd', fontWeight: 700, fontSize: 14 }}>
                  {haveHermes ? '✓ Local AI ready (Hermes)' : 'Set up local AI — Ollama + Hermes'}
                </div>
                <div style={{ color: c.sub, fontSize: 12, marginTop: 2 }}>
                  {haveHermes ? 'Hermes is installed and analysing locally.' : 'Recommended local model — best analysis quality. Installs Ollama automatically.'}
                </div>
              </div>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <span style={{ color: c.sub, fontSize: 12 }}>4.7 GB</span>
                {!haveHermes && <span style={{ background: c.accent, color: '#fff', borderRadius: 6, padding: '3px 11px', fontSize: 11, fontWeight: 700 }}>Install</span>}
              </span>
            </button>

            {/* Lighter alternatives for low-RAM laptops */}
            <div style={{ color: c.sub, fontSize: 11.5, margin: '14px 0 7px', fontWeight: 600 }}>
              Laptop under 16 GB RAM? Pick a lighter model instead:
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LIGHTER.map(m => {
                const have = status?.models?.some(x => x.name.split(':')[0] === m.name.split(':')[0])
                return (
                  <button key={m.name} onClick={() => !have && !busy && installLocal(m.name)} disabled={have || busy}
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
                {pull.error && <div style={{ fontSize: 12, color: '#a89060', marginTop: 4 }}>Trouble with local AI? Switch to the ☁️ Cloud tab — it needs no install.</div>}
              </div>
            )}
          </div>
          )
        })()}

        {/* Guide */}
        <button onClick={() => setShowGuide(g => !g)}
          style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12.5, cursor: 'pointer', padding: '16px 0 0', fontWeight: 600 }}>
          {showGuide ? '▾' : '▸'} Which should I choose? &amp; how models work
        </button>
        {showGuide && (
          <div style={{ marginTop: 8, background: '#0d0d18', border: `1px solid ${c.border}`, borderRadius: 10, padding: '14px 16px', fontSize: 12.5, color: '#9090b8', lineHeight: 1.7 }}>
            <div style={{ marginBottom: 8 }}>
              <strong style={{ color: '#c4b5fd' }}>☁️ Cloud (Groq / Ollama Cloud)</strong> — runs on powerful servers, so it's fast and doesn't strain your laptop.
              Both have <strong>free tiers with daily limits</strong>; pick a <strong>lighter model</strong> (e.g. gpt-oss:20b) to make your free quota last.
            </div>
            <div style={{ marginBottom: 10 }}>
              <strong style={{ color: c.greenDim }}>💻 On my device</strong> — private and works offline, but <strong>slower</strong> (uses your CPU). Best if you can't sign up for a key.
            </div>
            <div style={{ background: '#12102a', border: '1px solid #2a2060', borderRadius: 8, padding: '10px 12px', color: '#b0a8d0' }}>
              <strong style={{ color: '#c4b5fd' }}>Downloads vs. what's actually used — they're different:</strong><br />
              • <strong>🤖 Models</strong> (top bar) and Settings → Local Extraction just <strong>download</strong> local models to your device.<br />
              • <strong>This panel</strong> (and the AI bar on Listings) chooses <strong>which AI actually analyses your listings</strong> — cloud or local. Downloading a model doesn't switch to it; selecting it here does.
            </div>
            <button onClick={() => window.luxroom?.shell?.openExternal('https://ollama.com/search?c=cloud')}
              style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: '10px 0 0', fontWeight: 600 }}>
              See all Ollama Cloud models & free limits →
            </button>
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
