'use strict'
// Electron main process — CommonJS entry point.
// ESM pipeline modules are loaded via dynamic import() to avoid Node.js v20
// ESM→CJS static-link interop bugs in Electron's bundled runtime.

const { app, BrowserWindow, ipcMain, shell, Tray, Menu, nativeImage, Notification, globalShortcut } = require('electron')

function buildAppMenu() {
  const isMac = process.platform === 'darwin'
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}
const path     = require('path')
const http     = require('http')
const https    = require('https')
const fs       = require('fs')
const os       = require('os')
const { spawn, exec, execFile } = require('child_process')
const { promisify } = require('util')
const nodemailer = require('nodemailer')

const execAsync = promisify(exec)
const execFileAsync = promisify(execFile)

// Resolve the ollama binary by full path. A freshly-installed Ollama is not on
// the PATH of the already-running Electron process, so `spawn('ollama')` throws
// ENOENT — we look in the known install locations first.
function resolveOllama() {
  const candidates = []
  if (process.platform === 'win32') {
    if (process.env.LOCALAPPDATA) candidates.push(path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'))
    if (process.env.ProgramFiles) candidates.push(path.join(process.env.ProgramFiles, 'Ollama', 'ollama.exe'))
  } else if (process.platform === 'darwin') {
    candidates.push('/usr/local/bin/ollama', '/opt/homebrew/bin/ollama', '/Applications/Ollama.app/Contents/Resources/ollama')
  } else {
    candidates.push('/usr/local/bin/ollama', '/usr/bin/ollama')
  }
  for (const c of candidates) { try { if (fs.existsSync(c)) return c } catch {} }
  return 'ollama' // fall back to PATH
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Talk to the Ollama HTTP server directly. This works whenever Ollama is
// installed AND running, regardless of where the binary lives or whether it's
// on the (possibly stale) PATH of this process — far more reliable than the CLI.
function ollamaBase() {
  try { return (_settings.getSettings().OLLAMA_BASE_URL || 'http://localhost:11434').replace(/\/$/, '') }
  catch { return 'http://localhost:11434' }
}
function ollamaHeaders() {
  const h = { 'Content-Type': 'application/json' }
  try { const k = _settings.getSettings().OLLAMA_API_KEY; if (k) h.Authorization = `Bearer ${k}` } catch {}
  return h
}
function humanSize(bytes) {
  const b = Number(bytes)
  if (!Number.isFinite(b) || b <= 0) return ''
  const gb = b / 1e9
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${Math.round(b / 1e6)} MB`
}

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null
let tray = null
let _unreadCount = 0

function updateTrayTooltip() {
  if (!tray || tray.isDestroyed()) return;
  try {
    const s = _pipeline ? _pipeline.getPipelineStatus() : null;
    if (!s) return;
    const parts = ['LuxRoom AI'];
    if (s.running) {
      parts.push('Scanning now…');
    } else if (s.lastCrawl) {
      const diffMs = Date.now() - new Date(s.lastCrawl).getTime();
      const diffMin = Math.floor(diffMs / 60000);
      parts.push(diffMin < 60 ? `Last scan ${diffMin}m ago` : `Last scan ${Math.floor(diffMin / 60)}h ago`);
    } else {
      parts.push('Not started');
    }
    if (_unreadCount > 0) parts.push(`${_unreadCount} new listing${_unreadCount !== 1 ? 's' : ''}`);
    tray.setToolTip(parts.join(' · '));
  } catch {}
}

function setUnreadBadge(count) {
  _unreadCount = count;
  if (process.platform === 'darwin' && app.dock) {
    app.dock.setBadge(count > 0 ? String(count) : '');
  }
  updateTrayTooltip();
}

function createTrayIcon() {
  // 16x16 purple square from raw RGBA buffer — no external file needed
  const SIZE = 16
  const buf = Buffer.alloc(SIZE * SIZE * 4)
  for (let i = 0; i < SIZE * SIZE; i++) {
    const x = i % SIZE, y = Math.floor(i / SIZE)
    const cx = SIZE / 2, cy = SIZE / 2, r = SIZE / 2 - 1
    const inside = Math.sqrt((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2) < r
    buf[i * 4]     = inside ? 0x7c : 0x00
    buf[i * 4 + 1] = inside ? 0x5c : 0x00
    buf[i * 4 + 2] = inside ? 0xbf : 0x00
    buf[i * 4 + 3] = inside ? 0xff : 0x00
  }
  return nativeImage.createFromBuffer(buf, { width: SIZE, height: SIZE })
}

function showWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
  // Clear unread badge when user opens window
  setUnreadBadge(0)
}

function buildTray() {
  if (tray) return // only ever one tray icon
  tray = new Tray(createTrayIcon())
  tray.setToolTip('LuxRoom AI — housing scanner')
  const menu = Menu.buildFromTemplate([
    { label: 'Open LuxRoom AI', click: showWindow },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; tray.destroy(); app.quit() } },
  ])
  tray.setContextMenu(menu)
  tray.on('double-click', showWindow)
}

// ESM module refs — populated after app is ready
let _settings, _pipeline, _db, _messaging, _hermes, _hardware, _auth

async function loadModules() {
  const base = 'file:///' + __dirname.replace(/\\/g, '/') + '/../src/'
  _settings  = await import(base + 'settings.js')
  _db        = await import(base + 'db/database.js')
  _pipeline  = await import(base + 'pipeline.js')
  _messaging = await import(base + 'modules/messaging/messenger.js')
  _hermes    = await import(base + 'modules/hermes/hermes.js')
  _hardware  = await import(base + 'hardware.js')
  _auth      = await import(base + 'modules/auth/login.js')
}

function authDir() {
  return path.join(app.getPath('userData'), 'auth')
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  // Hide to tray on close — keep pipeline running in background
  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault()
      mainWindow.hide()
      if (tray && process.platform === 'win32') {
        tray.displayBalloon({
          title: 'LuxRoom AI is still running',
          content: 'Scanning continues in the background. Right-click the tray icon to quit.',
          iconType: 'info',
        })
      }
    }
  })

  // Content Security Policy — block inline scripts and restrict sources
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          isDev
            // dev: allow localhost vite HMR websocket
            ? "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws://localhost:5173 http://localhost:5173; img-src 'self' data:; font-src 'self' data:"
            : "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'none'",
        ],
      },
    })
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => { mainWindow = null })
}

// ─── Approval HTTP server ──────────────────────────────────────────────────
// Handles one-click approve / discard links embedded in notification emails.
// Binds to a random port on 127.0.0.1 so it is only reachable on this machine.

function pushApprovalsUpdated() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('approvals:updated')
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function htmlResponse(title, body) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)} — LuxRoom AI</title>
  <style>
    body { margin: 0; min-height: 100vh; display: flex; align-items: center; justify-content: center;
           font-family: 'Segoe UI', system-ui, sans-serif; background: #0f1117; color: #e2e8f0; }
    .card { background: #1a1d27; border: 1px solid #2e3250; border-radius: 16px; padding: 40px 48px;
            text-align: center; max-width: 420px; }
    h1 { font-size: 22px; margin: 0 0 12px; }
    p  { color: #8892b0; font-size: 15px; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(body)}</p>
  </div>
</body>
</html>`
}

async function startApprovalServer() {
  const server = http.createServer(async (req, res) => {
    let parsedUrl
    try { parsedUrl = new URL(req.url, 'http://127.0.0.1') } catch {
      res.writeHead(400); res.end('Bad request'); return
    }

    const action     = parsedUrl.pathname === '/approve' ? 'approve'
                     : parsedUrl.pathname === '/discard' ? 'discard'
                     : null
    const listingUrl = parsedUrl.searchParams.get('listingUrl')
    const draftId    = parsedUrl.searchParams.get('draftId')

    // Validate draftId is a UUID and listingUrl is a well-formed URL
    const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    let parsedListing
    try { parsedListing = listingUrl ? new URL(listingUrl) : null } catch { parsedListing = null }
    const validListing = parsedListing && (parsedListing.protocol === 'https:' || parsedListing.protocol === 'http:')

    if (!action || !validListing || !draftId || !uuidRe.test(draftId)) {
      res.writeHead(400, { 'Content-Type': 'text/html' })
      res.end(htmlResponse('Invalid Request', 'Missing or malformed parameters.'))
      return
    }

    try {
      if (action === 'approve') {
        const updated = await _db.updateDraft(listingUrl, draftId, {
          approved: true,
          approvedAt: new Date().toISOString(),
        })
        const listing = await _db.getListing(listingUrl)
        if (!listing) throw new Error(`Listing not found: ${listingUrl}`)
        const draft = { ...(listing.messageDrafts ?? []).find(d => d.id === draftId), ...updated, approved: true }
        const sendEvent = await _hermes.sendApprovedDraft(listing, draft)
        await _db.logSendEvent(listingUrl, sendEvent)
        pushApprovalsUpdated()
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(htmlResponse('✓ Approved & Sent', 'Your message has been sent to the landlord.<br>You can close this tab.'))
      } else {
        await _db.updateDraft(listingUrl, draftId, { discarded: true })
        pushApprovalsUpdated()
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(htmlResponse('✗ Draft Discarded', 'The draft has been discarded.<br>You can close this tab.'))
      }
    } catch (err) {
      console.error('[approval-server]', err.message)
      res.writeHead(500, { 'Content-Type': 'text/html' })
      res.end(htmlResponse('Error', err.message.slice(0, 200)))
    }
  })

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  process.env.LUXROOM_APPROVAL_PORT = String(port)
  console.log(`[approval-server] Listening on 127.0.0.1:${port}`)

  app.on('before-quit', () => server.close())
  return port
}

// ─── App lifecycle ─────────────────────────────────────────────────────────

// Single-instance lock — prevents a second launch from spawning another process
// (and therefore another tray icon). The second launch just focuses the window.
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => { showWindow() })
}

