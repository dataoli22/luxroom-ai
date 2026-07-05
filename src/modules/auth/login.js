/**
 * LuxRoom AI — source login / session capture.
 *
 * Some sources (e.g. Appartager) only show listings to logged-in users. The
 * candidate logs in ONCE in a real browser window; we capture the session
 * (cookies + localStorage) and the crawler reuses it via Playwright storageState.
 *
 * The login window is an Electron BrowserWindow (Electron always ships Chromium),
 * so it opens reliably in the packaged app — unlike launching a separate
 * Playwright browser, whose binaries may not be present. The session is stored
 * only on the device (userData/auth/<source>.json) and never transmitted.
 */

import { BrowserWindow, session } from 'electron';
import fs from 'fs';
import path from 'path';

export const LOGIN_SOURCES = {
  appartager: {
    label: 'Appartager',
    loginUrl: 'https://www.appartager.lu/login',
    cookieDomain: 'appartager.lu',
  },
};

let _win = null;
let _source = null;
let _partition = null;

function partitionFor(source) {
  return `persist:login-${source}`;
}

async function closeWindow() {
  if (_win) {
    try { if (!_win.isDestroyed()) _win.close(); } catch { /* already gone */ }
  }
  _win = null;
}

/**
 * Open (or re-open) a visible browser window at the source's login page.
 */
export async function openLogin(source) {
  const cfg = LOGIN_SOURCES[source];
  if (!cfg) return { ok: false, error: `Unknown source: ${source}` };

  await closeWindow();
  _source = source;
  _partition = partitionFor(source);

  _win = new BrowserWindow({
    width: 1040,
    height: 840,
    title: `Log in to ${cfg.label}`,
    autoHideMenuBar: true,
    webPreferences: {
      partition: _partition,     // isolated, persistent session we can read cookies from
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  _win.on('closed', () => { _win = null; }); // keep _source/_partition so save still works

  try {
    await _win.loadURL(cfg.loginUrl);
  } catch { /* redirects / interstitials are fine */ }
  if (_win && !_win.isDestroyed()) { _win.show(); _win.focus(); }

  return { ok: true };
}

function mapSameSite(s) {
  switch (String(s || '').toLowerCase()) {
    case 'no_restriction': return 'None';
    case 'strict': return 'Strict';
    case 'lax': return 'Lax';
    default: return 'Lax';
  }
}

/**
 * Capture the current session as a Playwright storageState file. Works whether
 * or not the login window is still open, because the partition is persistent.
 */
export async function saveLogin(source, authDir) {
  if (_source !== source || !_partition) {
    return { ok: false, error: 'The login window is not open. Click "Open login window" and log in first.' };
  }
  const cfg = LOGIN_SOURCES[source];
  try {
    const ses = session.fromPartition(_partition);
    const raw = await ses.cookies.get({});
    const cookies = raw
      .filter(c => c.domain && c.domain.includes(cfg.cookieDomain))
      .map(c => {
        let sameSite = mapSameSite(c.sameSite);
        // Playwright rejects SameSite=None on a non-secure cookie.
        if (sameSite === 'None' && !c.secure) sameSite = 'Lax';
        return {
          name: c.name,
          value: c.value,
          domain: c.domain,
          path: c.path || '/',
          expires: c.expirationDate ? Math.round(c.expirationDate) : -1,
          httpOnly: !!c.httpOnly,
          secure: !!c.secure,
          sameSite,
        };
      });

    if (cookies.length === 0) {
      return { ok: false, error: "No login detected yet. Finish logging in in the window, then click \"I've logged in\"." };
    }

    // Best-effort localStorage capture (needs the live page).
    let origins = [];
    try {
      if (_win && !_win.isDestroyed()) {
        const url = _win.webContents.getURL();
        const origin = new URL(url).origin;
        const lsJson = await _win.webContents.executeJavaScript('JSON.stringify(window.localStorage)');
        const ls = JSON.parse(lsJson || '{}');
        const localStorage = Object.entries(ls).map(([name, value]) => ({ name, value: String(value) }));
        if (localStorage.length) origins = [{ origin, localStorage }];
      }
    } catch { /* localStorage optional */ }

    fs.mkdirSync(authDir, { recursive: true });
    const file = path.join(authDir, `${source}.json`);
    fs.writeFileSync(file, JSON.stringify({ cookies, origins }, null, 2));

    await closeWindow();
    _source = null;
    _partition = null;
    return { ok: true, file };
  } catch (err) {
    return { ok: false, error: err.message ?? String(err) };
  }
}

export async function cancelLogin() {
  await closeWindow();
  _source = null;
  _partition = null;
  return { ok: true };
}

/** Remove a saved session (disconnect) and clear the persistent partition. */
export async function clearLogin(source, authDir) {
  try {
    const file = path.join(authDir, `${source}.json`);
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    try { await session.fromPartition(partitionFor(source)).clearStorageData(); } catch {}
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message ?? String(err) };
  }
}
