# 🧠 AI Models — Playground & Cookbook

Everything about the "brain" behind LuxRoom AI: what the choices mean, how to pick one, how to experiment, and copy-paste recipes for every kind of laptop and budget. **No technical knowledge needed.**

> **In one line:** LuxRoom uses an AI to *read each listing and rank it* (and to *draft messages*). You choose which AI does that work — a free one on your laptop, or a free/paid one in the cloud. This guide helps you choose well.

---

## First, the one thing everyone confuses 🔑

There are two different screens, and they do different jobs:

| Screen | What it does |
|---|---|
| **🤖 Models** (top bar) & Settings → *Local Extraction* | **Downloads** AI models onto your laptop. Like installing an app. |
| **AI** panel (the **AI** button / the bar on the **Listings** tab) | **Chooses which AI actually runs.** This is the one that matters. |

**Downloading a model does not switch to it.** Selecting it in the **AI** panel does. Keep this in mind and everything else is easy.

---

## The choices, in plain words

Open the **AI** panel (top-bar **AI** button, or **Configure AI** on the Listings tab). You'll see these options:

| Option | Cost | Speed | Needs | Best for |
|---|---|---|---|---|
| **Auto** ✅ *(default)* | Free | — | Nothing | **Everyone.** Uses the best option you've set up (a cloud key if you added one, otherwise your laptop). Just works. |
| **Groq** | **Free** (daily limit) | ⚡⚡⚡ Fast | 1-min sign-up | Fast results with zero laptop strain. The easiest cloud pick. |
| **Ollama Cloud** | **Free tier** (daily limit) | ⚡⚡⚡ Fast | Ollama API key | Cloud speed using Ollama's hosted models. |
| **On your device (Ollama)** | **Free** | 🐢 Slower | A model download | Total privacy, works offline. Good on newer laptops. |
| **Hermes** (on device) | **Free** | 🐢 Slower | A model download | Local, best at clean output — needs 16 GB RAM. |
| **Gemini** | Free tier | ⚡⚡ Fast | Google key | Another solid free-cloud option. |
| **OpenAI / Anthropic** | 💳 Paid | ⚡⚡ Fast | Paid key | Top quality if you already pay for GPT/Claude. |

> **How "Auto" decides (highest to lowest):** Ollama Cloud key → Groq key → Gemini key → OpenAI key → Anthropic key → your local model. In short: **any cloud key you add is used automatically; your laptop is the last resort.**

---

## 🍳 Cookbook — pick the recipe that sounds like you

### "My laptop is old / has 8 GB RAM or less"
→ **Use a free cloud key.** Local AI will be painfully slow.
1. AI panel → **Cloud** tab → **Groq** → **Get a free Groq key →** → sign up → paste the key → **Save**.
2. Done. You're on **Auto**, and it now uses Groq.

### "I want it 100% free, private, and offline"
→ **Local Ollama.** Nothing leaves your laptop.
1. AI panel → **On my device** tab → download **`qwen2.5:3b`** (light) or **`hermes3`** (best, needs 16 GB RAM).
2. The app installs and runs everything — no terminal.
3. Expect each scan to take longer than cloud.

### "Fast *and* free — best of both"
→ **Groq** (free, quick sign-up, generous daily limit). Same steps as the first recipe.

### "I already pay for ChatGPT or Claude"
→ Reuse that key for top quality.
1. AI panel isn't needed — go to **Settings → AI & Analysis** → pick **OpenAI** or **Anthropic** → paste your key → **Save Settings**.

### "Listings are in French/German and I want accurate reading"
→ Any capable model handles these, but good picks:
- Cloud: **Groq** (llama-3.3-70b) or **Gemini** — both strong multilingually.
- Local: **`qwen2.5:3b`** (notably good at FR/DE) or **`hermes3`**.

### "I have an Ollama account and want cloud speed"
→ **Ollama Cloud.**
1. AI panel → **Cloud** tab → **Ollama Cloud** → **Get your Ollama key →** (ollama.com → Settings → Keys) → paste it.
2. Pick a **cloud model** from the dropdown — start with **`gpt-oss:20b`** (light, easy on the free quota). → **Save**.