app.whenReady().then(async () => {
  if (!gotTheLock) return
  buildAppMenu()
  // Set userData path so settings.js can locate its config file
  process.env.ELECTRON_USER_DATA = app.getPath('userData')

  await loadModules()

  _settings.applyToEnv(_settings.getSettings())
  await _db.initDb()

  // Start email-approval HTTP server (sets LUXROOM_APPROVAL_PORT for notifier)
  await startApprovalServer()

  // Stream log lines to renderer
  _pipeline.logEmitter.on('log', (line) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('log:line', line)
    }
  })

  // Broadcast scan:complete to renderer, update tray badge, fire OS notification
  _pipeline.scanEmitter.on('complete', ({ savedCount, scanCycles }) => {
    if (savedCount > 0) setUnreadBadge(_unreadCount + savedCount)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('scan:complete', { savedCount, scanCycles })
    }
    updateTrayTooltip()

    // Native OS popup for every completed scan
    if (Notification.isSupported()) {
      const n = new Notification({
        title: savedCount > 0 ? `LuxRoom AI — ${savedCount} new listing${savedCount !== 1 ? 's' : ''} found` : 'LuxRoom AI — Scan complete',
        body: savedCount > 0
          ? `Tap to review your new listings  ·  Scan #${scanCycles}`
          : `No new listings this scan  ·  Scan #${scanCycles}`,
      })
      n.on('click', showWindow)
      n.show()
    }
  })

  // Update tray tooltip every 60 seconds
  setInterval(updateTrayTooltip, 60000)

  // Push approvals:updated when the pipeline creates a new draft
  if (_pipeline.approvalsEmitter) {
    _pipeline.approvalsEmitter.on('updated', pushApprovalsUpdated)

    // Away mode — auto-approve if score meets threshold
    _pipeline.approvalsEmitter.on('draft-saved', async ({ listingUrl, draftId, opportunityScore }) => {
      const config = _settings.getSettings()
      const threshold = Number(config.AUTO_APPROVE_THRESHOLD ?? 9)
      if (config.APPROVAL_MODE !== 'auto' || opportunityScore < threshold) return

      console.log(`[main] Away mode: auto-approving ${listingUrl} (score ${opportunityScore})`)
      try {
        const updated = await _db.updateDraft(listingUrl, draftId, {
          approved: true,
          approvedAt: new Date().toISOString(),
        })
        const listing = await _db.getListing(listingUrl)
        if (!listing) return
        const draft = { ...(listing.messageDrafts ?? []).find(d => d.id === draftId), ...updated, approved: true }
        const sendEvent = await _hermes.sendApprovedDraft(listing, draft)
        await _db.logSendEvent(listingUrl, sendEvent)
        pushApprovalsUpdated()
        console.log(`[main] Away mode: sent to ${listing.contactMethod ?? 'landlord'}`)
      } catch (err) {
        console.error('[main] Away mode auto-approve failed:', err.message)
      }
    })
  }

  createWindow()
  buildTray()

  // Keyboard shortcut: Ctrl/Cmd+R → Run Now
  globalShortcut.register('CommandOrControl+R', () => {
    if (_pipeline) {
      _pipeline.processNewListings().catch(err => console.error('[main] shortcut run-now error:', err))
    }
  })

  // Auto-updater (GitHub releases)
  try {
    const { autoUpdater } = require('electron-updater')
    autoUpdater.checkForUpdatesAndNotify().catch(() => {})
  } catch {}

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
    else showWindow()
  })

  app.on('will-quit', () => {
    globalShortcut.unregisterAll()
  })
})

