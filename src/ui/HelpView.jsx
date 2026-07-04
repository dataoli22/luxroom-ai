import React, { useState } from 'react'

const c = {
  bg: '#0f0f13',
  panel: '#1a1a24',
  border: '#2a2a3a',
  accent: '#7c5cbf',
  text: '#e8e8f0',
  sub: '#888',
  green: '#4ade80',
  yellow: '#fbbf24',
}

const s = {
  page: { padding: '28px 32px', overflowY: 'auto', height: '100%', boxSizing: 'border-box' },
  h1: { fontSize: 22, fontWeight: 700, marginBottom: 4, color: c.text },
  sub: { fontSize: 13, color: c.sub, marginBottom: 32 },
  section: { marginBottom: 36 },
  h2: { fontSize: 15, fontWeight: 700, color: c.accent, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: 12 },
  step: { display: 'flex', gap: 14, marginBottom: 16, alignItems: 'flex-start' },
  stepNum: {
    width: 26, height: 26, borderRadius: '50%', background: c.accent,
    color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1,
  },
  stepBody: { flex: 1 },
  stepTitle: { fontSize: 14, fontWeight: 600, color: c.text, marginBottom: 3 },
  stepDesc: { fontSize: 13, color: c.sub, lineHeight: 1.6 },
  faqItem: { marginBottom: 0 },
  faqQ: {
    width: '100%', textAlign: 'left', background: 'none', border: 'none',
    borderTop: `1px solid ${c.border}`, padding: '14px 0', cursor: 'pointer',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    fontSize: 14, fontWeight: 500, color: c.text,
  },
  faqA: { fontSize: 13, color: c.sub, lineHeight: 1.7, paddingBottom: 14 },
  pill: {
    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
    background: '#2a2a3a', fontSize: 12, fontFamily: 'monospace', color: c.text,
  },
  tip: {
    background: '#1e1e2e', border: `1px solid ${c.border}`, borderLeft: `3px solid ${c.accent}`,
    borderRadius: 6, padding: '10px 14px', fontSize: 13, color: c.sub, lineHeight: 1.6, marginTop: 8,
  },
}

const STEPS = [
  {
    title: 'Complete setup',
    desc: 'Enter your name, email, and app password. The app detects your email provider and fills in the rest automatically.',
  },
  {
    title: 'Wait for Ollama to install',
    desc: 'After setup, the app downloads and installs the AI engine (Ollama) and a language model. This is a one-time download of 1–4 GB and takes 2–10 minutes depending on your internet speed. Subsequent launches are instant.',
  },
  {
    title: 'The scan starts automatically',
    desc: 'Once ready, LuxRoom AI scans housing sites every 3 hours. You don\'t need to do anything — it runs quietly in the background.',
  },
  {
    title: 'Check your Listings tab',
    desc: 'New listings appear in the Listings tab, scored 0–10. The higher the score, the better the match for your budget, location, and move-in date.',
  },
  {
    title: 'Approve or discard messages',
    desc: 'When a high-scoring listing is found, a draft outreach message is prepared in the landlord\'s language. Go to Approvals, read the draft, and click Approve to send it — or Discard if it\'s not right.',
  },
  {
    title: 'Check your email',
    desc: 'You also receive an email alert with one-click Approve / Discard buttons. You can respond directly from your inbox without opening the app.',
  },
]

const FAQS = [
  {
    q: 'How often does the app scan for new listings?',
    a: 'Every 3 hours by default. You can trigger an immediate scan at any time using the "Run Now" button in the top bar.',
  },
  {
    q: 'Will it send messages automatically without my approval?',
    a: 'No — in the default Manual mode, nothing is ever sent without you clicking Approve. Away Mode (available in the Approvals tab) auto-sends only for listings scoring 9 or 10 out of 10, and only when you explicitly enable it.',
  },
  {
    q: 'Ollama won\'t install / "model not found" error.',
    a: 'Open the 🤖 Models button in the top bar. Check that Ollama is running — if not, open a Terminal and run: ollama serve. Then use the Models screen to pull a model.',
  },
  {
    q: 'The draft message was written in the wrong language.',
    a: 'Go to the Approvals tab, open the listing, and click "Generate new draft". The language is re-detected from the listing text each time. You can also edit the draft directly before approving.',
  },
  {
    q: 'I\'m not receiving email notifications.',
    a: 'Go to Settings and check that your SMTP details are correct. Gmail and Yahoo require an App Password — not your regular account password. Check that "Email notifications" is enabled in your notification settings.',
  },
  {
    q: 'The app shows no listings after running.',
    a: 'Check the Log tab for errors. Common causes: Ollama is not running (run ollama serve in a terminal), or the crawled sites returned no results matching your filters. Try widening your budget or area in Settings.',
  },
  {
    q: 'Can I use this outside Luxembourg?',
    a: 'The area picker and commute guide are Luxembourg-specific, but the core pipeline works for any city. Change your city in Settings → Profile and update your preferred areas.',
  },
  {
    q: 'My laptop has less than 8 GB RAM — can I still use it?',
    a: 'Yes — use a free cloud API instead of local Ollama. Groq offers a free tier with 14,400 requests/day and no credit card required. Set it up in Settings → AI Model → Cloud API.',
  },
  {
    q: 'Is my data safe? Does anything leave my device?',
    a: 'Only two things leave your device: email alerts go to your own SMTP server (Gmail, Outlook, etc.), and if you configure a cloud API key, listing HTML is sent to that provider only. Your name, passwords, draft messages, and preferences never leave your device.',
  },
  {
    q: 'How do I add or switch AI models?',
    a: 'Click the 🤖 Models button in the top bar. You can pull new models, set the active model, and remove ones you no longer need.',
  },
]

