import React, { useState, useEffect, useRef } from 'react'
import ListingsView from './ListingsView.jsx'
import ApprovalsView from './ApprovalsView.jsx'
import LogView from './LogView.jsx'
import SettingsView from './SettingsView.jsx'
import OnboardingView from './OnboardingView.jsx'
import ModelManagerView from './ModelManagerView.jsx'
import HelpView from './HelpView.jsx'

const TABS = ['listings', 'approvals', 'log', 'settings', 'help']
const TAB_LABELS = { listings: '🏠 Listings', approvals: '✉️ Approvals', log: '📋 Log', settings: '⚙️ Settings', help: '❓ Help' }

const c = {
  bg: '#0f0f13',
  panel: '#1a1a24',
  border: '#2a2a3a',
  accent: '#7c5cbf',
  text: '#e8e8f0',
  sub: '#888',
}

export default function App() {
  const [tab, setTab] = useState('listings')
  const [status, setStatus] = useState({ running: false, lastCrawl: null, listingCount: 0, scanCycles: 0 })
  const [runningNow, setRunningNow] = useState(false)
  const [scanToast, setScanToast] = useState(null)
  const [scanInterval, setScanInterval] = useState(6)
  const [showIntervalPicker, setShowIntervalPicker] = useState(false)
  const [lastScanEmpty, setLastScanEmpty] = useState(false)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Onboarding state: null = loading, false = not done, true = done
  const [onboardingDone, setOnboardingDone] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showModels, setShowModels] = useState(false)

  // Keyboard shortcuts: 1-5 switch tabs, Ctrl/Cmd+R = Run Now
  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key >= '1' && e.key <= '5') {
        const idx = Number(e.key) - 1
        if (TABS[idx]) setTab(TABS[idx])
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault()
        window.luxroom?.pipeline.runNow().catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Subscribe to scan:complete for toast and status refresh
  useEffect(() => {
    const unsub = window.luxroom?.scan?.onComplete((data) => {
      window.luxroom?.pipeline.status().then(setStatus).catch(() => {})
      if (data.savedCount > 0) {
        setLastScanEmpty(false)
        setScanToast(`Found ${data.savedCount} listing${data.savedCount !== 1 ? 's' : ''} this scan`)
        setTimeout(() => setScanToast(null), 5000)
      } else {
        setLastScanEmpty(true)
      }
    })
    return () => unsub?.()
  }, [])

  // Load settings on mount to check onboarding status + saved interval
  useEffect(() => {
    window.luxroom?.settings.get().then(s => {
      const done = s?.profile?.onboardingDone === true
      setOnboardingDone(done)
      setShowOnboarding(!done)
      const h = Number(s?.crawlIntervalHours || s?.CRAWL_INTERVAL_HOURS || 6)
      if (h) setScanInterval(h)
    }).catch(() => {
      setOnboardingDone(false)
      setShowOnboarding(true)
    })
  }, [])

  function formatCountdown(ms) {
    const s = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = s % 60
    if (h > 0) return `${h}h ${m}m`
    if (m > 0) return `${m}m ${sec}s`
    return `${sec}s`
  }

  const lastCrawlMs = status.lastCrawl ? new Date(status.lastCrawl).getTime() : null
  const nextScanMs = lastCrawlMs ? lastCrawlMs + scanInterval * 3600 * 1000 : null
  const timeToNext = nextScanMs ? nextScanMs - now : null

  const handleSetInterval = async (hours) => {
    setScanInterval(hours)
    setShowIntervalPicker(false)
    await window.luxroom?.settings.save({ crawlIntervalHours: hours }).catch(() => {})
  }

  useEffect(() => {
    const poll = () => {
      window.luxroom?.pipeline.status().then(setStatus).catch(() => {})
    }
    poll()
    const id = setInterval(poll, 10000)
    return () => clearInterval(id)
  }, [])

  const handleRunNow = async () => {
    setRunningNow(true)
    try {
      await window.luxroom?.pipeline.runNow()
    } finally {
      setTimeout(() => setRunningNow(false), 2000)
    }
  }

  const handleTogglePipeline = async () => {
    if (status.running) {
      const s = await window.luxroom?.pipeline.stop()
      if (s) setStatus(s)
    } else {
      const s = await window.luxroom?.pipeline.start()
      if (s) setStatus(s)
    }
  }

  const handleOnboardingComplete = async (profile) => {
    setOnboardingDone(true)
    setShowOnboarding(false)
    // Auto-start the pipeline immediately after setup
    try {
      const s = await window.luxroom?.pipeline.start()
      if (s) setStatus(s)
    } catch {}
  }

  const handleEditProfile = () => {
    setShowOnboarding(true)
    setTab('settings')
  }

  // Loading splash
  if (onboardingDone === null) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: c.bg, color: c.sub, fontSize: 14 }}>
        Loading…
      </div>
    )
  }

  // Onboarding wizard
  if (showOnboarding) {
    return <OnboardingView onComplete={handleOnboardingComplete} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: c.bg, color: c.text, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 52, background: c.panel,
        borderBottom: `1px solid ${c.border}`, flexShrink: 0,
      }}>
        <span style={{ fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>LuxRoom AI</span>

        <div style={{ display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: tab === t ? 600 : 400,
              background: tab === t ? c.accent : 'transparent',
              color: tab === t ? '#fff' : c.sub,
              transition: 'all 0.15s',
            }}>
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => setShowModels(true)} style={{
            padding: '5px 12px', borderRadius: 6, border: `1px solid ${c.border}`,
            background: 'transparent', color: c.sub, cursor: 'pointer', fontSize: 12,
          }}>🤖 Models</button>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: c.sub }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: status.running ? '#4ade80' : '#f87171',
              display: 'inline-block',
            }} />
            {status.running ? 'Running' : 'Stopped'}
          </span>
          <button onClick={handleTogglePipeline} style={{
            padding: '5px 12px', borderRadius: 6, border: `1px solid ${c.border}`,
            background: 'transparent', color: c.text, cursor: 'pointer', fontSize: 12,
          }}>
            {status.running ? 'Stop' : 'Start'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
            <button onClick={handleRunNow} disabled={runningNow} style={{
              padding: '5px 14px', borderRadius: '6px 0 0 6px', border: 'none',
              background: c.accent, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              opacity: runningNow ? 0.6 : 1,
            }}>
              {runningNow ? 'Running…' : 'Run Now'}
            </button>
            <button onClick={() => setShowIntervalPicker(v => !v)} style={{
              padding: '5px 8px', borderRadius: '0 6px 6px 0', border: 'none',
              borderLeft: '1px solid rgba(255,255,255,0.2)',
              background: c.accent, color: '#fff', cursor: 'pointer', fontSize: 11,
            }} title="Change scan frequency">
              Every {scanInterval}h ▾
            </button>
            {showIntervalPicker && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, marginTop: 4,
                background: c.panel, border: `1px solid ${c.border}`, borderRadius: 8,
                zIndex: 1000, minWidth: 130, overflow: 'hidden',
              }}>
                {[1, 3, 6, 12, 24].map(h => (
                  <button key={h} onClick={() => handleSetInterval(h)} style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    padding: '8px 14px', border: 'none', cursor: 'pointer', fontSize: 13,
                    background: scanInterval === h ? '#2a1f4a' : 'transparent',
                    color: scanInterval === h ? '#c4b5fd' : c.text,
                    fontWeight: scanInterval === h ? 600 : 400,
                  }}>
                    Every {h}h{h === 6 ? ' (default)' : ''}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'listings' && <ListingsView status={status} />}
        {tab === 'approvals' && <ApprovalsView />}
        {tab === 'log' && <LogView status={status} scanInterval={scanInterval} />}
        {tab === 'settings' && <SettingsView onEditProfile={handleEditProfile} />}
        {tab === 'help' && <HelpView />}
      </div>

      {/* Model manager overlay */}
      {showModels && <ModelManagerView onClose={() => setShowModels(false)} />}

      {/* Status bar */}
      <div style={{
        height: 28, display: 'flex', alignItems: 'center', padding: '0 16px',
        background: c.panel, borderTop: `1px solid ${c.border}`,
        fontSize: 11, color: c.sub, gap: 16, flexShrink: 0,
      }}>
        <span>{status.listingCount} listing{status.listingCount !== 1 ? 's' : ''} in DB</span>
        {status.scanCycles > 0 && (
          <span>{status.scanCycles} scan{status.scanCycles !== 1 ? 's' : ''} done</span>
        )}
        {lastScanEmpty && !status.running && (
          <span style={{ color: '#6b7280' }}>Last scan: no new listings</span>
        )}
        {status.running && (
          <span style={{ color: '#a78bfa', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
            Scanning now…
          </span>
        )}
        {!status.running && timeToNext !== null && timeToNext > 0 && (
          <span style={{ color: '#a78bfa' }}>Next scan in {formatCountdown(timeToNext)}</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#333' }}>1–5 tabs · Ctrl+R run</span>
        <span>LuxRoom AI — MIT</span>
      </div>

      {/* Scan complete toast */}
      {scanToast && (
        <div style={{
          position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)',
          background: '#1a2e1a', border: '1px solid #4ade80', color: '#4ade80',
          padding: '10px 22px', borderRadius: 8, fontSize: 13, fontWeight: 600,
          zIndex: 9999, boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
        }}>
          {scanToast}
        </div>
      )}
    </div>
  )
}
