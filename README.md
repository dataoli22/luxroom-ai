<div align="center">

[![Downloads](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2Fdataoli22%2Fluxroom-ai%2Fmaster%2F.github%2Fbadges%2Fdownloads.json&style=for-the-badge)](../../releases)
&nbsp;
[![License: MIT](https://img.shields.io/badge/License-MIT-4ade80?style=for-the-badge)](LICENSE)

</div>

# LuxRoom AI

> Your automated housing assistant for Luxembourg. It watches the housing sites for you, scores each room against what you want, and even drafts a message to the landlord in their own language. Runs on your laptop, free.

Made for international students arriving in Luxembourg who need a room fast — and don't want to refresh a dozen websites every day or write emails in French and German.

> 📖 **Guides:** [Complete Student Housing Guide](STUDENT_HOUSING_GUIDE.md) ([🇫🇷 FR](STUDENT_HOUSING_GUIDE.fr.md) · [🇩🇪 DE](STUDENT_HOUSING_GUIDE.de.md)) · [🧠 AI Models — Playground & Cookbook](AI_MODELS_GUIDE.md)

---

## What it does

1. **Watches** housing sites around the clock and finds new rooms that fit your budget, area, and commute.
2. **Scores** each one out of 10 so you only look at the good ones.
3. **Drafts** a polite message to the landlord — in the language *they* used (French, German, Luxembourgish, or English).
4. **Alerts** you (desktop + email) the moment a great match appears.
5. **Waits for your OK** before anything is sent. You're always in control.

Set it up once. It runs quietly in the background — even when the window is closed — as long as your laptop is on.

---

## Download & Install

👉 **[Go to the latest release →](../../releases/latest)**

| Your computer | How to get it |
|---|---|
| 🪟 **Windows** | Download **`LuxRoom-AI-Windows.exe`** and run it |
| 🍎 **Mac** | Build it once on your Mac — see [macOS](#macos) below |

### Windows

1. Download **`LuxRoom-AI-Windows.exe`** and double-click it.
2. If you see a blue **"Windows protected your PC"** screen, click **More info → Run anyway**. (This is normal for free apps that haven't paid for a Microsoft certificate — it's not a virus.)
3. Follow the installer, then open **LuxRoom AI** from the Start menu.
4. Do the quick setup (below). That's it.

### macOS

Macs need the app to be built once on your own machine (a pre-built Mac app requires a paid Apple certificate). It takes about two minutes. You need [Node.js](https://nodejs.org) installed first (a one-time, one-click install).

1. On the [repository page](../../), click **Code → Download ZIP**, and unzip it.
2. Open the **Terminal** app, drag the unzipped folder onto it (to move into it), press Enter, then run:
   ```
   npm install
   npm run build:mac
   ```
3. Open the new **`release`** folder → drag **LuxRoom AI.app** into your **Applications**.
4. **Right-click** the app → **Open** → **Open** (needed the first time only).

> If macOS says the app is *"damaged"*, open Terminal and run `xattr -cr "/Applications/LuxRoom AI.app"`, then open it again.

---

## First-time setup

The first time you open LuxRoom AI, a short setup takes you through three things.

### 1. About you (under 2 minutes)

| Field | What to enter |
|---|---|
| **Your first name** | Used to sign the messages, e.g. *"Best regards, Priya"* |
| **Your email address** | Your Gmail/Outlook/etc. — the app auto-configures the rest |
| **Email password** | An **App Password** (see below), so the app can send you alerts |

> **What's an "App Password"?** Most email providers won't let apps use your normal password. Instead you create a separate one just for this app. LuxRoom AI shows a direct link to the right page the moment it recognises your email. It's free and takes a minute.
>
> | Provider | Where to make one |
> |---|---|
> | Gmail | myaccount.google.com/apppasswords |
> | Outlook / Hotmail | your normal password (or an App Password if 2-factor is on) |
> | Yahoo | login.yahoo.com/account/security |
> | iCloud | appleid.apple.com |

There's a **Send test email** button — use it to confirm your email works before continuing.

### 2. Set up the AI (required)

LuxRoom needs an AI to read and rank listings. You'll see a setup screen with two choices — **pick either one, both are free:**

- **☁️ Cloud (recommended, fastest).** Paste a free key from **Groq** or **Ollama Cloud** — a one-minute sign-up, no credit card. The AI runs on their servers, so it's fast and doesn't slow your laptop. *(This is the easiest option, especially on older laptops.)*
- **💻 On your device.** Click a model to download — the app installs and runs everything itself, **no terminal or commands needed**. Private and works offline, but slower.

You can't miss this step — the app won't start scanning until the AI is ready. You can switch options any time later.

> Not sure which to pick? The **[AI Models — Playground & Cookbook](AI_MODELS_GUIDE.md)** has a recipe for every laptop and budget.

### 3. Connect Appartager (optional, recommended)

Appartager is one of the best room sources but only shows listings to members. Click **Connect**, log in once in the window that opens, and LuxRoom AI will search it for you from then on.

> Want to fine-tune your budget, areas, or housing type? Click **"Customise everything →"** on the setup screen for the full wizard.

---

## Using the app

**Your first scan.** After setup, a prompt invites you to run your first scan. Click it — the first one takes **10–20 minutes** (it checks many sites and reads each listing). You'll see a live progress bar with a timer.

**It runs by itself after that.** LuxRoom scans automatically every few hours in the background — even when the window is closed — as long as your laptop is on. You'll get a desktop notification the moment a good match appears. Close the window any time; it keeps running in your system tray. To quit fully, right-click the tray icon → Quit.

**Run it whenever you like.** Click **Run Now** (top right) for an instant scan, or use the little **"Every 6h ▾"** menu next to it to change how often it runs automatically.

**The tabs:**
- **🏠 Listings** — every match, newest and best-scored first. Click a card to open it in your browser. The bar at the top shows which AI is analysing and lets you change it.
- **✉️ Approvals** — draft messages waiting for your OK. Edit the text if you like, then **Approve & Send** (or Discard). You can also approve straight from the email alert.
- **📋 Log** — a live view of what the app is doing and a countdown to the next scan.
- **⚙️ Settings** — change your profile, email, AI provider, scan frequency, and more.
- **❓ Help** — step-by-step tips and FAQs inside the app.

**Away mode.** Going offline for a while? In the Approvals tab, turn on **Away Mode** and top listings (9–10/10) are sent automatically, so you don't miss a great room while you're busy. Turn it off any time.

**Changing the AI later.** Click the **AI** button in the top bar (or **Configure AI** on the Listings tab) to switch between cloud and local, or download more models. Note: the **🤖 Models** button *downloads* local models to your laptop, while the **AI** panel *chooses which one actually runs*.

---

## Your privacy

LuxRoom AI runs on your machine. Nothing about you is uploaded anywhere, except the two things you set up yourself:

- **Email alerts** go out through your own email account (Gmail, etc.) — never through us.
- **A cloud AI key** (only if you chose one) sends the listing text to that provider to be analysed. Your name, preferences, and draft messages never leave your device.

Your passwords and keys are stored only in your computer's private app folder. There's no tracking, no analytics, nothing phoning home.

---

## Common questions

**Do I have to keep the app open?**
No. It keeps scanning in the background as long as your laptop is on — even with the window closed. It lives in your system tray.

**Will it message landlords without asking me?**
No — not unless you deliberately turn on **Away Mode** (and even then only for near-perfect matches). By default, every message waits for you to click Approve.

**The message came out in the wrong language.**
Open the listing in Approvals → **Generate new draft**, or just edit the text yourself before sending.

**The AI setup won't finish / a model won't download.**
Add a free **Groq** key in the AI setup instead — it needs no download and works instantly. (The local option needs Ollama, which the app installs for you; if that struggles on your machine, the cloud key is the easy fix.)

**Nothing shows up in Listings.**
The first scan takes 10–20 minutes — watch the progress bar. If it finishes with nothing, there may simply be no new matches right now; it'll keep checking automatically. Widening your areas or budget in Settings helps.

**Can I use it outside Luxembourg?**
The area guide is Luxembourg-specific, but you can change your city and preferred areas in Settings and it'll still work.

**Something else?** Open the **❓ Help** tab in the app, or [report an issue on GitHub](../../issues).

---

## 📚 More guides

- **[Complete Student Housing Guide](STUDENT_HOUSING_GUIDE.md)** — the places LuxRoom can't reach for you: Facebook & WhatsApp groups, university housing, scam-avoidance, deposits & domiciliation, budgets, and a week-by-week plan.
  Also in **[Français 🇫🇷](STUDENT_HOUSING_GUIDE.fr.md)** and **[Deutsch 🇩🇪](STUDENT_HOUSING_GUIDE.de.md)**.
- **[AI Models — Playground & Cookbook](AI_MODELS_GUIDE.md)** — how to configure the AI: plain-language options, recipes for every laptop and budget, a "playground" for comparing models, and full model/provider reference tables.

---

## 🤝 Contributing

LuxRoom AI is **open source and free forever**, built to help students. **Contributions of any size are genuinely appreciated** — and you don't have to be a programmer:

- 🐛 **Found a bug or a source that stopped working?** [Open an issue](../../issues) — even a one-line "this site no longer loads" helps.
- 🌐 **Know a housing site or a Facebook/WhatsApp group we should add?** Tell us in an issue, or add it to the [Housing Guide](STUDENT_HOUSING_GUIDE.md) via a pull request.
- 🔧 **Can code?** Fixing a scraper selector, adding a source, or improving the UI is a great first PR (sources live in [`src/modules/discovery/crawler.js`](src/modules/discovery/crawler.js)).
- 🗣️ **Translate** the guide into another language, or improve the existing FR/DE versions.
- ⭐ **Star the repo** so the next arriving student can find it.

Every contribution makes someone's housing search a little less stressful. 💛

---

## License

Free and open source under the [MIT License](LICENSE) — use it, share it, no strings attached.

*Not affiliated with any housing website. Please use it responsibly and be a good tenant.* 🏡
