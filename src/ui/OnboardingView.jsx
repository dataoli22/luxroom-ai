import { useState, useEffect, useRef } from 'react'
import SourceLogin from './SourceLogin.jsx'

const c = {
  bg: '#0f0f13',
  panel: '#1a1a24',
  border: '#2a2a3a',
  accent: '#7c5cbf',
  text: '#e8e8f0',
  sub: '#888',
  label: '#a0a0b8',
}

// ─── Shared primitives ────────────────────────────────────────────────────────

const inputStyle = {
  background: '#0f0f13',
  border: `1px solid ${c.border}`,
  color: c.text,
  padding: '9px 12px',
  borderRadius: '6px',
  fontSize: '14px',
  width: '100%',
  boxSizing: 'border-box',
  outline: 'none',
}

const labelStyle = {
  display: 'block',
  color: c.label,
  fontSize: '12px',
  fontWeight: '600',
  marginBottom: '6px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
}

function Field({ l, helper, children, fullWidth }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : undefined }}>
      <label style={labelStyle}>{l}</label>
      {children}
      {helper && <p style={{ color: '#5a5a7a', fontSize: '12px', marginTop: '4px', margin: '4px 0 0' }}>{helper}</p>}
    </div>
  )
}

function RadioGroup({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map(opt => (
        <button key={opt.value} onClick={() => onChange(opt.value)} style={{
          padding: '7px 16px', borderRadius: '20px', cursor: 'pointer',
          border: `1px solid ${value === opt.value ? c.accent : c.border}`,
          background: value === opt.value ? c.accent : 'transparent',
          color: value === opt.value ? '#fff' : c.sub,
          fontSize: '13px', fontWeight: value === opt.value ? 600 : 400,
          transition: 'all 0.15s',
        }}>{opt.label}</button>
      ))}
    </div>
  )
}

function CheckboxGroup({ value, onChange, options }) {
  const toggle = (v) => {
    const s = new Set(value)
    s.has(v) ? s.delete(v) : s.add(v)
    onChange([...s])
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {options.map(opt => {
        const active = value.includes(opt.value)
        return (
          <button key={opt.value} onClick={() => toggle(opt.value)} style={{
            padding: '7px 16px', borderRadius: '20px', cursor: 'pointer',
            border: `1px solid ${active ? c.accent : c.border}`,
            background: active ? c.accent : 'transparent',
            color: active ? '#fff' : c.sub,
            fontSize: '13px', fontWeight: active ? 600 : 400,
            transition: 'all 0.15s',
          }}>{opt.label}</button>
        )
      })}
    </div>
  )
}

function Toggle({ checked, onChange, id, label: lbl }) {
  return (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
      <input type="checkbox" id={id} checked={checked}
        onChange={e => onChange(e.target.checked)}
        style={{ width: 16, height: 16, accentColor: c.accent, cursor: 'pointer' }} />
      <span style={{ color: c.text, fontSize: '14px' }}>{lbl}</span>
    </label>
  )
}

function ExplainBox({ icon, heading, children }) {
  return (
    <div style={{
      gridColumn: '1 / -1',
      background: 'linear-gradient(135deg, #12102a 0%, #0d0d1a 100%)',
      border: '1px solid #2a2060',
      borderRadius: '10px',
      padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '18px' }}>{icon}</span>
        <span style={{ color: '#c4b5fd', fontWeight: 700, fontSize: '13px' }}>{heading}</span>
      </div>
      <div style={{ color: '#9090b8', fontSize: '13px', lineHeight: '1.65' }}>
        {children}
      </div>
    </div>
  )
}

function Term({ children }) {
  return <span style={{ color: '#c4b5fd', fontWeight: 600 }}>{children}</span>
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function Tooltip({ text, link, linkLabel, wide }) {
  const [show, setShow] = useState(false)
  const ref = useRef(null)

  return (
    <span
      ref={ref}
      style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle', marginLeft: 5 }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: 16, height: 16, borderRadius: '50%',
        background: '#2a2a4a', color: '#a0a0c8',
        fontSize: 10, fontWeight: 700,
        cursor: 'help', userSelect: 'none',
        border: '1px solid #3a3a5a',
        flexShrink: 0,
      }}>?</span>
      {show && (
        <div style={{
          position: 'absolute',
          left: '50%', bottom: 'calc(100% + 8px)',
          transform: 'translateX(-50%)',
          background: '#1c1c2e',
          border: '1px solid #3a3a5a',
          borderRadius: 10,
          padding: '12px 14px',
          width: wide ? 320 : 270,
          zIndex: 9999,
          boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
          pointerEvents: 'auto',
        }}>
          <div style={{ fontSize: 12, color: '#9090b8', lineHeight: 1.65, marginBottom: link ? 10 : 0 }}>
            {text}
          </div>
          {link && (
            <button
              onClick={() => window.luxroom?.shell?.openExternal(link)}
              style={{
                display: 'block', width: '100%', textAlign: 'center',
                background: '#2a1f4a', color: '#c4b5fd',
                border: '1px solid #5a4a8a', borderRadius: 6,
                padding: '6px 10px', fontSize: 11, cursor: 'pointer', fontWeight: 600,
              }}
            >{linkLabel || 'Open in browser →'}</button>
          )}
        </div>
      )}
    </span>
  )
}

// ─── Channel row ──────────────────────────────────────────────────────────────

function ChannelRow({ active, onToggle, icon, title, description, tooltip, disabled }) {
  return (
    <div
      onClick={disabled ? undefined : onToggle}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: active ? '#18102e' : '#12121e',
        border: `1px solid ${active ? c.accent : c.border}`,
        borderRadius: 10, padding: '12px 14px',
        cursor: disabled ? 'default' : 'pointer',
        transition: 'all 0.15s', userSelect: 'none',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 1,
        background: active ? c.accent : 'transparent',
        border: `2px solid ${active ? c.accent : '#3a3a5a'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <span style={{ color: '#fff', fontSize: 10 }}>✓</span>}
      </div>
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ color: active ? '#e8e8f0' : '#7a7a9a', fontWeight: 600, fontSize: 13 }}>{title}</span>
          {disabled && <span style={{ color: '#3a3a5a', fontSize: 11, fontStyle: 'italic' }}>always on</span>}
          {tooltip && <Tooltip text={tooltip.text} link={tooltip.link} linkLabel={tooltip.linkLabel} />}
        </div>
        <span style={{ color: '#5a5a7a', fontSize: 12, lineHeight: 1.5 }}>{description}</span>
      </div>
    </div>
  )
}

// ─── Approval mode card ───────────────────────────────────────────────────────

function ApprovalModeCard({ active, onSelect, icon, title, description, tag }) {
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 12,
        background: active ? '#18102e' : '#12121e',
        border: `1px solid ${active ? c.accent : c.border}`,
        borderRadius: 10, padding: '12px 14px',
        cursor: 'pointer', transition: 'all 0.15s', userSelect: 'none',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
        background: active ? c.accent : 'transparent',
        border: `2px solid ${active ? c.accent : '#3a3a5a'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {active && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'block' }} />}
      </div>
      <span style={{ fontSize: 18, flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3, flexWrap: 'wrap' }}>
          <span style={{ color: active ? '#e8e8f0' : '#7a7a9a', fontWeight: 600, fontSize: 13 }}>{title}</span>
          {tag && (
            <span style={{
              background: '#1a1f00', color: '#a3e635', border: '1px solid #3a4a00',
              borderRadius: 20, padding: '1px 8px', fontSize: 10, fontWeight: 700,
            }}>{tag}</span>
          )}
        </div>
        <span style={{ color: '#5a5a7a', fontSize: 12, lineHeight: 1.5 }}>{description}</span>
      </div>
    </div>
  )
}

// ─── SMTP auto-config ─────────────────────────────────────────────────────────

