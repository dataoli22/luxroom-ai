import { useState, useEffect } from 'react'

const c = { accent: '#7c5cbf', accent2: '#a78bfa', panel: '#12101e', border: '#2a2440', text: '#e8e8f0', sub: '#8080a8' }

function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

/**
 * Live scan progress — elapsed timer, determinate bar with count/%/ETA during
 * analysis, and an animated indeterminate bar while crawling. Hidden when idle.
 */
export default function ScanProgress({ initial }) {
  const [p, setP] = useState(initial || null)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const unsub = window.luxroom?.scan?.onProgress(setP)
    return () => unsub?.()
  }, [])

  // Hide the bar the instant a scan completes — it reappears when the next scan
  // emits its first progress event.
  useEffect(() => {
    const unsub = window.luxroom?.scan?.onComplete?.(() => setP(null))
    return () => unsub?.()
  }, [])

  // Keep the seed fresh if the parent polls a newer status while we have none.
  useEffect(() => {
    if (initial && initial.phase && initial.phase !== 'idle' && (!p || p.phase === 'idle')) setP(initial)
  }, [initial]) // eslint-disable-line

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [])

  if (!p || p.phase === 'idle' || !p.startedAt) return null

  const elapsed = now - p.startedAt
  const analysing = p.phase === 'analysing' && p.total > 0
  const pct = analysing ? Math.min(100, Math.round((p.current / p.total) * 100)) : null
  const ratePerSec = analysing && elapsed > 500 ? p.current / (elapsed / 1000) : null
  const eta = analysing && ratePerSec > 0 && p.current > 0
    ? fmt(((p.total - p.current) / ratePerSec) * 1000)
    : null

  const sites = p.sourcesTotal > 0 ? `${p.sourcesDone}/${p.sourcesTotal} sites` : null
  const label = p.phase === 'crawling'
    ? 'Crawling housing sites…'
    : `Analysing listings`

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      padding: '8px 16px', background: c.panel, borderBottom: `1px solid ${c.border}`, flexShrink: 0,
    }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 150 }}>
        <span style={{
          width: 9, height: 9, borderRadius: '50%', background: c.accent2,
          boxShadow: `0 0 8px ${c.accent2}`, animation: 'pulse 1.2s infinite', flexShrink: 0,
        }} />
        <span style={{ color: c.accent2, fontSize: 13, fontWeight: 600 }}>{label}</span>
      </span>

      {/* Bar */}
      <div style={{ flex: 1, minWidth: 160, height: 8, background: '#1e1a30', borderRadius: 5, overflow: 'hidden', position: 'relative' }}>
        {analysing ? (
          <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${c.accent}, ${c.accent2})`, borderRadius: 5, transition: 'width 0.4s ease' }} />
        ) : (
          <div style={{
            position: 'absolute', top: 0, height: '100%', width: '35%', borderRadius: 5,
            background: `linear-gradient(90deg, transparent, ${c.accent2}, transparent)`,
            animation: 'scanSlide 1.3s ease-in-out infinite',
          }} />
        )}
      </div>

      {/* Numbers */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 14, fontSize: 12, color: c.sub, fontVariantNumeric: 'tabular-nums' }}>
        {analysing && (
          <span style={{ color: c.text, fontWeight: 600 }}>{p.current} / {p.total} <span style={{ color: c.sub, fontWeight: 400 }}>({pct}%)</span></span>
        )}
        {sites && p.sourcesDone < p.sourcesTotal && <span>🌐 {sites}</span>}
        <span>⏱ {fmt(elapsed)}</span>
        {eta && <span>ETA ~{eta}</span>}
        {ratePerSec > 0 && <span>{ratePerSec >= 1 ? `${ratePerSec.toFixed(1)}/s` : `${Math.round(ratePerSec * 60)}/min`}</span>}
      </span>
    </div>
  )
}
