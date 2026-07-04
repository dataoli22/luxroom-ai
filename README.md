# LuxRoom AI

> Automated housing search for Luxembourg — finds listings, scores them, and drafts outreach messages to landlords in their own language. Runs entirely on your laptop. Free, open source, nothing leaves your device.

Built for international students arriving in Luxembourg who need to find a room fast and don't speak French or German well enough to write convincing emails.

---

## What it does

1. **Crawls** housing sites every 3 hours looking for new listings that match your criteria
2. **Scores** each listing 0–10 based on price, location, commute distance, availability date, and your preferences
3. **Drafts** an outreach message in the language the landlord used (French, German, Luxembourgish, or English) — automatically
4. **Notifies** you via email and a live in-app dashboard when a high-scoring listing appears
5. **Waits for your approval** before sending anything — or auto-sends if you enable Away Mode

You set it up once. It runs in the background. You only look at the listings worth your time.

---

## Download & Install

👉 **[Go to the latest release →](../../releases/latest)**

Pick your file:

| Your computer | File to download |
|---|---|
| Windows (any modern PC) | `LuxRoom AI Setup x.x.x.exe` |
| Mac (M1/M2/M3/M4 — Apple Silicon) | `LuxRoom AI-x.x.x-arm64.dmg` |

> **Intel Mac?** Not currently supported as a pre-built download. You can [build from source](#building-from-source) on any Mac.

---

### Windows

1. Download the `.exe` and double-click it
2. If Windows asks *"Do you want to allow this app to make changes?"* — click **Yes**
3. Follow the installer prompts (takes under a minute)
4. Open **LuxRoom AI** from the Start menu or desktop shortcut
5. Fill in the 3-field setup (name, email, app password) — done in under 2 minutes
6. The app automatically installs Ollama and downloads an AI model in the background — takes 2–5 minutes the first time, then instant on every launch after

> **"Windows protected your PC" — SmartScreen warning**
>
> You'll see a blue screen saying *"Microsoft Defender SmartScreen prevented an unrecognized app from starting."* This is normal for any open-source app that hasn't paid ~$300/year for a Microsoft code-signing certificate. It does **not** mean the app is malicious.
>
> Click **"More info"** → **"Run anyway"** to proceed. You only see this once.

---

### macOS

1. Download the `.dmg` from the [Releases](../../releases/latest) page
2. Open the `.dmg` — a window appears with the LuxRoom AI icon
3. Drag **LuxRoom AI** into the **Applications** folder shortcut in that window
4. Open **Launchpad** (or go to Applications) and click LuxRoom AI
5. Fill in the 3-field setup (name, email, app password) — done in under 2 minutes
6. The app automatically downloads and installs Ollama in the background — takes 2–5 minutes the first time, then instant on every launch after

> **"Cannot be opened because it is from an unidentified developer" — Gatekeeper warning**
>
> macOS blocks apps that aren't signed with an Apple Developer certificate ($99/year). As a free open-source app, LuxRoom AI is not enrolled in Apple's programme. It is **not** malicious — the full source code is in this repository.
>
> **To open it:** Right-click (or Control-click) the app icon in Applications → **Open** → **Open**. That's it — you only need to do this once, macOS remembers.
>
> If right-click → Open doesn't work: go to **System Settings → Privacy & Security**, scroll to the Security section, and click **Open Anyway**.

---

## Setup

The first time you open LuxRoom AI you'll see a quick setup screen — 3 fields, done in under 2 minutes.

**Field 1 — Your first name**
Used to sign outreach messages: *"Best regards, Priya"*

**Field 2 — Your email address**
Paste your Gmail, Outlook, Yahoo, or other address. The app auto-detects your provider and configures SMTP automatically — no settings to fill in.

**Field 3 — Email password / App Password**

Most email providers require an *App Password* — a separate password for third-party apps — rather than your regular account password. The app shows a direct link to the right settings page for your provider the moment it recognises your email domain.

| Provider | What to use | Link |
|---|---|---|
| Gmail | App Password | myaccount.google.com/apppasswords |
| Outlook / Hotmail | Regular password (or App Password if 2FA is on) | account.microsoft.com/security |
| Yahoo | App Password | login.yahoo.com/account/security |
| iCloud / me.com | App-Specific Password | appleid.apple.com |
| ProtonMail | Requires Proton Mail Bridge running locally | proton.me/mail/bridge |

After you click **Start Searching**, the app installs Ollama and downloads an AI model in the background — a one-time download of roughly 1–5 GB depending on your hardware. Subsequent launches are instant.

Want to tune your budget, areas, housing type, or other preferences? Click **"Customise everything →"** below the quick setup card to access the full 7-step wizard.

---

## Privacy & security

**Nothing leaves your device** — with the exception of two things you explicitly configure:

| What | Where it goes | Can you opt out? |
|---|---|---|
| Listing HTML (price, location, dates extracted by AI) | Your device only — processed by local Ollama | N/A |
| Draft outreach messages | Your device only — never sent without your approval | N/A |
| Email alerts | Your own SMTP server (Gmail, Outlook, etc.) | Yes — skip email in setup |
| Cloud AI key (optional) | Only the provider you chose (Groq, Together AI, etc.) | Yes — use local Ollama instead |

Your SMTP password and any API keys are stored in your OS user-data folder (`%APPDATA%\LuxRoom AI` on Windows). They are never transmitted to any server other than the one you explicitly chose.

The in-app email approval server binds only to `127.0.0.1` — it cannot be reached from any other device on your network.

The app has been audited against OWASP Electron security guidelines: `contextIsolation` is enabled, `nodeIntegration` is disabled, a strict Content Security Policy is enforced, and all IPC handlers validate their inputs.

---

## Luxembourg area guide

Most students search only in Luxembourg City and miss dramatically cheaper options nearby.

### Luxembourg City
Most convenient — walkable to everything, tram and bus well-served. The most expensive option: expect **€650–950/month** for a room. Best if your campus or office is in Kirchberg, Cloche d'Or, or the Centre.

### ⭐ North — CFL Line 10 (recommended for students)
The hidden gem. CFL Line 10 runs direct trains to Luxembourg Gare → Kirchberg in **~25–35 minutes**. Towns like **Mersch**, **Lintgen**, and **Walferdange** cost **€380–580/month** — roughly half the city price — and most students don't know this option exists. The app searches here by default.

### Suburbs & Communes
Quiet residential communes around the city. Typically **€500–750/month** with good bus connections. Bertrange and Strassen are popular with expat families and often have furnished rooms in shared houses.

### South — Minett / Belval
Home to the University of Luxembourg's main campus at Belval. **€380–600/month**. Esch-sur-Alzette has a growing student scene. Only makes sense if your destination is in the south — the commute to city-centre is 35–45 minutes.

The app's area picker groups these regions and shows price ranges and commute times for each when you hover the guide icon.

---

## Approval flow

Every draft message waits for your approval before anything is sent.

**Manual mode (default)**
A notification appears → open the Approvals tab → click Approve or Discard. If you configured email alerts, you also get a one-click Approve / Discard link directly in your inbox — no need to open the app.

**Away mode**
Enable this from the Approvals dashboard when you're busy or travelling. Listings scoring 9 or 10 out of 10 are sent automatically; you receive a notification after the fact. Toggle it off any time — designed for weekends or exam periods.

---

## AI models

The app uses a small language model running locally via [Ollama](https://ollama.com). After the initial download, no internet connection is needed for the AI to function.

### Recommended by hardware

| RAM | Model | Download size | Notes |
|---|---|---|---|
| < 8 GB | Use cloud API | — | Free Groq account recommended |
| 8 GB | `llama3.2:1b` | 1.3 GB | Fast, works on most student laptops |
| 12 GB | `llama3.2:3b` | 2.0 GB | Best quality/speed balance — **default** |
| 16 GB+ | `llama3.1:8b` | 4.7 GB | Highest quality, slower on CPU |

The onboarding wizard detects your hardware and pre-selects the right model. You can add, switch, or remove models at any time via the **🤖 Models** button in the top bar.

### Cloud API (optional)

If your laptop has less than 8 GB RAM, the app can use a free cloud API for the listing analysis step. Only the raw listing HTML is sent — your name, preferences, and draft messages never leave your device.

Recommended: **[Groq](https://console.groq.com/keys)** — free tier, 14,400 requests/day, no credit card required.

---

## Building from source

Requires **Node.js 20+** and **Git**.

```bash
git clone https://github.com/dataoli22/luxroom-ai
cd luxroom-ai
npm install
npm run dev          # opens the app in development mode with hot reload
```

**Release builds are automatic.** Push a version tag and GitHub Actions builds all three installers and attaches them to the release:

```bash
git tag v1.0.2
git push origin v1.0.2
# GitHub Actions produces:
#   LuxRoom AI Setup 1.0.2.exe      (Windows, built on windows-latest)
#   LuxRoom AI-1.0.2-x64.dmg       (macOS Intel, built on macos-13)
#   LuxRoom AI-1.0.2-arm64.dmg     (macOS Apple Silicon, built on macos-14)
```

**To build locally:**
```bash
npm run build        # Windows .exe  (run on Windows)
npm run build:mac    # macOS .dmg    (must run on a Mac)
npm run build:linux  # Linux .AppImage
```

### Project structure

```
electron/
  main.js          App lifecycle, IPC handlers, local approval HTTP server
  preload.js       Secure contextBridge — the only surface the renderer touches
src/
  ui/              React frontend (built with Vite)
    OnboardingView.jsx   Setup wizard (fast path + full 7-step)
    ApprovalsView.jsx    Live approvals dashboard with away-mode toggle
    ModelManagerView.jsx Pull / switch / remove Ollama models
    SettingsView.jsx     Post-setup configuration
  modules/
    discovery/     Playwright web crawler — finds new listings
    analysis/      Opportunity scorer — rates 0–10 against your profile
    messaging/     Draft generator — writes in the listing's language
    notifications/ Email (Nodemailer) and desktop (node-notifier) alerts
    hermes/        Sends approved messages to landlords
  db/              SQLite via sql.js — stores listings, drafts, send log
  pipeline.js      Orchestrator — runs the full cycle every 3 hours
  hardware.js      Detects RAM/CPU/GPU and recommends a model
  settings.js      Reads/writes settings to OS user-data folder
launch-electron.cjs  Strips ELECTRON_RUN_AS_NODE before spawning Electron
```

---

## FAQ

**Will this get me banned from housing sites?**
The crawler uses Playwright (a real browser) with human-like delays between requests. It is not a mass scraper — it runs once every 3 hours and only fetches detail pages for listings that match your filters. Use it responsibly and don't reduce the crawl interval below 1 hour.

**Does it actually send messages on its own?**
Only if you enable Away Mode, and only for listings scoring 9 or 10 out of 10. In the default Manual mode, nothing is ever sent without you clicking Approve.

**The message was written in the wrong language.**
Open the listing in the Approvals tab → click "Generate new draft". Language is re-detected from the listing text. You can also edit the draft directly before approving.

**Ollama won't start / "model not found".**
Open **🤖 Models** in the top bar — it shows all installed models and lets you re-download. Make sure Ollama is running: open a terminal and run `ollama serve`.

**Can I use this outside Luxembourg?**
The area picker and commute guide are Luxembourg-specific, but the core pipeline works for any city. Change your city in Settings → Profile and update your preferred areas.

**The Windows installer shows a SmartScreen warning.**
See the [note in the installation section](#windows) above — this is expected for unsigned open-source installers. Click "More info" → "Run anyway".

**macOS says the app is from an unidentified developer.**
See the [note in the installation section](#macos) above. Right-click the app → **Open** → **Open**. You only need to do this once.

---

## Contributing

Pull requests are welcome. A few ground rules:

- **Preserve the privacy guarantee.** Any new network call must go only to a URL the user explicitly configured. No telemetry, no analytics, no phoning home.
- **Test both inference modes** — local Ollama and cloud API — before submitting.
- **Keep onboarding fast.** The quick-setup path (3 fields) is the primary experience for students. Don't add required fields to it.

To report a bug or suggest a feature, open an issue on GitHub.

---

## License

MIT — free to use, modify, and distribute. See [LICENSE](LICENSE).

---

*Built with [Electron](https://electronjs.org) · [React](https://react.dev) · [Vite](https://vitejs.dev) · [Ollama](https://ollama.com) · [Playwright](https://playwright.dev) · [Nodemailer](https://nodemailer.com) · [sql.js](https://sql.js.org)*