const SMTP_PRESETS = {
  'gmail.com':      { host: 'smtp.gmail.com',      port: 587, secure: false, note: 'Use a Gmail App Password — not your regular password.', appPasswordLink: 'https://myaccount.google.com/apppasswords' },
  'googlemail.com': { host: 'smtp.gmail.com',      port: 587, secure: false, note: 'Use a Gmail App Password.',                             appPasswordLink: 'https://myaccount.google.com/apppasswords' },
  'outlook.com':    { host: 'smtp.office365.com',  port: 587, secure: false, note: 'Use your regular Outlook password (or App Password if 2FA is on).', appPasswordLink: 'https://account.microsoft.com/security' },
  'hotmail.com':    { host: 'smtp.office365.com',  port: 587, secure: false, note: 'Use your regular Hotmail password.' },
  'live.com':       { host: 'smtp.office365.com',  port: 587, secure: false, note: 'Use your regular Microsoft password.' },
  'yahoo.com':      { host: 'smtp.mail.yahoo.com', port: 587, secure: false, note: 'Enable an App Password in Yahoo Account Security.', appPasswordLink: 'https://login.yahoo.com/account/security' },
  'icloud.com':     { host: 'smtp.mail.me.com',    port: 587, secure: true,  note: 'Use an App-Specific Password from Apple ID.', appPasswordLink: 'https://appleid.apple.com' },
  'me.com':         { host: 'smtp.mail.me.com',    port: 587, secure: true,  note: 'Use an App-Specific Password from Apple ID.', appPasswordLink: 'https://appleid.apple.com' },
  'protonmail.com': { host: '127.0.0.1',           port: 1025, secure: false, note: 'Requires Proton Mail Bridge running locally.', appPasswordLink: 'https://proton.me/mail/bridge' },
  'proton.me':      { host: '127.0.0.1',           port: 1025, secure: false, note: 'Requires Proton Mail Bridge running locally.', appPasswordLink: 'https://proton.me/mail/bridge' },
  'zoho.com':       { host: 'smtp.zoho.com',       port: 587, secure: false, note: 'Use your Zoho account password.' },
}

function getSmtpPreset(email) {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return SMTP_PRESETS[domain] ?? null
}

const CLOUD_KEY_LINKS = {
  'https://api.groq.com/openai/v1':    { text: 'Groq is free — no credit card. Sign up, go to API Keys and create one.', link: 'https://console.groq.com/keys', linkLabel: 'Open Groq Console →' },
  'https://openrouter.ai/api/v1':      { text: 'OpenRouter has free models. Create an account then go to Keys.', link: 'https://openrouter.ai/keys', linkLabel: 'Open OpenRouter →' },
  'https://api.together.xyz/v1':       { text: 'Together AI gives $25 free credit. Go to Settings → API Keys.', link: 'https://api.together.xyz/settings/api-keys', linkLabel: 'Open Together AI →' },
}

// ─── Luxembourg areas ─────────────────────────────────────────────────────────

const LU_AREAS = [
  {
    region: 'Luxembourg City',
    emoji: '🏙️',
    guide: 'Most convenient — walkable to everything and well-served by tram and bus. The downside: it\'s the most expensive. Expect €650–950/month for a room. Best if your workplace or campus is in Kirchberg, Cloche d\'Or or the Centre.',
    areas: ['Kirchberg', 'Limpertsberg', 'Bonnevoie', 'Belair', 'Gasperich', 'Hollerich', 'Merl', 'Cents', 'Weimerskirch', 'Hamm', 'Neudorf', 'Pfaffenthal', 'Clausen', 'Rollingergrund'],
  },
  {
    region: 'North — CFL Line 10',
    emoji: '⭐',
    tag: 'Best for students',
    guide: 'The hidden gem. CFL Line 10 runs direct trains to Luxembourg Gare → Kirchberg in ~25–35 min. Mersch, Lintgen, and Ettelbruck are dramatically cheaper (€380–580/month) and most students have no idea this option exists. Search here first.',
    areas: ['Mersch', 'Lintgen', 'Bissen', 'Schieren', 'Colmar-Berg', 'Ettelbruck', 'Diekirch', 'Walferdange', 'Steinsel'],
  },
  {
    region: 'Suburbs & Communes',
    emoji: '🌳',
    guide: 'Quiet residential communes ringing the city. Typically €500–750/month. Good bus connections. Bertrange and Strassen are popular with expat families — often furnished rooms available in shared houses.',
    areas: ['Strassen', 'Bertrange', 'Leudelange', 'Hesperange', 'Sandweiler', 'Niederanven', 'Contern', 'Kopstal', 'Mamer'],
  },
  {
    region: 'South — Minett',
    emoji: '🏭',
    guide: 'Home to the Uni of Luxembourg\'s Belval campus. Much cheaper at €380–600/month. Esch-sur-Alzette has a growing student scene, bars, and coworking spaces. Only viable if your destination is in the south — the commute to city-centre takes 35–45 min.',
    areas: ['Esch-sur-Alzette', 'Schifflange', 'Bettembourg', 'Dudelange', 'Differdange', 'Petange', 'Mondercange', 'Sanem'],
  },
]