### "I keep hitting the free cloud daily limit"
→ Two options: switch to a **lighter model** (e.g. `gpt-oss:20b` instead of `120b`), or keep a **local model** installed as a free, unlimited backup and switch to it when needed.

---

## 🎛️ Playground — experiment and compare

You can freely try different brains and see which you like:

1. **Set up two or three options** (e.g. add a Groq key *and* download a local model). Both stay configured.
2. **Switch between them** any time in the AI panel — or in **Settings → AI & Analysis** for the paid ones.
3. **Test on real listings:** after switching, click **Run Now** and watch the **Listings** tab. Compare how each brain scores and describes rooms.
4. **Try different local models:** in **🤖 Models**, download a few (they're free) and switch the active one — smaller = faster, larger = smarter.
5. **Check what's live:** the **AI** pill in the top bar always shows which brain is currently analysing (green = free).

> There's no wrong choice you can't undo. Everything is a click away, and switching never loses your listings.

---

## 📚 Model reference

### Local models (download in 🤖 Models)

| Model | Size | RAM | Notes |
|---|---|---|---|
| `llama3.2:1b` | 1.3 GB | 8 GB | Fastest; fine for most laptops |
| `qwen2.5:3b` | 1.9 GB | 8–12 GB | Great multilingual (FR/DE) |
| `gemma2:2b` | 1.6 GB | 8 GB | Light and accurate |
| `phi3:mini` | 2.2 GB | 8 GB | Fast on CPU |
| `llama3.2:3b` | 2.0 GB | 12 GB | Balanced default |
| `hermes3` | 4.7 GB | 16 GB | Best analysis quality |
| `mistral:7b` | 4.1 GB | 16 GB | Strong at structured output |

Any model name from [ollama.com/library](https://ollama.com/library) also works — type it into the "Pull" box.

### Ollama Cloud models (in the AI panel)

Lighter models are gentler on the free daily quota. Browse the current list at [ollama.com/search?c=cloud](https://ollama.com/search?c=cloud).

| Model | Good for |
|---|---|
| `gpt-oss:20b` ⭐ | Recommended default — light, clean output |
| `qwen3.5` | Strong multilingual |
| `gemma4` | Light and accurate |
| `deepseek-v4-flash` | Fast reasoning |
| `glm-4.7` | Solid all-rounder |
| `gpt-oss:120b` | Highest quality (uses quota faster) |

> If cloud analysis comes back empty, the model tag may differ on your account — open the dropdown, choose **Custom…**, and enter the exact name shown on your Ollama Cloud page.

### Cloud providers & their keys

| Provider | Get a key | Free? |
|---|---|---|
| **Groq** | [console.groq.com/keys](https://console.groq.com/keys) | ✅ Free tier, no card |
| **Ollama Cloud** | [ollama.com/settings/keys](https://ollama.com/settings/keys) | ✅ Free tier |
| **Gemini** | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) | ✅ Free tier |
| **OpenAI** | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) | 💳 Paid |
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) | 💳 Paid |

---

## 🩺 Troubleshooting

**"AI setup won't finish" / a model won't download.**
Add a free **Groq** key instead — it needs no download and works instantly.

**Local AI is very slow.**
That's expected on CPU. Switch to a **cloud** key (Groq is free), or use a **smaller** local model.

**Cloud says "invalid key" or errors.**
Re-copy the key (no spaces), and make sure you saved it. For Ollama Cloud, also check the **model name** matches one on your account.

**It analysed nothing.**
The AI might not be reachable. Open the **AI** panel — the status line tells you if it's ready. If local, the app tries to start Ollama itself; if that fails, a cloud key is the reliable fix.

**Which is cheapest?**
Local (free, unlimited, slower) and the free cloud tiers (Groq, Gemini, Ollama Cloud — free with daily limits). Only OpenAI/Anthropic cost money.

---

*Privacy note: with a **local** model, listing text never leaves your laptop. With a **cloud** model, only the listing text is sent to the provider you chose — your name, preferences, and draft messages always stay on your device.*