// Hide to tray instead of quitting when window is closed
app.on('window-all-closed', () => {
  // Do nothing — keep the process alive for background scanning
  // User must quit via tray menu or Cmd+Q
})

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', async () => _settings.getSettings())

ipcMain.handle('settings:save', async (_e, partial) => {
  const prev = _settings.getSettings()
  _settings.saveSettings(partial)
  _settings.applyToEnv(_settings.getSettings())
  // Restart pipeline if crawl interval changed while running
  const next = _settings.getSettings()
  const prevHours = prev.CRAWL_INTERVAL_HOURS ?? prev.crawlIntervalHours
  const nextHours = next.CRAWL_INTERVAL_HOURS ?? next.crawlIntervalHours
  if (prevHours !== nextHours && _pipeline.getPipelineStatus().running) {
    _pipeline.stopPipeline()
    await _pipeline.startPipeline()
  }
  return next
})

ipcMain.handle('pipeline:start', async () => {
  await _pipeline.startPipeline()
  return _pipeline.getPipelineStatus()
})

ipcMain.handle('pipeline:stop', async () => {
  _pipeline.stopPipeline()
  return _pipeline.getPipelineStatus()
})

ipcMain.handle('pipeline:status', async () => _pipeline.getPipelineStatus())

ipcMain.handle('pipeline:run-now', async () => {
  _pipeline.processNewListings().catch(err => console.error('[main] run-now error:', err))
})

