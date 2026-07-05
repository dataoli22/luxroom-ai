import { useState, useEffect } from 'react'

const c = {
  bg: '#0f0f13', panel: '#1a1a24', border: '#2a2a3a',
  accent: '#7c5cbf', text: '#e8e8f0', sub: '#888', label: '#a0a0b8',
}

const POPULAR_MODELS = [
  { name: 'hermes3',        size: '4.7 GB', note: 'Recommended for analysis — clean JSON output' },
  { name: 'llama3.2:1b',    size: '1.3 GB', note: 'Fastest — good for 8 GB RAM laptops' },
  { name: 'llama3.2:3b',    size: '2.0 GB', note: 'Best quality/speed balance for most users' },
  { name: 'llama3.1:8b',    size: '4.7 GB', note: 'High quality — needs 16 GB RAM' },
  { name: 'mistral:7b',     size: '4.1 GB', note: 'Strong at structured extraction tasks' },
  { name: 'phi3:mini',      size: '2.2 GB', note: 'Microsoft — very fast on CPU' },
  { name: 'gemma2:2b',      size: '1.6 GB', note: 'Google — light and accurate' },
  { name: 'qwen2.5:3b',     size: '1.9 GB', note: 'Good multilingual support (FR/DE)' },
]

export default function ModelManagerView({ onClose }) {
  const [installed, setInstalled]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [activeModel, setActiveModel] = useState('')
  const [customName, setCustomName] = useState('')
  const [pulling, setPulling]       = useState(false)
  const [pullLog, setPullLog]       = useState([])   // { message, pct, error }
  const [pullPct, setPullPct]       = useState(null)
  const [removingId, setRemovingId] = useState(null)
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    refresh()
    window.luxroom?.settings.get().then(s => {
      setActiveModel(s?.OLLAMA_MODEL ?? '')
    })
  }, [])

  async function refresh() {
    setLoading(true)
    const list = await window.luxroom?.setup?.listModels() ?? []
    setInstalled(list)
    setLoading(false)
  }

  async function pullModel(name) {
    if (!name.trim()) return
    setPulling(true)
    setPullLog([])
    setPullPct(null)

    const unsub = window.luxroom?.setup?.onProgress(({ phase, message, pct, error }) => {
      if (phase !== 'pull') return
      setPullLog(prev => [...prev.slice(-40), { message, pct, error }])
      if (pct != null) setPullPct(pct)
    })

    try {
      await window.luxroom?.setup?.pullModel(name.trim())
      await refresh()
      setSuccessMsg(`${name} downloaded and ready!`)
      setTimeout(() => setSuccessMsg(''), 4000)
    } catch {
      // error already in pullLog
    } finally {
      unsub?.()
      setPulling(false)
      setPullPct(null)
    }
  }

  async function removeModel(name) {
    if (!window.confirm(`Remove model "${name}"? It will need to be re-downloaded to use again.`)) return
    setRemovingId(name)
    await window.luxroom?.setup?.removeModel(name)
    await refresh()
    setRemovingId(null)
    if (activeModel === name) setActiveModel('')
  }

  async function setActive(name) {
    setActiveModel(name)
    await window.luxroom?.settings.save({ OLLAMA_MODEL: name })
    setSuccessMsg(`Active model set to ${name}`)
    setTimeout(() => setSuccessMsg(''), 3000)
  }

  const lastLog = pullLog[pullLog.length - 1]

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: c.panel, border: `1px solid ${c.border}`,
        borderRadius: 16, width: '100%', maxWidth: 640,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '18px 24px', borderBottom: `1px solid ${c.border}`, flexShrink: 0,
        }}>
          <div>
            <div style={{ color: c.text, fontWeight: 700, fontSize: 16 }}>Configure AI Models</div>
            <div style={{ color: c.sub, fontSize: 12, marginTop: 2 }}>Download, switch, or remove local Ollama models</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: c.sub,
            fontSize: 20, cursor: 'pointer', lineHeight: 1, padding: 4,
          }}>✕</button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Success banner */}
          {successMsg && (
            <div style={{
              background: '#0a2a0a', border: '1px solid #1a4a1a',
              borderRadius: 8, padding: '10px 16px', color: '#4ade80', fontSize: 13,
            }}>{successMsg}</div>
          )}

          {/* Installed models */}
          <section>
            <div style={{ color: c.label, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Installed models
            </div>
            {loading ? (
              <div style={{ color: c.sub, fontSize: 13 }}>Scanning…</div>
            ) : installed.length === 0 ? (
              <div style={{
                background: '#12121e', border: `1px solid ${c.border}`,
                borderRadius: 8, padding: '14px 16px', color: '#5a5a7a', fontSize: 13,
              }}>
                No models installed yet. Download one below.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {installed.map(m => {
                  const isActive = activeModel === m.name
                  return (
                    <div key={m.name} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      background: isActive ? '#18102e' : '#12121e',
                      border: `1px solid ${isActive ? c.accent : c.border}`,
                      borderRadius: 8, padding: '10px 14px',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: c.text, fontWeight: 600, fontSize: 13 }}>{m.name}</span>
                          {isActive && (
                            <span style={{
                              background: '#2a1a4a', color: '#c4b5fd',
                              border: '1px solid #5a3a8a', borderRadius: 20,
                              padding: '1px 8px', fontSize: 10, fontWeight: 700,
                            }}>active</span>
                          )}
                        </div>
                        {m.size && <div style={{ color: '#5a5a7a', fontSize: 12, marginTop: 2 }}>{m.size}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!isActive && (
                          <button onClick={() => setActive(m.name)} style={{
                            background: 'transparent', border: `1px solid ${c.border}`,
                            borderRadius: 6, padding: '4px 10px', fontSize: 11,
                            color: c.label, cursor: 'pointer',
                          }}>Set active</button>
                        )}
                        <button
                          onClick={() => removeModel(m.name)}
                          disabled={removingId === m.name}
                          style={{
                            background: 'transparent', border: '1px solid #3a1a1a',
                            borderRadius: 6, padding: '4px 10px', fontSize: 11,
                            color: removingId === m.name ? '#5a3a3a' : '#f87171', cursor: 'pointer',
                          }}
                        >{removingId === m.name ? '…' : 'Remove'}</button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </section>

          {/* Download a model */}
          <section>
            <div style={{ color: c.label, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Download a model
            </div>

            {/* Quick-pick */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
              {POPULAR_MODELS.map(m => {
                const alreadyHave = installed.some(i => i.name === m.name)
                return (
                  <button key={m.name} onClick={() => !alreadyHave && !pulling && pullModel(m.name)}
                    disabled={alreadyHave || pulling}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      gap: 12, textAlign: 'left', padding: '9px 14px', borderRadius: 8,
                      border: `1px solid ${alreadyHave ? '#1a2a1a' : c.border}`,
                      background: alreadyHave ? '#0a1a0a' : 'transparent',
                      cursor: alreadyHave || pulling ? 'default' : 'pointer',
                      width: '100%',
                    }}>
                    <div>
                      <div style={{ color: alreadyHave ? '#4ade80' : c.text, fontWeight: 600, fontSize: 13 }}>
                        {alreadyHave && '✓ '}{m.name}
                      </div>
                      <div style={{ color: '#5a5a7a', fontSize: 12 }}>{m.note}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{ color: '#5a5a7a', fontSize: 12 }}>{m.size}</span>
                      {!alreadyHave && (
                        <span style={{
                          background: c.accent + '22', color: c.accent,
                          border: `1px solid ${c.accent}44`, borderRadius: 6,
                          padding: '2px 8px', fontSize: 11,
                        }}>Download</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Custom name input */}
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={customName}
                onChange={e => setCustomName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !pulling && pullModel(customName)}
                placeholder="Or type any model name — e.g. codellama:7b"
                style={{
                  flex: 1, background: '#0f0f13', border: `1px solid ${c.border}`,
                  color: c.text, padding: '9px 12px', borderRadius: 6,
                  fontSize: 13, outline: 'none',
                }}
              />
              <button
                onClick={() => pullModel(customName)}
                disabled={!customName.trim() || pulling}
                style={{
                  padding: '9px 18px', borderRadius: 6, border: 'none',
                  background: customName.trim() && !pulling ? c.accent : c.border,
                  color: '#fff', fontWeight: 600, fontSize: 13,
                  cursor: customName.trim() && !pulling ? 'pointer' : 'default',
                  whiteSpace: 'nowrap',
                }}
              >Pull</button>
            </div>

            <p style={{ color: '#5a5a7a', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
              Any model from{' '}
              <button onClick={() => window.luxroom?.shell?.openExternal('https://ollama.com/library')}
                style={{ background: 'none', border: 'none', color: '#818cf8', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', padding: 0 }}>
                ollama.com/library
              </button>
              {' '}works. Models are downloaded once and run locally.
            </p>
          </section>

          {/* Pull progress */}
          {pulling && (
            <section>
              <div style={{ color: c.label, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                Downloading…
              </div>
              {pullPct != null && (
                <div style={{ height: 4, background: '#1a1a2a', borderRadius: 2, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: c.accent, borderRadius: 2, width: `${pullPct}%`, transition: 'width 0.4s' }} />
                </div>
              )}
              {lastLog && (
                <div style={{
                  background: '#0a0a14', border: `1px solid ${c.border}`,
                  borderRadius: 6, padding: '10px 14px',
                  fontFamily: 'monospace', fontSize: 12,
                  color: lastLog.error ? '#f87171' : '#9090b8',
                  lineHeight: 1.6,
                }}>{lastLog.message}</div>
              )}
            </section>
          )}

        </div>
      </div>
    </div>
  )
}
