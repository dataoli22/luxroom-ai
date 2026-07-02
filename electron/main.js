'use strict'
// Electron main process — CommonJS entry point.
// ESM pipeline modules are loaded via dynamic import() to avoid Node.js v20
// ESM→CJS static-link interop bugs in Electron's bundled runtime.

const { app, BrowserWindow, ipcMain, shell } = require('electron')
const path     = require('path')
const http     = require('http')
const https    = require('https')
const fs       = require('fs')
const os       = require('os')
const { spawn, exec } = require('child_process')
const { promisify } = require('util')
const nodemailer = require('nodemailer')

const execAsync = promisify(exec)

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let mainWindow = null

// ESM module refs — populated after app is ready
let _settings, _pipeline, _db, _messaging, _hermes, _hardware

async function loadModules() {
  const base = 'file:///' + __dirname.replace(/\\/g, '/') + '/../src/'
  _settings  = await import(base + 'settings.js')
  _db        = await import(base + 'db/database.js')
  _pipeline  = await import(base + 'pipeline.js')
  _messaging = await import(base + 'modules/messaging/messenger.js')
  _hermes    = await import(base + 'modules/hermes/hermes.js')
  _hardware  = await import(base + 'hardware.js')
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

app.whenReady().then(async () => {
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

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('settings:get', async () => _settings.getSettings())

ipcMain.handle('settings:save', async (_e, partial) => {
  _settings.saveSettings(partial)
  _settings.applyToEnv(_settings.getSettings())
  return _settings.getSettings()
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

ipcMain.handle('approvals:approve', async (_e, { listingUrl, draftId }) => {
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

ipcMain.handle('email:test', async (_e, { to }) => {
  const s = _settings.getSettings()
  try {
    const t = nodemailer.createTransport({
      host: s.SMTP_HOST, port: Number(s.SMTP_PORT ?? 587),
      secure: s.SMTP_SECURE === 'true',
      auth: { user: s.SMTP_USER, pass: s.SMTP_PASS },
    })
    await t.sendMail({
      from: s.SMTP_FROM, to,
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

// ─── Ollama setup & model management ─────────────────────────────────────────

function pushSetupProgress(phase, message, pct, error = false) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('setup:progress', { phase, message, pct, error })
  }
}

ipcMain.handle('setup:check-ollama', async () => {
  try {
    const { stdout } = await execAsync('ollama --version')
    return { installed: true, version: stdout.trim() }
  } catch {
    return { installed: false }
  }
})

ipcMain.handle('setup:install-ollama', async () => {
  const platform = process.platform

  // macOS: try Homebrew first (silent), then fall back to opening the download page
  if (platform === 'darwin') {
    pushSetupProgress('install', 'Installing Ollama via Homebrew…', 10)
    try {
      const { execFile } = require('child_process')
      const { promisify } = require('util')
      await promisify(execFile)('/bin/sh', ['-c', 'brew install ollama'], { timeout: 120000 })
      pushSetupProgress('install', 'Ollama installed via Homebrew ✓', 100)
      return { ok: true }
    } catch {
      // Homebrew not installed or failed — open download page so user can install manually
      pushSetupProgress('install', 'Opening Ollama download page…', 50)
      shell.openExternal('https://ollama.com/download/mac')
      pushSetupProgress('install', 'Install Ollama from the page that just opened, then return here ✓', 100)
      return { ok: true, manual: true }
    }
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

  await new Promise((resolve, reject) => {
    const file = fs.createWriteStream(tmpPath)
    const req = https.get('https://ollama.com/download/OllamaSetup.exe', (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, (res2) => {
          const total = parseInt(res2.headers['content-length'] ?? '0', 10)
          let received = 0
          res2.on('data', chunk => {
            received += chunk.length
            const pct = total > 0 ? Math.round(5 + (received / total) * 55) : 30
            pushSetupProgress('install', `Downloading… ${Math.round(received / 1024 / 1024)} MB`, pct)
            file.write(chunk)
          })
          res2.on('end', () => { file.end(); resolve() })
          res2.on('error', reject)
        }).on('error', reject)
        return
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
    })
    req.on('error', reject)
  })

  pushSetupProgress('install', 'Running installer… (takes ~30 seconds)', 65)
  try {
    const { execFile } = require('child_process')
    const { promisify } = require('util')
    await promisify(execFile)(tmpPath, ['/S'])
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
  }
  pushSetupProgress('install', 'Ollama installed ✓', 100)
  return { ok: true }
})

ipcMain.handle('setup:pull-model', async (_e, model) => {
  if (typeof model !== 'string' || !/^[\w.:/-]+$/.test(model)) {
    throw new Error('Invalid model name')
  }
  pushSetupProgress('pull', `Starting download of ${model}…`, 0)
  return new Promise((resolve, reject) => {
    const child = spawn('ollama', ['pull', model], { shell: false })
    child.stdout.on('data', data => {
      for (const line of data.toString().split('\n').filter(Boolean)) {
        const m = line.match(/(\d+)%/)
        pushSetupProgress('pull', line.trim(), m ? parseInt(m[1], 10) : null)
      }
    })
    child.stderr.on('data', data => {
      const line = data.toString().trim()
      if (line) pushSetupProgress('pull', line, null)
    })
    child.on('close', code => {
      if (code === 0) {
        pushSetupProgress('pull', `${model} ready ✓`, 100)
        resolve({ ok: true })
      } else {
        pushSetupProgress('pull', `Pull failed (exit ${code})`, null, true)
        reject(new Error(`ollama pull exited with code ${code}`))
      }
    })
    child.on('error', err => {
      pushSetupProgress('pull', `Could not start ollama: ${err.message}`, null, true)
      reject(err)
    })
  })
})

ipcMain.handle('setup:list-models', async () => {
  try {
    const { stdout } = await execAsync('ollama list')
    return stdout.trim().split('\n').slice(1)
      .filter(l => l.trim())
      .map(l => {
        const parts = l.trim().split(/\s{2,}/)
        return { name: parts[0] ?? '', size: parts[2] ?? '', modified: parts[3] ?? '' }
      })
  } catch {
    return []
  }
})

ipcMain.handle('setup:remove-model', async (_e, model) => {
  // Use spawn with explicit args — never concatenate user input into a shell string
  if (typeof model !== 'string' || !/^[\w.:/-]+$/.test(model)) {
    return { ok: false, error: 'Invalid model name' }
  }
  return new Promise(resolve => {
    const child = spawn('ollama', ['rm', model], { shell: false })
    child.on('close', code =>
      code === 0 ? resolve({ ok: true }) : resolve({ ok: false, error: `exit ${code}` })
    )
    child.on('error', err => resolve({ ok: false, error: err.message }))
  })
})