ipcMain.handle('listings:get-all', async () => _db.getAllListings())

ipcMain.handle('listings:get', async (_e, url) => _db.getListing(url))

// Returns flat array of { listing, draft } — one entry per pending draft
ipcMain.handle('approvals:get-pending', async () => {
  const listings = await _db.getAllListings()
  const flat = []
  for (const listing of listings) {
    const drafts = (listing.messageDrafts ?? []).filter(d => !d.approved && !d.discarded)
    for (const draft of drafts) {
      flat.push({ listing, draft })
    }
  }
  return flat
})

ipcMain.handle('approvals:approve', async (_e, { listingUrl, draftId, body }) => {
  const patch = { approved: true, approvedAt: new Date().toISOString() }
  // If the user edited the draft in the Approvals tab, send the edited text.
  if (typeof body === 'string' && body.trim()) patch.body = body.trim()
  const updated = await _db.updateDraft(listingUrl, draftId, patch)
  const listing = await _db.getListing(listingUrl)
  if (!listing) throw new Error(`Listing not found: ${listingUrl}`)
  const draft = { ...(listing.messageDrafts ?? []).find(d => d.id === draftId), ...updated, approved: true }
  const sendEvent = await _hermes.sendApprovedDraft(listing, draft)
  await _db.logSendEvent(listingUrl, sendEvent)
  pushApprovalsUpdated()
  return sendEvent
})

ipcMain.handle('approvals:discard', async (_e, { listingUrl, draftId }) => {
  const result = await _db.updateDraft(listingUrl, draftId, { discarded: true })
  pushApprovalsUpdated()
  return result
})

ipcMain.handle('approvals:generate-draft', async (_e, { listingUrl, type }) => {
  const listing = await _db.getListing(listingUrl)
  if (!listing) throw new Error(`Listing not found: ${listingUrl}`)
  const draft = await _messaging.generateDraft(listing, type)
  const saved = await _db.saveDraft(listingUrl, draft)
  pushApprovalsUpdated()
  return saved
})