function AreaPicker({ value, onChange }) {
  const selected = value
    ? value.split(',').map(s => s.trim()).filter(Boolean)
    : []

  function toggleArea(area) {
    const s = new Set(selected)
    s.has(area) ? s.delete(area) : s.add(area)
    onChange([...s].join(', '))
  }

  function toggleAll(areas) {
    const allSelected = areas.every(a => selected.includes(a))
    if (allSelected) {
      const s = new Set(selected)
      areas.forEach(a => s.delete(a))
      onChange([...s].join(', '))
    } else {
      const s = new Set([...selected, ...areas])
      onChange([...s].join(', '))
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {LU_AREAS.map(group => {
        const groupSelected = group.areas.filter(a => selected.includes(a))
        const allOn = groupSelected.length === group.areas.length
        return (
          <div key={group.region}>
            {/* Region header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, flexWrap: 'wrap', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>{group.emoji}</span>
                <span style={{ color: '#a0a0b8', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {group.region}
                </span>
                {group.tag && (
                  <span style={{
                    background: '#1a3a1a', color: '#4ade80', border: '1px solid #22c55e44',
                    borderRadius: 20, padding: '1px 7px', fontSize: 10, fontWeight: 700,
                  }}>{group.tag}</span>
                )}
                <Tooltip text={group.guide} wide />
              </div>
              <button onClick={() => toggleAll(group.areas)} style={{
                background: 'transparent', border: `1px solid ${c.border}`,
                borderRadius: 12, padding: '2px 9px', fontSize: 11,
                color: allOn ? '#c4b5fd' : '#5a5a7a', cursor: 'pointer',
              }}>
                {allOn ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            {/* Area chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {group.areas.map(area => {
                const active = selected.includes(area)
                return (
                  <button key={area} onClick={() => toggleArea(area)} style={{
                    padding: '5px 12px', borderRadius: 20, cursor: 'pointer',
                    border: `1px solid ${active ? c.accent : c.border}`,
                    background: active ? c.accent + '33' : 'transparent',
                    color: active ? '#c4b5fd' : c.sub,
                    fontSize: 12, fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s',
                  }}>{area}</button>
                )
              })}
            </div>
          </div>
        )
      })}
      {selected.length > 0 && (
        <div style={{
          background: '#0d0d1a', border: `1px solid ${c.border}`,
          borderRadius: 8, padding: '8px 12px',
          fontSize: 12, color: '#9090b8', lineHeight: 1.6,
        }}>
          <span style={{ color: '#5a5a7a' }}>Selected ({selected.length}): </span>
          {selected.join(', ')}
          <button onClick={() => onChange('')} style={{
            background: 'none', border: 'none', color: '#5a3a5a',
            fontSize: 11, cursor: 'pointer', marginLeft: 10,
          }}>Clear all</button>
        </div>
      )}
    </div>
  )
}

// ─── Install step row ─────────────────────────────────────────────────────────

function InstallStepRow({ step }) {
  const icons = { pending: '○', running: '◌', done: '✓', error: '✗' }
  const colors = { pending: '#3a3a5a', running: '#c4b5fd', done: '#4ade80', error: '#f87171' }
  const icon  = icons[step.status]
  const color = colors[step.status]

  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{
        width: 24, height: 24, borderRadius: '50%',
        border: `2px solid ${color}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0, marginTop: 1,
        background: step.status === 'done' ? '#0a2a0a' : step.status === 'error' ? '#2a0a0a' : 'transparent',
        position: 'relative',
      }}>
        {step.status === 'running' ? (
          <>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              border: '2px solid transparent',
              borderTopColor: color,
              animation: 'spin 0.7s linear infinite',
            }} />
          </>
        ) : (
          <span style={{ color, fontSize: 12, fontWeight: 700, lineHeight: 1 }}>{icon}</span>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: color === '#3a3a5a' ? c.sub : c.text, fontWeight: 600, fontSize: 13, marginBottom: 2 }}>
          {step.label}
        </div>
        {step.detail && (
          <div style={{ color: '#5a5a7a', fontSize: 12, lineHeight: 1.5, fontFamily: 'monospace' }}>
            {step.detail}
          </div>
        )}
        {step.status === 'running' && step.pct != null && (
          <div style={{ marginTop: 6, height: 3, background: '#1a1a2a', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: c.accent, borderRadius: 2,
              width: `${step.pct}%`, transition: 'width 0.3s',
            }} />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { title: 'Welcome',                   subtitle: "Let's set up LuxRoom AI for your housing search. Takes about 3 minutes." },
  { title: 'Your Device',               subtitle: 'We scanned your hardware and recommend the best AI setup for your laptop.' },
  { title: 'What You\'re Looking For',  subtitle: 'Tell us about the kind of place you need.' },
  { title: 'Location & Commute',        subtitle: 'Where do you want to live, and where do you need to get to?' },
  { title: 'Budget & Timing',           subtitle: 'What can you spend, and when do you need to move?' },
  { title: 'Final Preferences',         subtitle: 'A few more details so the AI knows exactly what to look for.' },
  { title: 'Notifications & Approvals', subtitle: 'Choose how you get alerted and how much the agent does on its own.' },
]

// ─── Default state ────────────────────────────────────────────────────────────

// Student-friendly defaults: room in LuxCity + Line 10 belt, €750, 60 min commute
const FAST_DEFAULTS = {
  housingType: 'room', furnished: 'any', smokingAllowed: false, genderPolicy: 'any',
  city: 'Luxembourg City',
  preferredAreas: 'Kirchberg, Limpertsberg, Bonnevoie, Mersch, Lintgen, Walferdange, Steinsel',
  commuteTo: '', maxCommuteMins: 60,
  maxBudget: '750', currency: 'EUR', moveInBy: '',
  domiciliationRequired: false, petsAllowed: false, parkingRequired: false,
  additionalNotes: '',
  languages: ['en', 'fr', 'de'],
}

const DEFAULT_PROFILE = {
  name: '', ...FAST_DEFAULTS, onboardingDone: false,
}

const DEFAULT_EMAIL = {
  notificationEmail: '', smtpHost: '', smtpPort: 587, smtpSecure: false,
  smtpUser: '', smtpPassword: '', smtpFrom: '',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function OnboardingView({ onComplete }) {
  const [fastMode, setFastMode] = useState(true)   // default: quick setup
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [emailCfg, setEmailCfg] = useState(DEFAULT_EMAIL)
  const [hw, setHw] = useState(null)
  const [hwDone, setHwDone] = useState(false)
  const [inferenceMode, setInferenceMode] = useState('local')
  const [cloudApiUrl, setCloudApiUrl] = useState('')
  const [cloudApiKey, setCloudApiKey] = useState('')
  const [cloudModel, setCloudModel] = useState('')
  const [localModel, setLocalModel] = useState('')
  const [ollamaApiKey, setOllamaApiKey] = useState('')
  const [notifyChannels, setNotifyChannels] = useState(['dashboard', 'desktop', 'email'])
  const [approvalMode, setApprovalMode] = useState('manual')
  const [saving, setSaving] = useState(false)
  // install phase — shown after wizard saves, before onComplete
  const [installing, setInstalling] = useState(false)
  const [installSteps, setInstallSteps] = useState([])   // { id, label, status: 'pending'|'running'|'done'|'error', detail }
  const [installDone, setInstallDone] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setHwDone(true), 10000) // fallback after 10s
    window.luxroom?.hardware?.detect().then(info => {
      clearTimeout(timer)
      setHw(info)
      setHwDone(true)
      if (info?.tier === 'cloud') {
        setInferenceMode('cloud')
        const groq = info.cloudPresets?.[0]
        if (groq) { setCloudApiUrl(groq.url); setCloudModel(groq.model) }
      }
      const top = info?.modelRecs?.[0]?.model
      if (top) setLocalModel(top)
    }).catch(() => { clearTimeout(timer); setHwDone(true) })
    return () => clearTimeout(timer)
  }, [])

  function sp(key, val)  { setProfile(p => ({ ...p, [key]: val })) }
  function se(key, val)  { setEmailCfg(p => ({ ...p, [key]: val })) }

  function canAdvance() {
    if (step === 0) return profile.name.trim().length > 0
    if (step === 3) return profile.city.trim().length > 0
    if (step === 4) return profile.maxBudget !== '' && Number(profile.maxBudget) > 0
    return true
  }

  const isLast = step === STEPS.length - 1

  async function handleFinish() {
    setSaving(true)
    try {
      const emailOn = notifyChannels.includes('email')
      const finalProfile = { ...profile, onboardingDone: true }
      const payload = {
        profile: finalProfile,
        INFERENCE_MODE: inferenceMode,
        OLLAMA_MODEL: localModel || undefined,
        OLLAMA_API_KEY: ollamaApiKey.trim() || undefined,
        APPROVAL_MODE: approvalMode,
        ENABLE_EMAIL_NOTIFICATIONS: emailOn ? 'true' : 'false',
        ENABLE_DESKTOP_NOTIFICATIONS: notifyChannels.includes('desktop') ? 'true' : 'false',
      }
      if (inferenceMode === 'cloud') {
        payload.CLOUD_API_URL = cloudApiUrl
        payload.CLOUD_API_KEY = cloudApiKey
        payload.CLOUD_MODEL   = cloudModel
      }
      if (emailCfg.notificationEmail && emailOn) {
        payload.NOTIFICATION_EMAIL = emailCfg.notificationEmail
        payload.SMTP_HOST          = emailCfg.smtpHost
        payload.SMTP_PORT          = String(emailCfg.smtpPort)
        payload.SMTP_SECURE        = emailCfg.smtpSecure ? 'true' : 'false'
        payload.SMTP_USER          = emailCfg.smtpUser || emailCfg.notificationEmail
        payload.SMTP_PASS          = (emailCfg.smtpPassword || '').replace(/\s+/g, '')
        payload.SMTP_FROM          = emailCfg.smtpFrom || `LuxRoom AI <${emailCfg.notificationEmail}>`
      }
      await window.luxroom?.settings.save(payload)

      // For local mode, run the install/pull phase before entering the app
      if (inferenceMode === 'local') {
        const steps = [
          { id: 'ollama', label: 'Install Ollama', status: 'pending', detail: '' },
          localModel ? { id: 'pull',   label: `Download model — ${localModel}`, status: 'pending', detail: '' } : null,
        ].filter(Boolean)
        setInstallSteps(steps)
        setInstalling(true)
        runInstall(steps, finalProfile)
      } else {
        onComplete(finalProfile)
      }
    } finally {
      setSaving(false)
    }
  }

  function updateStep(id, patch) {
    setInstallSteps(prev => prev.map(s => s.id === id ? { ...s, ...patch } : s))
  }

  async function runInstall(steps, finalProfile) {
    // Step 1 — Ollama
    updateStep('ollama', { status: 'running', detail: 'Checking…' })

    const unsubProgress = window.luxroom?.setup?.onProgress(({ phase, message, pct, error }) => {
      if (phase === 'install') updateStep('ollama', { detail: message, pct, status: error ? 'error' : 'running' })
      if (phase === 'pull')   updateStep('pull',   { detail: message, pct, status: error ? 'error' : 'running' })
    })

    try {
      const check = await window.luxroom?.setup?.checkOllama()
      if (check?.installed) {
        updateStep('ollama', { status: 'done', detail: `Already installed (${check.version})` })
      } else {
        await window.luxroom?.setup?.installOllama()
        updateStep('ollama', { status: 'done', detail: 'Installed successfully' })
      }
    } catch (err) {
      updateStep('ollama', { status: 'error', detail: err.message })
      // don't abort — user can still use the app
    }

    // Step 2 — pull model
    if (localModel) {
      updateStep('pull', { status: 'running', detail: 'Starting…' })
      try {
        await window.luxroom?.setup?.pullModel(localModel)
        updateStep('pull', { status: 'done', detail: 'Model ready' })
      } catch (err) {
        updateStep('pull', { status: 'error', detail: err.message })
      }
    }

    unsubProgress?.()
    setInstallDone(true)
  }

  // ── Fast setup screen ──────────────────────────────────────────────────────
  if (fastMode && !installing) {
    return (
      <FastSetup
        profile={profile} setProfile={setProfile}
        emailCfg={emailCfg} setEmailCfg={setEmailCfg}
        hw={hw} hwDone={hwDone}
        inferenceMode={inferenceMode} localModel={localModel}
        ollamaApiKey={ollamaApiKey} setOllamaApiKey={setOllamaApiKey}
        onCustomise={() => setFastMode(false)}
        onFinish={handleFinish}
        saving={saving}
      />
    )
  }

  // ── Install phase ──────────────────────────────────────────────────────────
  if (installing) {
    const allDone    = installSteps.every(s => s.status === 'done' || s.status === 'error')
    const anyError   = installSteps.some(s => s.status === 'error')
    const finalProfile = { ...profile, onboardingDone: true }
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', background: c.bg, padding: '32px 24px',
      }}>
        <div style={{ width: '100%', maxWidth: 520 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: c.text }}>LuxRoom AI</div>
            <div style={{ color: c.sub, fontSize: 13, marginTop: 5 }}>Setting up your AI — sit back for a minute</div>
          </div>
          <div style={{
            background: c.panel, border: `1px solid ${c.border}`,
            borderRadius: 16, padding: '28px 32px',
          }}>
            <h2 style={{ color: c.text, fontSize: 18, fontWeight: 700, margin: '0 0 6px' }}>Installing AI tools</h2>
            <p style={{ color: c.sub, fontSize: 13, margin: '0 0 24px', lineHeight: 1.6 }}>
              Ollama and your chosen model are being downloaded and installed automatically.
              This happens once — subsequent launches are instant.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {installSteps.map(step => (
                <InstallStepRow key={step.id} step={step} />
              ))}
            </div>
            {allDone && (
              <div style={{ marginTop: 28 }}>
                {anyError && (
                  <div style={{
                    background: '#1a0a0a', border: '1px solid #4a1a1a',
                    borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                    color: '#f87171', fontSize: 13, lineHeight: 1.6,
                  }}>
                    One or more steps had an issue. You can retry from Settings → Configure Models, or the pipeline will fall back to cloud mode if configured.
                  </div>
                )}
                {!anyError && (
                  <div style={{
                    background: '#0d1a0d', border: '1px solid #1a4a1a',
                    borderLeft: '3px solid #4ade80',
                    borderRadius: 8, padding: '12px 16px', marginBottom: 16,
                    fontSize: 13, color: '#6ee7b7', lineHeight: 1.7,
                  }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>✓ You're all set</div>
                    <div style={{ color: '#4a7a5a' }}>
                      LuxRoom AI scans housing sites every 3 hours — <strong style={{ color: '#6ee7b7' }}>even when the window is closed.</strong>
                      {' '}You'll get a desktop notification the moment a matching room is found.
                      Close the window any time; it keeps running quietly in your system tray.
                    </div>
                  </div>
                )}
                <button
                  onClick={() => onComplete(finalProfile)}
                  style={{
                    width: '100%', padding: '12px', borderRadius: 8, border: 'none',
                    background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                    color: '#fff', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(124,58,237,0.35)',
                  }}
                >
                  {anyError ? 'Continue anyway →' : 'Start scanning →'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      minHeight: '100vh', background: c.bg, padding: '32px 24px',
      overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: '600px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ fontSize: '26px', fontWeight: '800', color: c.text, letterSpacing: '-0.5px' }}>
            LuxRoom AI
          </div>
          <div style={{ color: c.sub, fontSize: '13px', marginTop: '5px' }}>
            Open-source automated housing search · runs on your laptop
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: '5px', marginBottom: '24px' }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{
              flex: 1, height: '3px', borderRadius: '2px',
              background: i <= step ? c.accent : c.border,
              transition: 'background 0.3s',
            }} />
          ))}
        </div>

        {/* Card */}
        <div style={{
          background: c.panel, border: `1px solid ${c.border}`,
          borderRadius: '16px', padding: '28px 32px',
        }}>
          <div style={{ color: '#5a5a7a', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
            Step {step + 1} of {STEPS.length}
          </div>
          <h2 style={{ color: c.text, fontSize: '20px', fontWeight: '700', margin: '0 0 4px' }}>
            {STEPS[step].title}
          </h2>
          <p style={{ color: c.sub, fontSize: '13px', margin: '0 0 22px', lineHeight: '1.5' }}>
            {STEPS[step].subtitle}
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {step === 0 && <StepAboutYou profile={profile} set={sp} />}
            {step === 1 && (
              <StepDevice
                hw={hw} hwDone={hwDone}
                inferenceMode={inferenceMode} setInferenceMode={setInferenceMode}
                cloudApiUrl={cloudApiUrl} setCloudApiUrl={setCloudApiUrl}
                cloudApiKey={cloudApiKey} setCloudApiKey={setCloudApiKey}
                cloudModel={cloudModel} setCloudModel={setCloudModel}
                localModel={localModel} setLocalModel={setLocalModel}
              />
            )}
            {step === 2 && <StepHousingType profile={profile} set={sp} />}
            {step === 3 && <StepLocation profile={profile} set={sp} />}
            {step === 4 && <StepBudget profile={profile} set={sp} />}
            {step === 5 && <StepPreferences profile={profile} set={sp} />}
            {step === 6 && (
              <StepNotifications
                cfg={emailCfg} set={se}
                notifyChannels={notifyChannels} setNotifyChannels={setNotifyChannels}
                approvalMode={approvalMode} setApprovalMode={setApprovalMode}
              />
            )}
          </div>
        </div>

        {/* Nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px', alignItems: 'center' }}>
          <button onClick={() => setStep(s => s - 1)} disabled={step === 0} style={{
            padding: '10px 22px', borderRadius: '8px',
            border: `1px solid ${c.border}`, background: 'transparent',
            color: step === 0 ? '#2a2a3a' : c.sub,
            fontSize: '14px', cursor: step === 0 ? 'default' : 'pointer',
          }}>Back</button>

          {!isLast && (
            <span style={{ color: '#3a3a5a', fontSize: '12px' }}>
              You can change all of this later in Settings
            </span>
          )}

          <button
            onClick={isLast ? handleFinish : () => setStep(s => s + 1)}
            disabled={!canAdvance() || saving}
            style={{
              padding: '10px 28px', borderRadius: '8px', border: 'none',
              background: canAdvance() && !saving ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : c.border,
              color: canAdvance() && !saving ? '#fff' : c.sub,
              fontSize: '14px', fontWeight: '700',
              cursor: canAdvance() && !saving ? 'pointer' : 'default',
              boxShadow: canAdvance() && !saving ? '0 4px 16px rgba(124,58,237,0.35)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {saving ? 'Saving…' : isLast ? '🚀 Start Searching' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Fast Setup ───────────────────────────────────────────────────────────────

const FAST_PRESETS_DISPLAY = [
  { icon: '🛏', label: 'Room in shared flat' },
  { icon: '📍', label: 'Luxembourg City + Line 10 north' },
  { icon: '💶', label: '€750 / month budget' },
  { icon: '🚌', label: '60 min max commute' },
  { icon: '🌍', label: 'Outreach in landlord\'s language (auto)' },
  { icon: '🖥️', label: 'AI runs locally on your device' },
]

function FastSetup({ profile, setProfile, emailCfg, setEmailCfg, hw, hwDone, inferenceMode, localModel, ollamaApiKey, setOllamaApiKey, onCustomise, onFinish, saving }) {
  const preset      = getSmtpPreset(emailCfg.notificationEmail)
  const hasAt       = emailCfg.notificationEmail.includes('@')
  const knownDomain = preset !== null && hasAt
  const [emailTest, setEmailTest] = useState(null)

  function onEmailChange(email) {
    setEmailCfg(p => ({ ...p, notificationEmail: email }))
    const p = getSmtpPreset(email)
    if (p) setEmailCfg(prev => ({ ...prev, notificationEmail: email, smtpHost: p.host, smtpPort: p.port, smtpSecure: p.secure }))
  }

  async function handleTestEmail() {
    setEmailTest('testing')
    try {
      // Pass the just-entered config — settings aren't saved yet during onboarding.
      const config = {
        host: emailCfg.smtpHost,
        port: emailCfg.smtpPort,
        secure: emailCfg.smtpSecure,
        user: emailCfg.smtpUser || emailCfg.notificationEmail,
        pass: (emailCfg.smtpPassword || '').replace(/\s+/g, ''),
        from: emailCfg.smtpFrom || `LuxRoom AI <${emailCfg.notificationEmail}>`,
      }
      const r = await window.luxroom?.email?.test(emailCfg.notificationEmail, config)
      setEmailTest(r?.ok ? 'ok' : 'fail')
    } catch { setEmailTest('fail') }
    setTimeout(() => setEmailTest(null), 5000)
  }

  const canGo = profile.name.trim().length > 0 && hasAt && emailCfg.smtpPassword.length > 0

  const appPasswordTooltip = preset?.appPasswordLink
    ? { text: preset.note, link: preset.appPasswordLink, linkLabel: 'Open in browser →' }
    : { text: 'Use your email account password or an app-specific password if 2-factor is enabled.' }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: c.bg, padding: '32px 24px', overflowY: 'auto',
    }}>
      <div style={{ width: '100%', maxWidth: 520 }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: c.text, letterSpacing: '-0.5px' }}>LuxRoom AI</div>
          <div style={{ color: c.sub, fontSize: 13, marginTop: 6 }}>
            Automated housing search · open source · runs on your laptop
          </div>
        </div>

        <div style={{ background: c.panel, border: `1px solid ${c.border}`, borderRadius: 16, padding: '28px 32px' }}>

          <div style={{ marginBottom: 22 }}>
            <h2 style={{ color: c.text, fontSize: 19, fontWeight: 700, margin: '0 0 6px' }}>Quick setup</h2>
            <p style={{ color: c.sub, fontSize: 13, margin: 0, lineHeight: 1.6 }}>
              We'll pre-fill everything with student-friendly defaults. Fill in 3 fields and you're done.
            </p>
          </div>

          {/* What's pre-filled */}
          <div style={{
            background: '#0d0d1a', border: `1px solid ${c.border}`,
            borderRadius: 10, padding: '14px 16px', marginBottom: 24,
          }}>
            <div style={{ color: '#5a5a7a', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Pre-filled defaults
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px 12px' }}>
              {FAST_PRESETS_DISPLAY.map(p => (
                <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span style={{ fontSize: 13 }}>{p.icon}</span>
                  <span style={{ color: '#7a7a9a', fontSize: 12 }}>{p.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The 3 required fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div>
              <label style={labelStyle}>Your first name</label>
              <input autoFocus style={inputStyle} value={profile.name}
                onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Priya" />
            </div>

            <div>
              <label style={labelStyle}>Your email address</label>
              <input style={inputStyle} type="email" value={emailCfg.notificationEmail}
                onChange={e => onEmailChange(e.target.value)}
                placeholder="you@gmail.com" />
              {knownDomain && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 8,
                  background: '#0a1f0a', border: '1px solid #1a4a1a',
                  borderRadius: 7, padding: '9px 12px',
                }}>
                  <span style={{ color: '#4ade80', fontSize: 13, flexShrink: 0 }}>✓</span>
                  <div>
                    <div style={{ color: '#4ade80', fontSize: 12, fontWeight: 600 }}>
                      {preset.host} auto-configured
                    </div>
                    <div style={{ color: '#3a6a3a', fontSize: 12, marginTop: 2 }}>
                      Next, enter your App Password below.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={labelStyle}>
                {knownDomain ? 'App Password' : 'Email password or App Password'}
                <Tooltip {...appPasswordTooltip} />
              </label>

              {/* Prominent callout for Gmail/known providers */}
              {preset?.appPasswordLink && (
                <div style={{
                  background: '#1a1400', border: '1px solid #5a4400',
                  borderLeft: '3px solid #fbbf24',
                  borderRadius: 7, padding: '10px 13px', marginBottom: 8,
                  fontSize: 13, lineHeight: 1.6,
                }}>
                  <span style={{ color: '#fbbf24', fontWeight: 700 }}>⚠ Do not use your regular password.</span>
                  <span style={{ color: '#a89060' }}> {preset.note.replace(/Use a |Use an |Use your regular /, '')}</span>
                  <br />
                  <button
                    onClick={() => window.luxroom?.shell?.openExternal(preset.appPasswordLink)}
                    style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: '4px 0 0', display: 'inline-block', fontWeight: 600 }}
                  >
                    Get your App Password here →
                  </button>
                </div>
              )}

              <input style={inputStyle} type="password" value={emailCfg.smtpPassword}
                onChange={e => setEmailCfg(p => ({ ...p, smtpPassword: e.target.value }))}
                placeholder={knownDomain ? 'Paste your app password here' : 'Your email password'}
                onKeyDown={e => e.key === 'Enter' && canGo && onFinish()}
              />
              <p style={{ color: '#5a5a7a', fontSize: 12, margin: '5px 0 0', lineHeight: 1.5 }}>
                Stored only on your device — only used to send you listing alerts.
              </p>
              {emailCfg.smtpPassword.length > 0 && hasAt && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
                  <button
                    onClick={handleTestEmail}
                    disabled={emailTest === 'testing'}
                    style={{
                      background: '#1a1a2e', border: '1px solid #3a3a5a',
                      color: '#c4b5fd', padding: '7px 14px', borderRadius: 6,
                      fontSize: 12, fontWeight: 600, cursor: emailTest === 'testing' ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {emailTest === 'testing' ? 'Sending…' : 'Send test email'}
                  </button>
                  {emailTest === 'ok' && <span style={{ color: '#4ade80', fontSize: 12 }}>✓ Email sent!</span>}
                  {emailTest === 'fail' && <span style={{ color: '#f87171', fontSize: 12 }}>✗ Failed — check your App Password</span>}
                </div>
              )}
            </div>

            {/* Ollama API key — optional but highly recommended */}
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                Ollama API key
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                  color: '#6ee7b7', background: '#0d2b1a', border: '1px solid #1a4a1a',
                  borderRadius: 10, padding: '2px 8px', textTransform: 'none',
                }}>Optional · Highly recommended</span>
                <Tooltip
                  wide
                  text={'A free Ollama account key lets LuxRoom AI use Ollama’s hosted models when your laptop is low on memory or the local model is slow — so analysis keeps working reliably at no cost. Sign in at ollama.com, open Settings → Keys, create a key, and paste it here. You can also add this later in Settings.'}
                  link={'https://ollama.com/settings/keys'}
                  linkLabel={'Get your free Ollama key →'}
                />
              </label>
              <input
                style={inputStyle}
                type="password"
                value={ollamaApiKey}
                onChange={e => setOllamaApiKey(e.target.value)}
                placeholder="Paste your Ollama key (recommended) — or leave blank to run fully local"
              />
              <p style={{ color: '#5a5a7a', fontSize: 12, margin: '5px 0 0', lineHeight: 1.5 }}>
                Leave blank to run entirely on your own machine. Stored only on your device.
              </p>
            </div>

            {/* Connect Appartager — login-gated but high-value source */}
            <div>
              <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                Connect Appartager
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
                  color: '#6ee7b7', background: '#0d2b1a', border: '1px solid #1a4a1a',
                  borderRadius: 10, padding: '2px 8px', textTransform: 'none',
                }}>Optional · Recommended</span>
              </label>
              <SourceLogin
                source="appartager"
                label="Appartager"
                note="One of the best room sources in Luxembourg, but it only shows listings to members. Log in once now and LuxRoom AI will scan it for you. You can also do this later in Settings."
              />
            </div>

            {/* AI status pill */}
            {hwDone && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#0d0d1a', border: `1px solid ${c.border}`,
                borderRadius: 7, padding: '9px 12px',
              }}>
                <span style={{ fontSize: 13 }}>🧠</span>
                <div style={{ flex: 1, fontSize: 12, color: '#7a7a9a' }}>
                  {hw
                    ? <>AI: <span style={{ color: localModel ? '#c4b5fd' : c.sub }}>{localModel || 'auto-selected model'}</span> · runs locally on your device</>
                    : <>AI: will install Ollama automatically after setup</>
                  }
                </div>
              </div>
            )}

            <button
              onClick={onFinish}
              disabled={!canGo || saving}
              style={{
                width: '100%', padding: 14, borderRadius: 8, border: 'none',
                background: canGo && !saving ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : c.border,
                color: canGo && !saving ? '#fff' : c.sub,
                fontSize: 15, fontWeight: 700,
                cursor: canGo && !saving ? 'pointer' : 'default',
                boxShadow: canGo && !saving ? '0 4px 20px rgba(124,58,237,0.4)' : 'none',
                transition: 'all 0.15s', marginTop: 4,
              }}
            >{saving ? 'Setting up…' : '🚀 Start Searching'}</button>

          </div>
        </div>

        {/* Customise link */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <button onClick={onCustomise} style={{
            background: 'none', border: 'none', color: '#4a4a6a',
            fontSize: 13, cursor: 'pointer', textDecoration: 'underline', padding: 0,
          }}>
            Customise budget, areas, housing type, and more →
          </button>
        </div>

      </div>
    </div>
  )
}

// ─── Step 0: About You ────────────────────────────────────────────────────────

function StepAboutYou({ profile, set }) {
  return (
    <>
      <ExplainBox icon="✍️" heading="What is this used for?">
        LuxRoom AI finds listings on housing sites and <Term>writes outreach messages to landlords on your behalf</Term> — automatically in the same language the landlord used (French, German, Luxembourgish, or English). It signs them with your name, so replies land directly in your inbox.<br /><br />
        You <Term>always review and approve</Term> every message before it's sent. Nothing goes out without your say-so.
      </ExplainBox>

      <Field l="Your first name" helper="Used to sign outreach messages e.g. 'Best regards, Priya'" fullWidth>
        <input style={inputStyle} value={profile.name} autoFocus
          onChange={e => set('name', e.target.value)} placeholder="e.g. Priya" />
      </Field>

      <Field l="Languages you can read listings in" helper="The AI auto-detects the listing language for outreach — these tell it which listings to show you" fullWidth>
        <CheckboxGroup
          value={profile.languages}
          onChange={v => set('languages', v.length ? v : ['en'])}
          options={[
            { value: 'en', label: '🇬🇧 English' },
            { value: 'fr', label: '🇫🇷 French' },
            { value: 'de', label: '🇩🇪 German' },
            { value: 'lb', label: '🇱🇺 Luxembourgish' },
            { value: 'pt', label: '🇵🇹 Portuguese' },
          ]}
        />
        <p style={{ color: '#5a5a7a', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>
          Outreach messages are <strong style={{ color: '#7a7a9a' }}>auto-written in the landlord's language</strong> — no configuration needed.
        </p>
      </Field>
    </>
  )
}

// ─── Step 1: Device / AI setup ────────────────────────────────────────────────

const TIER_STYLE = {
  high:   { bg: '#0a1f0a', border: '#1a4a1a', text: '#6ee7b7', badge: '🟢 High Performance' },
  medium: { bg: '#0d1a0d', border: '#1e3a1e', text: '#86efac', badge: '🟡 Medium — CPU OK' },
  low:    { bg: '#1a1500', border: '#3a3000', text: '#fbbf24', badge: '🟠 Low RAM — small model' },
  cloud:  { bg: '#1a0505', border: '#3a0a0a', text: '#f87171', badge: '🔴 Cloud API recommended' },
}

function StepDevice({ hw, hwDone, inferenceMode, setInferenceMode, cloudApiUrl, setCloudApiUrl, cloudApiKey, setCloudApiKey, cloudModel, setCloudModel, localModel, setLocalModel }) {
  const tier    = hw?.tier ?? 'low'
  const ts      = TIER_STYLE[tier]
  const presets = hw?.cloudPresets ?? []
  const selectedPreset = presets.find(p => p.url === cloudApiUrl)
  const keyTooltip = CLOUD_KEY_LINKS[cloudApiUrl] ?? {
    text: 'Create an account with your chosen provider and generate an API key from your account settings.',
  }

  return (
    <>
      <ExplainBox icon="🧠" heading="What is 'local AI' and why does it matter?">
        LuxRoom AI uses a small language model to <Term>read each listing page and extract the key details</Term> (price, location, availability) for you. Instead of sending your data to a company's servers, this runs <Term>entirely on your laptop</Term> — private, free, and offline.<br /><br />
        The tool that makes this possible is called <Term>Ollama</Term>. It's a free, one-click install that lets you run AI models like you run any other app. If your laptop has limited RAM (common for students!), we'll suggest a lightweight model or a free cloud option instead.
      </ExplainBox>

      {/* Hardware card */}
      <div style={{ gridColumn: '1 / -1' }}>
        {!hwDone ? (
          <div style={{
            background: '#12121e', border: `1px solid ${c.border}`,
            borderRadius: '10px', padding: '16px 18px',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%',
              border: '2px solid #3a3a5a', borderTopColor: c.accent,
              animation: 'spin 0.8s linear infinite',
              flexShrink: 0,
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <span style={{ color: c.sub, fontSize: 13 }}>Scanning your hardware…</span>
          </div>
        ) : hw ? (
          <div style={{
            background: ts.bg, border: `1px solid ${ts.border}`,
            borderRadius: '10px', padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <span style={{ color: c.text, fontWeight: 700, fontSize: 13 }}>Your Hardware</span>
              <span style={{ background: ts.border, color: ts.text, padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700 }}>
                {ts.badge}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '5px 16px', fontSize: 13 }}>
              <span style={{ color: c.sub }}>CPU</span><span style={{ color: c.text }}>{hw.cpu}</span>
              <span style={{ color: c.sub }}>RAM</span><span style={{ color: c.text }}>{hw.totalRamGB} GB total · {hw.freeRamGB} GB free</span>
              <span style={{ color: c.sub }}>GPU</span><span style={{ color: c.text }}>{hw.gpus?.[0] ?? 'Integrated / none detected'}</span>
            </div>
            {hw.warning && (
              <div style={{ marginTop: 12, color: ts.text, fontSize: 12, lineHeight: 1.6, borderTop: `1px solid ${ts.border}`, paddingTop: 10 }}>
                ⚠️ {hw.warning}
              </div>
            )}
          </div>
        ) : (
          <div style={{
            background: '#12121e', border: `1px solid ${c.border}`,
            borderRadius: '10px', padding: '14px 18px',
            color: '#5a5a7a', fontSize: 13, lineHeight: 1.6,
          }}>
            Could not auto-detect hardware. Choose your preferred setup below — you can always change it in Settings.
          </div>
        )}
      </div>

      {/* Mode toggle */}
      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Where should the AI run?</label>
        <RadioGroup
          value={inferenceMode}
          onChange={setInferenceMode}
          options={[
            { value: 'local', label: '🖥️ On my device (Ollama)' },
            { value: 'cloud', label: '☁️ Free cloud API' },
          ]}
        />
        <p style={{ color: '#5a5a7a', fontSize: 12, marginTop: 8, lineHeight: 1.5, margin: '8px 0 0' }}>
          <strong style={{ color: '#7a7a9a' }}>On-device</strong> — nothing leaves your laptop, zero cost. <strong style={{ color: '#7a7a9a' }}>Cloud</strong> — uses a free third-party API; useful if your laptop has under 8 GB RAM.
        </p>
      </div>

      {/* LOCAL: model picker */}
      {inferenceMode === 'local' && hw?.modelRecs?.length > 0 && (
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={labelStyle}>Recommended model for your device</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {hw.modelRecs.map(rec => {
              const active = localModel === rec.model
              return (
                <button key={rec.model} onClick={() => setLocalModel(rec.model)} style={{
                  textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                  border: `1px solid ${active ? c.accent : c.border}`,
                  background: active ? '#1a1030' : 'transparent',
                  transition: 'all 0.15s', width: '100%',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ color: active ? '#c4b5fd' : c.text, fontWeight: 600, fontSize: 13 }}>{rec.model}</span>
                    <span style={{ color: c.sub, fontSize: 12 }}>{rec.size}</span>
                  </div>
                  <div style={{ color: c.sub, fontSize: 12 }}>{rec.note}</div>
                </button>
              )
            })}
          </div>
          {localModel && (
            <div style={{ marginTop: 10, background: '#0d0d1a', border: `1px solid ${c.border}`, borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ color: '#5a5a7a', fontSize: 11, marginBottom: 4 }}>After installing Ollama, run this in your terminal:</div>
              <code style={{ color: '#c4b5fd', fontSize: 13 }}>ollama pull {localModel}</code>
            </div>
          )}
        </div>
      )}

      {/* CLOUD: provider + key */}
      {inferenceMode === 'cloud' && (
        <>
          <ExplainBox icon="☁️" heading="How cloud inference works">
            Only the raw listing HTML is sent to the cloud API for data extraction. Your personal details, search preferences, and outreach messages <Term>never leave your device</Term>.<br /><br />
            <Term>Groq</Term> is the recommended option — free tier (14,400 requests/day), no credit card required.
          </ExplainBox>

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Pick a provider</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {presets.map(p => {
                const active = cloudApiUrl === p.url
                return (
                  <button key={p.url} onClick={() => { setCloudApiUrl(p.url); setCloudModel(p.model) }} style={{
                    textAlign: 'left', padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${active ? c.accent : c.border}`,
                    background: active ? '#1a1030' : 'transparent',
                    transition: 'all 0.15s', width: '100%',
                  }}>
                    <div style={{ color: active ? '#c4b5fd' : c.text, fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{p.label}</div>
                    <div style={{ color: c.sub, fontSize: 12 }}>{p.note}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {selectedPreset && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>Model</label>
              <RadioGroup value={cloudModel} onChange={setCloudModel}
                options={selectedPreset.models.map(m => ({ value: m, label: m }))} />
            </div>
          )}

          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>
              API key (optional — can add later)
              <Tooltip text={keyTooltip.text} link={keyTooltip.link} linkLabel={keyTooltip.linkLabel} />
            </label>
            <input style={inputStyle} type="password" value={cloudApiKey}
              onChange={e => setCloudApiKey(e.target.value)}
              placeholder="Paste your key here (e.g. gsk_...)" />
            <p style={{ color: '#5a5a7a', fontSize: 12, marginTop: 6, margin: '6px 0 0' }}>
              Stored only on your device. Only sent to the provider you chose above — never anywhere else.
            </p>
          </div>
        </>
      )}
    </>
  )
}

// ─── Step 2: Housing type ─────────────────────────────────────────────────────

function StepHousingType({ profile, set }) {
  return (
    <>
      <ExplainBox icon="🏠" heading="Types of housing — what's the difference?">
        <Term>Room in a shared flat</Term> (colocation, WG, flatshare) is the most affordable option for students. You get your own bedroom and share the kitchen, bathroom, and common areas. Great for meeting people and splitting bills.<br /><br />
        A <Term>studio</Term> is a self-contained apartment — one room with a kitchen corner and bathroom. More private, but significantly more expensive.<br /><br />
        <Term>Furnished</Term> means the room comes with a bed, wardrobe, and desk. Highly recommended if you're moving internationally.
      </ExplainBox>

      <Field l="Type of housing" fullWidth>
        <RadioGroup value={profile.housingType} onChange={v => set('housingType', v)} options={[
          { value: 'room', label: '🛏 Room in shared flat' },
          { value: 'studio', label: '🚪 Studio apartment' },
          { value: 'apartment', label: '🏢 Full apartment' },
          { value: 'any', label: '🔍 Any' },
        ]} />
      </Field>

      <Field l="Furnished?" fullWidth>
        <RadioGroup value={profile.furnished} onChange={v => set('furnished', v)} options={[
          { value: 'yes', label: 'Furnished only' },
          { value: 'no', label: 'Unfurnished only' },
          { value: 'any', label: 'Either is fine' },
        ]} />
      </Field>

      <Field l="Smoking environment" fullWidth>
        <RadioGroup value={profile.smokingAllowed ? 'yes' : 'no'} onChange={v => set('smokingAllowed', v === 'yes')} options={[
          { value: 'no', label: 'Non-smoking only' },
          { value: 'yes', label: 'Smoking is OK' },
        ]} />
      </Field>

      <Field l="Flatmate gender preference" helper="Only relevant for shared flats" fullWidth>
        <RadioGroup value={profile.genderPolicy} onChange={v => set('genderPolicy', v)} options={[
          { value: 'any', label: 'No preference' },
          { value: 'female_only', label: 'Female only' },
          { value: 'male_only', label: 'Male only' },
          { value: 'mixed', label: 'Mixed OK' },
        ]} />
      </Field>
    </>
  )
}

// ─── Step 3: Location & Commute ───────────────────────────────────────────────

function StepLocation({ profile, set }) {
  const isLux = profile.city.toLowerCase().includes('luxembourg')

  return (
    <>
      <ExplainBox icon="🚌" heading="Commute scoring & area guide">
        Every listing is scored partly on <Term>how long the commute is</Term> to your destination. The agent estimates public transport travel time and penalises listings that are too far.<br /><br />
        <Term>Key tip:</Term> don't limit your search to the city. The CFL <Term>Line 10</Term> north runs direct trains to Kirchberg — towns like Mersch are only ~25 min away and dramatically cheaper. Many students miss this.
      </ExplainBox>

      <Field l="City or region" helper="The agent will search housing sites for this area" fullWidth>
        <input style={inputStyle} value={profile.city} autoFocus
          onChange={e => set('city', e.target.value)} placeholder="e.g. Luxembourg City" />
      </Field>

      <Field l="Where do you need to commute to?" helper="Your campus, office, or regular destination" fullWidth>
        <input style={inputStyle} value={profile.commuteTo}
          onChange={e => set('commuteTo', e.target.value)}
          placeholder="e.g. Uni Luxembourg, Kirchberg campus" />
      </Field>

      <Field l="Maximum commute time (minutes)" helper="One-way, by public transport" fullWidth>
        <input style={inputStyle} type="number" value={profile.maxCommuteMins}
          onChange={e => set('maxCommuteMins', Number(e.target.value))} min={5} max={180} />
      </Field>

      {/* Area picker — shown for Luxembourg searches */}
      <div style={{ gridColumn: '1 / -1' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <label style={{ ...labelStyle, marginBottom: 0 }}>
            {isLux ? 'Preferred areas in Luxembourg' : 'Preferred neighbourhoods or areas'}
          </label>
        </div>
        {isLux ? (
          <>
            <p style={{ color: '#5a5a7a', fontSize: 12, marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
              Select the areas you'd consider. Hover the <strong style={{ color: '#7a7a9a' }}>?</strong> next to each region for a student guide. Leave all unchecked to search everywhere.
            </p>
            <AreaPicker value={profile.preferredAreas} onChange={v => set('preferredAreas', v)} />
          </>
        ) : (
          <input style={inputStyle} value={profile.preferredAreas}
            onChange={e => set('preferredAreas', e.target.value)}
            placeholder="e.g. Kirchberg, Limpertsberg, Bonnevoie (comma-separated)" />
        )}
      </div>
    </>
  )
}

// ─── Step 4: Budget & Timing ──────────────────────────────────────────────────

function StepBudget({ profile, set }) {
  return (
    <>
      <ExplainBox icon="💶" heading="Understanding rental prices in Luxembourg">
        Listings often quote rent <Term>all-inclusive</Term> (charges comprises / Nebenkosten inklusive) — meaning utilities, WiFi, and sometimes cleaning are included. This is the real number to compare.<br /><br />
        Some listings show rent <Term>excluding charges</Term> — add ~€100–150/month for utilities on top.<br /><br />
        Typical ranges: city rooms €650–950 · suburbs €500–750 · Line 10 north €380–580 · Minett (Belval) €380–600.
      </ExplainBox>

      <Field l="Your maximum monthly budget" helper="Set this to the most you'd pay, all-inclusive">
        <input style={inputStyle} type="number" value={profile.maxBudget} autoFocus
          onChange={e => set('maxBudget', e.target.value)} placeholder="e.g. 750" min={0} />
      </Field>

      <Field l="Currency">
        <RadioGroup value={profile.currency} onChange={v => set('currency', v)} options={[
          { value: 'EUR', label: '€ EUR' },
          { value: 'GBP', label: '£ GBP' },
          { value: 'USD', label: '$ USD' },
          { value: 'CHF', label: 'CHF' },
        ]} />
      </Field>

      <Field l="When do you need to move in?" helper="The agent prioritises listings available on or before this date" fullWidth>
        <input style={inputStyle} type="date" value={profile.moveInBy}
          onChange={e => set('moveInBy', e.target.value)} />
      </Field>
    </>
  )
}

// ─── Step 5: Preferences ─────────────────────────────────────────────────────

function StepPreferences({ profile, set }) {
  return (
    <>
      <ExplainBox icon="📋" heading="What is domiciliation?">
        <Term>Domiciliation</Term> means officially registering your address with the local town hall (commune). In Luxembourg, this is <Term>required by law</Term> if you stay more than 3 months — and essential for your student residence permit.<br /><br />
        Some landlords <Term>refuse to allow domiciliation</Term> (for tax or legal reasons). If you're on a student visa, always confirm this before signing — finding out after is a serious problem. Turn this on and the AI will flag listings that refuse it.
      </ExplainBox>

      <Field l="Additional requirements" fullWidth>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Toggle id="domiciliation" checked={profile.domiciliationRequired}
            onChange={v => set('domiciliationRequired', v)}
            label="Domiciliation required (for visa / residence permit)" />
          <Toggle id="pets" checked={profile.petsAllowed}
            onChange={v => set('petsAllowed', v)} label="Must allow pets" />
          <Toggle id="parking" checked={profile.parkingRequired}
            onChange={v => set('parkingRequired', v)} label="Parking space required" />
        </div>
      </Field>

      <Field l="Anything else the agent should know?" helper="Free text — the AI reads this directly when scoring listings" fullWidth>
        <textarea style={{ ...inputStyle, minHeight: '88px', resize: 'vertical' }}
          value={profile.additionalNotes}
          onChange={e => set('additionalNotes', e.target.value)}
          placeholder="e.g. Need a proper desk to work from. Quiet building. Close to a tram stop. Hate damp rooms." />
      </Field>
    </>
  )
}

// ─── Step 6: Notifications & Approvals ───────────────────────────────────────

function StepNotifications({ cfg, set, notifyChannels, setNotifyChannels, approvalMode, setApprovalMode }) {
  const preset      = getSmtpPreset(cfg.notificationEmail)
  const hasAt       = cfg.notificationEmail.includes('@')
  const knownDomain = preset !== null && hasAt
  const emailOn     = notifyChannels.includes('email')

  function toggleChannel(ch) {
    setNotifyChannels(prev =>
      prev.includes(ch) ? prev.filter(x => x !== ch) : [...prev, ch]
    )
  }

  function onEmailChange(email) {
    set('notificationEmail', email)
    const p = getSmtpPreset(email)
    if (p) { set('smtpHost', p.host); set('smtpPort', p.port); set('smtpSecure', p.secure) }
  }

  const appPasswordTooltip = preset?.appPasswordLink
    ? { text: preset.note, link: preset.appPasswordLink, linkLabel: 'Open in browser →' }
    : { text: preset?.note ?? 'Use your email account password, or an app-specific password if required.' }

  return (
    <>
      <ExplainBox icon="📬" heading="How alerts and approvals work together">
        When the agent finds a high-scoring listing it drafts an outreach message and waits for your go-ahead. You can:<br /><br />
        · <Term>Check the Approvals tab</Term> in the app — always available, updates in real time<br />
        · <Term>Get an email</Term> with one-click <strong style={{ color: '#4ade80' }}>Approve</strong> / <strong style={{ color: '#f87171' }}>Discard</strong> buttons right in your inbox<br />
        · <Term>Enable Away Mode</Term> — if you're busy, the agent auto-sends for listings it's very confident about (score 9/10+)
      </ExplainBox>

      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>How do you want to be notified?</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ChannelRow
            active disabled
            icon="🖥️" title="In-app dashboard"
            description="Always on — view and act on every listing in the Approvals tab"
          />
          <ChannelRow
            active={emailOn}
            onToggle={() => toggleChannel('email')}
            icon="📧" title="Email alerts with approve buttons"
            description="One email per high-scoring listing, with clickable Approve / Discard links"
            tooltip={{ text: 'LuxRoom AI sends from your own email account using SMTP — your credentials never leave your device.' }}
          />
          <ChannelRow
            active={notifyChannels.includes('desktop')}
            onToggle={() => toggleChannel('desktop')}
            icon="🔔" title="Desktop pop-up"
            description="A quick system notification when a match is found"
          />
        </div>
      </div>

      {emailOn && (
        <>
          <Field l="Your notification email" helper="Where to send listing alerts" fullWidth>
            <input style={inputStyle} type="email" autoFocus value={cfg.notificationEmail}
              onChange={e => onEmailChange(e.target.value)} placeholder="you@gmail.com" />
          </Field>

          {knownDomain && (
            <div style={{
              gridColumn: '1 / -1',
              background: '#0a1f0a', border: '1px solid #1a4a1a',
              borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#6ee7b7', lineHeight: 1.6,
            }}>
              <strong>✓ Provider detected</strong> — SMTP auto-configured ({preset.host}:{preset.port})<br />
              <span style={{ color: '#8080a8', fontSize: 12 }}>{preset.note}</span>
              {preset.appPasswordLink && (
                <> <button
                  onClick={() => window.luxroom?.shell?.openExternal(preset.appPasswordLink)}
                  style={{ background: 'none', border: 'none', color: '#818cf8', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
                >Get App Password →</button></>
              )}
            </div>
          )}

          {!knownDomain && hasAt && (
            <>
              <Field l="SMTP host">
                <input style={inputStyle} value={cfg.smtpHost}
                  onChange={e => set('smtpHost', e.target.value)} placeholder="smtp.yourdomain.com" />
              </Field>
              <Field l="SMTP port">
                <input style={inputStyle} type="number" value={cfg.smtpPort}
                  onChange={e => set('smtpPort', Number(e.target.value))} placeholder="587" />
              </Field>
            </>
          )}

          {hasAt && (
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={labelStyle}>
                Email password or App Password
                <Tooltip {...appPasswordTooltip} />
              </label>
              <input style={inputStyle} type="password" value={cfg.smtpPassword}
                onChange={e => set('smtpPassword', e.target.value)} placeholder="••••••••" />
              <p style={{ color: '#5a5a7a', fontSize: 12, marginTop: 6, margin: '6px 0 0' }}>Stored only on your device — only used to send you alerts.</p>
            </div>
          )}
        </>
      )}

      <div style={{ gridColumn: '1 / -1' }}>
        <label style={labelStyle}>Approval mode</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ApprovalModeCard
            active={approvalMode === 'manual'}
            onSelect={() => setApprovalMode('manual')}
            icon="✋" title="Manual review"
            description="You approve every message before it goes out. Recommended while you're actively searching."
          />
          <ApprovalModeCard
            active={approvalMode === 'auto'}
            onSelect={() => setApprovalMode('auto')}
            icon="⚡" title="Away mode — auto-approve"
            tag="can toggle anytime"
            description="Listings scoring 9–10/10 are sent automatically. You'll still be notified after. Toggle this from the Approvals dashboard any time."
          />
        </div>
      </div>

      <div style={{
        gridColumn: '1 / -1',
        background: '#0d0d1a', border: '1px solid #2a2a4a',
        borderRadius: '8px', padding: '12px 16px', color: '#5a5a7a', fontSize: '12px', lineHeight: 1.6,
      }}>
        All of this can be changed any time in Settings and from the Approvals tab in the dashboard.
      </div>
    </>
  )
}
