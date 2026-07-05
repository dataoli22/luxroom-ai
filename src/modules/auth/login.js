/**
 * LuxRoom AI — source login / session capture.
 *
 * Some sources (e.g. Appartager) only show listings to logged-in users. The
 * candidate logs in ONCE through a real browser window; we save Playwright's
 * storageState (cookies + localStorage) to a local file, and the crawler reuses
 * it so scraping happens as the logged-in user.
 *
 * The saved session is stored only on the device (userData/auth/<source>.json)
 * and never transmitted anywhere.
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const UA = process.platform === 'darwin'
  ? 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

// Sources that support a one-time login. Add more here as needed.
export const LOGIN_SOURCES = {
  appartager: {
    label: 'Appartager',
    loginUrl: 'https://www.appartager.lu/login',
  },
};

let _session = null; // { browser, context, source }

async function closeSession() {
  if (_session) {
    try { await _session.browser.close(); } catch { /* already gone */ }
    _session = null;
  }
}

/**
 * Open a visible browser window at the source's login page. The user logs in
 * manually, then the renderer calls saveLogin() to persist the session.
 */
export async function openLogin(source) {
  const cfg = LOGIN_SOURCES[source];
  if (!cfg) return { ok: false, error: `Unknown source: ${source}` };

  await closeSession();

  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    userAgent: UA,
    locale: 'fr-LU',
    viewport: { width: 1100, height: 820 },
  });
  const page = await context.newPage();
  // If the user closes the window themselves, drop the session so saveLogin
  // fails cleanly instead of hanging.
  browser.on('disconnected', () => { if (_session && _session.browser === browser) _session = null; });
  await page.goto(cfg.loginUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});

  _session = { browser, context, source };
  return { ok: true };
}

/**
 * Persist the current session's storageState to authDir/<source>.json and close
 * the login window. Call after the user has finished logging in.
 */
export async function saveLogin(source, authDir) {
  if (!_session || _session.source !== source) {
    return { ok: false, error: 'The login window is not open. Click "Connect" and log in first.' };
  }
  try {
    fs.mkdirSync(authDir, { recursive: true });
    const file = path.join(authDir, `${source}.json`);
    await _session.context.storageState({ path: file });
    await closeSession();
    return { ok: true, file };
  } catch (err) {
    await closeSession();
    return { ok: false, error: err.message ?? String(err) };
  }
}

export async function cancelLogin() {
  await closeSession();
  return { ok: true };
}

/** Remove a saved session (disconnect). */
export function clearLogin(source, authDir) {
  try {
    const file = path.join(authDir, `${source}.json`);
    if (fs.existsSync(file)) fs.rmSync(file, { force: true });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message ?? String(err) };
  }
}