ipcMain.handle('email:test', async (_e, { to, config }) => {
  const s = _settings.getSettings()
  // Prefer the config passed from the current form/onboarding (which may not be
  // saved yet); fall back to persisted settings.
  const host = (config?.host || s.SMTP_HOST || '').trim()
  const port = Number(config?.port ?? s.SMTP_PORT ?? 587)
  const user = (config?.user || s.SMTP_USER || to || '').trim()
  // Gmail shows the 16-char App Password in 4 space-separated groups; users
  // paste it with spaces. Strip all whitespace so auth doesn't fail.
  const pass = String(config?.pass ?? s.SMTP_PASS ?? '').replace(/\s+/g, '')
  const from = (config?.from || s.SMTP_FROM || user || '').trim()
  const secure = config?.secure != null ? !!config.secure : (s.SMTP_SECURE === 'true')
  const recipient = (to || user || '').trim()

  if (!host || !user || !pass) {
    return { ok: false, error: 'Missing email settings — enter your email and app password first.' }
  }
  try {
    const t = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
    await t.sendMail({
      from: from || user,
      to: recipient,
      subject: 'LuxRoom AI — Test Email',
      text: 'This is a test email from LuxRoom AI. Your email configuration is working correctly.',
    })
    return { ok: true, error: null }
  } catch (err) {
    return { ok: false, error: err.message ?? String(err) }
  }
})

ipcMain.handle('hardware:detect', async () => {
  try {
    return _hardware.detectHardware()
  } catch (err) {
    return { error: err.message }
  }
})

const ALLOWED_EXTERNAL_DOMAINS = new Set([
  'ollama.com', 'console.groq.com', 'openrouter.ai', 'api.together.xyz',
  'myaccount.google.com', 'account.microsoft.com', 'login.yahoo.com',
  'appleid.apple.com', 'proton.me', 'protonmail.com',
  'console.anthropic.com', 'docs.anthropic.com',
  'platform.openai.com',
  'aistudio.google.com', 'ai.google.dev',
])
function isAllowedUrl(url) {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    return [...ALLOWED_EXTERNAL_DOMAINS].some(d => hostname === d || hostname.endsWith('.' + d))
  } catch { return false }
}
ipcMain.handle('shell:open-external', (_e, url) => {
  if (!isAllowedUrl(url)) {
    console.warn('[security] blocked openExternal:', url)
    return
  }
  return shell.openExternal(url)
})

// Open housing listing URLs (from our own DB — any https:// URL is safe)
ipcMain.handle('listings:open-url', (_e, url) => {
  let parsed
  try { parsed = new URL(url) } catch { return }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return
  return shell.openExternal(url)
})

// ─── Source login (one-time session capture for login-gated sources) ─────────

ipcMain.handle('auth:sources', async () => _auth.LOGIN_SOURCES)

ipcMain.handle('auth:open-login', async (_e, { source }) => _auth.openLogin(source))

ipcMain.handle('auth:save-login', async (_e, { source }) => {
  const res = await _auth.saveLogin(source, authDir())
  if (res.ok) {
    // Record the session file path so the crawler can find it.
    const s = _settings.getSettings()
    const sourceAuth = { ...(s.SOURCE_AUTH || {}), [source]: res.file }
    _settings.saveSettings({ SOURCE_AUTH: sourceAuth })
    _settings.applyToEnv(_settings.getSettings())
  }
  return res
})

ipcMain.handle('auth:cancel-login', async () => _auth.cancelLogin())

ipcMain.handle('auth:clear-login', async (_e, { source }) => {
  const res = await _auth.clearLogin(source, authDir())
  const s = _settings.getSettings()
  const sourceAuth = { ...(s.SOURCE_AUTH || {}) }
  delete sourceAuth[source]
  _settings.saveSettings({ SOURCE_AUTH: sourceAuth })
  _settings.applyToEnv(_settings.getSettings())
  return res
})

// Which sources have a saved (and still-present) session file.
ipcMain.handle('auth:status', async () => {
  const s = _settings.getSettings()
  const sourceAuth = s.SOURCE_AUTH || {}
  const out = {}
  for (const [key, file] of Object.entries(sourceAuth)) {
    out[key] = typeof file === 'string' && fs.existsSync(file)
  }
  return out
})

// ─── Ollama setup & model management ─────────────────────────────────────────

function pushSetupProgress(phase, message, pct, error = false) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('setup:progress', { phase, message, pct, error })
  }
}

