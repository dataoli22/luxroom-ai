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
  h2: { fontSize: 12, fontWeight: 700, color: c.accent, marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.06em' },
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
    title: 'Quick setup',
    desc: 'Enter your name and email (the app auto-detects your provider and fills in the rest), pick your University of Luxembourg campus — Kirchberg or Belval — so the right areas are searched, and optionally connect Appartager.',
  },
  {
    title: 'Set up your AI (one time)',
    desc: 'A required setup screen appears. Pick a free cloud key (Groq or Ollama Cloud — recommended, fastest, nothing to download) or choose "On my device" to have the app install Ollama + a local model for you. No terminal, ever. You can switch anytime later.',
  },
  {
    title: 'Run your first scan',
    desc: 'After setup you\'re invited to run the first scan. It takes 10–20 minutes the first time (it checks many sites and reads each listing). A live progress bar shows how it\'s going.',
  },
  {
    title: 'It runs by itself after that',
    desc: 'LuxRoom scans automatically every few hours in the background — even when the window is closed, as long as your laptop is on. Use the "Every 6h ▾" menu next to Run Now to change the frequency.',
  },
  {
    title: 'Browse your Listings',
    desc: 'Every scraped room appears in the Listings tab, scored 0–10 (best first). Click a card to open it in your browser, filter by verdict or area, and use "⬇ Export to Excel" to download them all as a spreadsheet.',
  },
  {
    title: 'Approve or discard drafts',
    desc: 'For strong matches, a draft outreach message is prepared in the landlord\'s language. Go to Approvals, read it, and click Approve to send — or Discard. You also get an email alert with one-click Approve / Discard buttons.',
  },
]

const FAQS = [
  {
    q: 'How often does the app scan for new listings?',
    a: 'Every 6 hours by default. Change it with the "Every 6h ▾" menu next to Run Now, or trigger an immediate scan any time with Run Now (or Ctrl/Cmd+R).',
  },
  {
    q: 'A repeat scan didn\'t add any new listings — is that a bug?',
    a: 'Each scan prioritises rooms it hasn\'t captured yet, so repeat scans surface genuinely new listings and skip re-checking the same ones. If a scan adds nothing, there simply were no new rooms matching your filters at that moment — it keeps checking automatically.',
  },
  {
    q: 'Will it send messages automatically without my approval?',
    a: 'No — in the default Manual mode nothing is sent without you clicking Approve. Away Mode (in the Approvals tab) auto-sends only for listings scoring 9 or 10, and only when you explicitly turn it on.',
  },
  {
    q: 'The AI setup won\'t finish / a model won\'t download.',
    a: 'Open the AI panel (the "AI" pill in the top bar, or "Configure AI" on the Listings tab) and paste a free Groq or Ollama Cloud key — it needs no download and works instantly. The local option installs Ollama for you automatically; no terminal is ever required.',
  },
  {
    q: 'The draft message was written in the wrong language.',
    a: 'Go to the Approvals tab, open the listing, and click "Generate new draft" — the language is re-detected from the listing each time. You can also edit the draft directly before approving.',
  },
  {
    q: 'I\'m not receiving email notifications.',
    a: 'Open Settings and check your email details. Gmail and Yahoo require an App Password — not your regular password. There\'s a "Send test email" button in setup and Settings to confirm it works.',
  },
  {
    q: 'The app shows no listings after a scan.',
    a: 'The first scan takes 10–20 minutes — watch the progress bar. If it finishes empty, there may be no new matches right now; it keeps checking automatically. Widening your budget or areas in Settings → Edit search profile helps. Make sure your AI is set up (the "AI" pill shows which one is active).',
  },
  {
    q: 'Can I use this outside Luxembourg?',
    a: 'The area picker and commute guide are Luxembourg-specific, but the core pipeline works for any city. Change your city and preferred areas in Settings → Edit search profile.',
  },
  {
    q: 'My laptop has less than 8 GB RAM — can I still use it?',
    a: 'Yes — use a free cloud key instead of a local model. Groq and Ollama Cloud both have generous free tiers with no credit card. Add one in the AI panel; local models are only a fallback.',
  },
  {
    q: 'Is my data safe? Does anything leave my device?',
    a: 'Only two things: email alerts go through your own email account (Gmail, etc.), and — if you chose a cloud AI — the listing text is sent to that provider to be analysed. Your name, passwords, preferences, and drafts never leave your device. No tracking, no analytics.',
  },
  {
    q: 'How do updates work? Will I lose my listings?',
    a: 'The app checks for new versions on its own and installs them for you — no need to visit GitHub. All your data (listings, drafts, settings) lives in your private app folder and stays intact across updates.',
  },
  {
    q: 'Downloading a model vs. choosing which AI runs — what\'s the difference?',
    a: 'The 🤖 Models button just downloads local models to your device. The AI panel (the "AI" pill / "Configure AI") chooses which AI actually analyses your listings — cloud or local. Downloading a model doesn\'t switch to it; selecting it in the AI panel does.',
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