function Faq({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={s.faqItem}>
      <button style={s.faqQ} onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span style={{ color: c.accent, fontSize: 18, lineHeight: 1 }}>{open ? '−' : '+'}</span>
      </button>
      {open && <div style={s.faqA}>{a}</div>}
    </div>
  )
}

export default function HelpView() {
  return (
    <div style={s.page}>
      <div style={s.h1}>Help & Guide</div>
      <div style={s.sub}>Everything you need to get set up and find a room in Luxembourg.</div>

      {/* Getting started */}
      <div style={s.section}>
        <div style={s.h2}>Getting started — step by step</div>
        {STEPS.map((step, i) => (
          <div key={i} style={s.step}>
            <div style={s.stepNum}>{i + 1}</div>
            <div style={s.stepBody}>
              <div style={s.stepTitle}>{step.title}</div>
              <div style={s.stepDesc}>{step.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Luxembourg area guide */}
      <div style={s.section}>
        <div style={s.h2}>Luxembourg area guide</div>
        {[
          { name: '⭐ North — CFL Line 10 (recommended)', price: '€380–580/month', desc: 'The best value for students. Direct trains from Mersch, Lintgen, and Walferdange reach Luxembourg Gare and Kirchberg in 25–35 minutes. Roughly half the price of the city.' },
          { name: 'Luxembourg City', price: '€650–950/month', desc: 'Most convenient — walkable to everything, tram and bus well-served. The most expensive option. Best if your campus or workplace is in Kirchberg, Cloche d\'Or, or the Centre.' },
          { name: 'Suburbs & Communes', price: '€500–750/month', desc: 'Quiet residential communes around the city. Good bus connections. Bertrange and Strassen are popular with furnished rooms in shared houses.' },
          { name: 'South — Minett / Belval', price: '€380–600/month', desc: 'Home to the University of Luxembourg\'s main campus. Only makes sense if your destination is in the south — the commute to city-centre is 35–45 minutes.' },
        ].map(area => (
          <div key={area.name} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: c.text }}>{area.name}</span>
              <span style={{ fontSize: 13, color: c.green, fontWeight: 600 }}>{area.price}</span>
            </div>
            <div style={{ fontSize: 13, color: c.sub, lineHeight: 1.6 }}>{area.desc}</div>
          </div>
        ))}
      </div>

      {/* App password guide */}
      <div style={s.section}>
        <div style={s.h2}>Email app passwords</div>
        <div style={{ fontSize: 13, color: c.sub, marginBottom: 12, lineHeight: 1.6 }}>
          Most email providers require an App Password — a separate password for third-party apps — instead of your regular account password.
        </div>
        {[
          { provider: 'Gmail', url: 'myaccount.google.com/apppasswords', note: 'Requires 2-Step Verification to be on' },
          { provider: 'Outlook / Hotmail', url: 'account.microsoft.com/security', note: 'Use regular password, or App Password if 2FA is on' },
          { provider: 'Yahoo', url: 'login.yahoo.com/account/security', note: 'Generate under "App Passwords"' },
          { provider: 'iCloud / me.com', url: 'appleid.apple.com', note: 'Called "App-Specific Password"' },
        ].map(p => (
          <div key={p.provider} style={{ display: 'flex', gap: 12, marginBottom: 10, alignItems: 'flex-start' }}>
            <span style={{ ...s.pill, minWidth: 120, textAlign: 'center', fontFamily: 'inherit' }}>{p.provider}</span>
            <div>
              <div style={{ fontSize: 13, color: c.text }}>{p.url}</div>
              <div style={{ fontSize: 12, color: c.sub }}>{p.note}</div>
            </div>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div style={s.section}>
        <div style={s.h2}>Frequently asked questions</div>
        <div style={{ borderBottom: `1px solid ${c.border}` }}>
          {FAQS.map(f => <Faq key={f.q} q={f.q} a={f.a} />)}
        </div>
      </div>

      {/* Footer */}
      <div style={{ fontSize: 12, color: c.sub, paddingBottom: 12 }}>
        Something not working? Open the Log tab for detailed error messages, or visit{' '}
        <span
          style={{ color: c.accent, cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => window.luxroom?.shell.openExternal('https://github.com/dataoli22/luxroom-ai/issues')}
        >
          github.com/dataoli22/luxroom-ai/issues
        </span>
        {' '}to report a bug.
      </div>
    </div>
  )
}
