import React, { useState, useEffect } from 'react'
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
  const [status, setStatus] = useState({ running: false, lastCrawl: null, listingCount: 0 })
  const [runningNow, setRunningNow] = useState(false)

  // Onboarding state: null = loading, false = not done, true = done
  const [onboardingDone, setOnboardingDone] = useState(null)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showModels, setShowModels] = useState(false)

  // Load settings on mount to check onboarding status
  useEffect(() => {
    window.luxroom?.settings.get().then(s => {
      const done = s?.profile?.onboardingDone === true
      setOnboardingDone(done)
      setShowOnboarding(!done)
    }).catch(() => {
      setOnboardingDone(false)
      setShowOnboarding(true)
    })
  }, [])

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

  const handleOnboardingComplete = (profile) => {
    setOnboardingDone(true)
    setShowOnboarding(false)
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
          <button onClick={handleRunNow} disabled={runningNow} style={{
            padding: '5px 14px', borderRadius: 6, border: 'none',
            background: c.accent, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            opacity: runningNow ? 0.6 : 1,
          }}>
            {runningNow ? 'Running…' : 'Run Now'}
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {tab === 'listings' && <ListingsView />}
        {tab === 'approvals' && <ApprovalsView />}
        {tab === 'log' && <LogView status={status} />}
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
        {status.lastCrawl && (
          <span>Last crawl: {new Date(status.lastCrawl).toLocaleTimeString()}</span>
        )}
        <span style={{ marginLeft: 'auto' }}>LuxRoom AI — Open Source (MIT)</span>
      </div>
    </div>
  )
}