ipcMain.handle('setup:check-ollama', async () => {
  // Prefer the running server — the most reliable "is Ollama usable" signal.
  try {
    const r = await fetch(`${ollamaBase()}/api/version`, { signal: AbortSignal.timeout(3000) })
    if (r.ok) { const d = await r.json().catch(() => ({})); return { installed: true, running: true, version: d.version || 'running' } }
  } catch { /* server not up — try the binary next */ }
  try {
    const { stdout } = await execFileAsync(resolveOllama(), ['--version'])
    // Binary exists but server may be down — still "installed".
    return { installed: true, running: false, version: stdout.trim() }
  } catch {
    return { installed: false, running: false }
  }
})

ipcMain.handle('setup:install-ollama', async () => {
  const platform = process.platform

  // macOS: download zip, unzip directly into /Applications
  if (platform === 'darwin') {
    const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'luxroom-ollama-'))
    const tmpPath = path.join(tmpDir, 'Ollama.zip')
    pushSetupProgress('install', 'Downloading Ollama…', 5)

    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tmpPath)
      const follow = (url) => {
        https.get(url, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302) {
            return follow(res.headers.location)
          }
          const total = parseInt(res.headers['content-length'] ?? '0', 10)
          let received = 0
          res.on('data', chunk => {
            received += chunk.length
            const pct = total > 0 ? Math.round(5 + (received / total) * 55) : 30
            pushSetupProgress('install', `Downloading… ${Math.round(received / 1024 / 1024)} MB`, pct)
            file.write(chunk)
          })
          res.on('end', () => { file.end(); resolve() })
          res.on('error', reject)
        }).on('error', reject)
      }
      follow('https://ollama.com/download/Ollama-darwin.zip')
    })

    pushSetupProgress('install', 'Installing Ollama…', 65)
    try {
      const { execFile } = require('child_process')
      const { promisify } = require('util')
      await promisify(execFile)('unzip', ['-o', tmpPath, '-d', '/Applications'], { timeout: 60000 })
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
    }
    // Launch Ollama in the background so it's ready for model pulls
    try {
      spawn('open', ['-a', 'Ollama'], { detached: true, stdio: 'ignore' }).unref()
    } catch {}
    pushSetupProgress('install', 'Ollama installed ✓', 100)
    return { ok: true }
  }

  if (platform !== 'win32') {
    // Linux: open download page
    pushSetupProgress('install', 'Opening Ollama download page…', 50)
    shell.openExternal('https://ollama.com/download/linux')
    pushSetupProgress('install', 'Follow the instructions on the page that just opened ✓', 100)
    return { ok: true, manual: true }
  }

  // Windows: download and silently run the NSIS installer
  // Use a unique temp directory (not a predictable shared path) to prevent TOCTOU
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'luxroom-ollama-'))
  const tmpPath = path.join(tmpDir, 'OllamaSetup.exe')
  pushSetupProgress('install', 'Downloading Ollama installer…', 5)

  // Download, resolving on the file stream's 'finish' so the .exe is fully
  // flushed to disk before we try to run it (a truncated exe causes spawn UNKNOWN).
  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpPath)
    file.on('error', reject)
    file.on('finish', resolve)
    const pipeFrom = (res) => {
      const total = parseInt(res.headers['content-length'] ?? '0', 10)
      let received = 0
      res.on('data', chunk => {
        received += chunk.length
        const pct = total > 0 ? Math.round(5 + (received / total) * 55) : 30
        pushSetupProgress('install', `Downloading… ${Math.round(received / 1024 / 1024)} MB`, pct)
      })
      res.on('error', reject)
      res.pipe(file)
    }
    const follow = (url) => https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) { res.resume(); return follow(res.headers.location) }
      pipeFrom(res)
    }).on('error', reject)
    follow('https://ollama.com/download/OllamaSetup.exe')
  })

  // Try a silent install first. If that fails (spawn UNKNOWN, elevation blocked,
  // mark-of-the-web), fall back to launching the installer through the OS so the
  // user can click through it — reliable where direct spawn is not.
  pushSetupProgress('install', 'Running the Ollama installer…', 65)
  let silentOk = false
  try {
    await new Promise((resolve, reject) => {
      const child = spawn(tmpPath, ['/S'], { windowsHide: true })
      child.on('error', reject)
      child.on('exit', code => code === 0 ? resolve() : reject(new Error(`installer exit ${code}`)))
    })
    silentOk = true
  } catch (err) {
    console.warn('[setup] silent Ollama install failed, opening installer via OS:', err.message)
    const openErr = await shell.openPath(tmpPath)
    if (openErr) {
      shell.openExternal('https://ollama.com/download/windows')
      pushSetupProgress('install', 'Opened the Ollama download page — install it, then continue.', 85, true)
    } else {
      pushSetupProgress('install', 'Complete the Ollama installer window that just opened…', 70)
    }
  }

  // Wait (up to 5 min) for the ollama binary to appear, whether silent or
  // interactive, so the model-download step can find it right away.
  const deadline = Date.now() + 5 * 60 * 1000
  while (Date.now() < deadline) {
    if (resolveOllama() !== 'ollama') break
    await sleep(3000)
  }
  // Leave the installer in the OS temp dir (may still be running); the OS cleans it.
  pushSetupProgress('install', 'Ollama installed ✓', 100)
  return { ok: true, silent: silentOk }
})

// Ensure the Ollama server is reachable; if not, try to start it via the binary.
async function ensureOllamaServer() {
  try {
    const r = await fetch(`${ollamaBase()}/api/version`, { signal: AbortSignal.timeout(2500) })
    if (r.ok) return true
  } catch { /* not up yet */ }
  // Try to start the server in the background, then wait for it.
  try {
    const bin = resolveOllama()
    spawn(bin, ['serve'], { detached: true, stdio: 'ignore', windowsHide: true }).unref()
  } catch { /* binary not found — nothing we can do */ }
  for (let i = 0; i < 10; i++) {
    await sleep(1500)
    try {
      const r = await fetch(`${ollamaBase()}/api/version`, { signal: AbortSignal.timeout(2500) })
      if (r.ok) return true
    } catch { /* keep waiting */ }
  }
  return false
}

ipcMain.handle('setup:pull-model', async (_e, model) => {
  if (typeof model !== 'string' || !/^[\w.:/-]+$/.test(model)) {
    throw new Error('Invalid model name')
  }
  pushSetupProgress('pull', `Starting download of ${model}…`, 0)

  const up = await ensureOllamaServer()
  if (!up) {
    const msg = 'Ollama is installed but not running. Open Ollama (Start menu / menu bar), then click Retry.'
    pushSetupProgress('pull', msg, null, true)
    throw new Error(msg)
  }

  // Pull via the HTTP API and stream NDJSON progress — no CLI/binary path needed.
  let res
  try {
    res = await fetch(`${ollamaBase()}/api/pull`, {
      method: 'POST',
      headers: ollamaHeaders(),
      body: JSON.stringify({ name: model, stream: true }),
    })
  } catch (err) {
    const msg = `Could not reach Ollama: ${err.message}`
    pushSetupProgress('pull', msg, null, true)
    throw new Error(msg)
  }
  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => '')
    const msg = `Ollama pull failed (${res.status}): ${body.slice(0, 200)}`
    pushSetupProgress('pull', msg, null, true)
    throw new Error(msg)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.trim()) continue
      let obj
      try { obj = JSON.parse(line) } catch { continue }
      if (obj.error) {
        pushSetupProgress('pull', obj.error, null, true)
        throw new Error(obj.error)
      }
      const pct = (obj.total && obj.completed) ? Math.round((obj.completed / obj.total) * 100) : null
      pushSetupProgress('pull', obj.status || 'Downloading…', pct)
    }
  }

  pushSetupProgress('pull', `${model} ready ✓`, 100)
  return { ok: true }
})

ipcMain.handle('setup:list-models', async () => {
  try {
    const r = await fetch(`${ollamaBase()}/api/tags`, { headers: ollamaHeaders(), signal: AbortSignal.timeout(5000) })
    if (!r.ok) return []
    const d = await r.json()
    return (d.models ?? []).map(m => ({
      name: m.name ?? m.model ?? '',
      size: humanSize(m.size),
      modified: m.modified_at ?? '',
    }))
  } catch {
    return []
  }
})

ipcMain.handle('setup:remove-model', async (_e, model) => {
  if (typeof model !== 'string' || !/^[\w.:/-]+$/.test(model)) {
    return { ok: false, error: 'Invalid model name' }
  }
  try {
    const r = await fetch(`${ollamaBase()}/api/delete`, {
      method: 'DELETE',
      headers: ollamaHeaders(),
      body: JSON.stringify({ name: model }),
    })
    return r.ok ? { ok: true } : { ok: false, error: `status ${r.status}` }
  } catch (err) {
    return { ok: false, error: err.message }
  }
})
