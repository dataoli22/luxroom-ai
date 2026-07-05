import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { chromium } from 'playwright';
import { getSettings } from '../../settings.js';

const SUBJECT_MAP = {
  introduction: 'Room enquiry',
  viewing_request: 'Viewing request',
  follow_up: 'Following up on my enquiry',
  negotiation: 'Rental negotiation',
};

function getSubject(draftType) {
  return SUBJECT_MAP[draftType] ?? 'Room enquiry';
}

function getSmtpTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendViaEmail(listing, draft) {
  const transporter = getSmtpTransport();
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: listing.contactMethod,
    subject: getSubject(draft.type),
    text: draft.body,
  });
}

async function fillContactForm(url, draft) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Fill name field — use the user's real name from their profile
    const applicantName = getSettings().profile?.name?.trim() || '';
    if (applicantName) {
      const nameSelectors = [
        '[name*="name" i]',
        '[id*="name" i]',
        '[placeholder*="name" i]',
      ];
      for (const sel of nameSelectors) {
        const el = page.locator(sel).first();
        if (await el.count() > 0) {
          await el.fill(applicantName);
          break;
        }
      }
    }

    // Fill message field
    const messageSelectors = [
      'textarea',
      '[name*="message" i]',
      '[id*="message" i]',
      '[placeholder*="message" i]',
    ];
    let messageFilled = false;
    for (const sel of messageSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await el.fill(draft.body);
        messageFilled = true;
        break;
      }
    }

    if (!messageFilled) {
      throw new Error('Hermes: could not locate message field on contact form');
    }

    // Click submit button
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Send")',
      'button:has-text("Submit")',
      'button:has-text("send")',
      'button:has-text("submit")',
    ];
    let submitted = false;
    for (const sel of submitSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
          el.click(),
        ]);
        submitted = true;
        break;
      }
    }

    if (!submitted) {
      throw new Error('Hermes: could not locate submit button on contact form');
    }
  } finally {
    await browser.close();
  }
}

async function sendViaPlatformMessage(listing, draft) {
  // Uses a persistent Playwright session (stored auth state) to send an
  // in-platform message. Expects PLAYWRIGHT_STORAGE_STATE env var to point
  // to a saved storageState JSON file produced by a prior login flow.
  const storageStatePath = process.env.PLAYWRIGHT_STORAGE_STATE ?? null;

  const browser = await chromium.launch({ headless: true });
  try {
    const contextOptions = storageStatePath
      ? { storageState: storageStatePath }
      : {};
    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    // listing.platformUrl should hold the actual listing URL for platform_message
    const targetUrl = listing.platformUrl ?? listing.url;
    if (!targetUrl) {
      throw new Error('Hermes: listing has no platformUrl or url for platform_message send');
    }

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    // Try to open a message/contact dialog
    const contactTriggers = [
      'button:has-text("Message")',
      'button:has-text("Contact")',
      'a:has-text("Message")',
      '[aria-label*="message" i]',
      '[aria-label*="contact" i]',
    ];
    for (const sel of contactTriggers) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await el.click();
        await page.waitForTimeout(1000);
        break;
      }
    }

    // Fill message textarea
    const messageSelectors = [
      'textarea',
      '[name*="message" i]',
      '[id*="message" i]',
      '[placeholder*="message" i]',
    ];
    let messageFilled = false;
    for (const sel of messageSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await el.fill(draft.body);
        messageFilled = true;
        break;
      }
    }

    if (!messageFilled) {
      throw new Error('Hermes: could not locate message field for platform_message send');
    }

    // Submit
    const submitSelectors = [
      'button[type="submit"]',
      'button:has-text("Send")',
      'button:has-text("Submit")',
    ];
    for (const sel of submitSelectors) {
      const el = page.locator(sel).first();
      if (await el.count() > 0) {
        await Promise.all([
          page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}),
          el.click(),
        ]);
        break;
      }
    }
  } finally {
    await browser.close();
  }
}

export async function sendApprovedDraft(listing, draft) {
  // HARD CHECK — must be first
  if (!draft.approved) {
    throw new Error('Hermes: cannot send unapproved draft');
  }

  const messageHash = crypto
    .createHash('sha256')
    .update(draft.body)
    .digest('hex')
    .slice(0, 16);

  // Guard: a listing with no usable contact method can't be sent to. Fail
  // gracefully with a clear reason instead of throwing a TypeError.
  if (!listing.contactMethod || typeof listing.contactMethod !== 'string' || listing.contactMethod === 'unknown') {
    return {
      draftId: draft.id,
      sentAt: new Date().toISOString(),
      platform: 'unknown',
      messageHash,
      status: 'failed',
      errorMessage: 'No contact method available for this listing — send it manually from the listing page.',
    };
  }

  let platform;
  if (listing.contactMethod.includes('@')) {
    platform = 'email';
  } else if (listing.contactMethod.includes('http')) {
    platform = 'contact_form';
  } else if (listing.contactMethod === 'platform_message') {
    platform = 'platform_message';
  } else {
    platform = 'unknown';
  }

  /** @type {{ draftId: string, sentAt: string, platform: string, messageHash: string, status: 'sent'|'failed', errorMessage: string|null }} */
  const sendEvent = {
    draftId: draft.id,
    sentAt: new Date().toISOString(),
    platform,
    messageHash,
    status: 'sent',
    errorMessage: null,
  };

  try {
    if (platform === 'email') {
      await sendViaEmail(listing, draft);
    } else if (platform === 'contact_form') {
      await fillContactForm(listing.contactMethod, draft);
    } else if (platform === 'platform_message') {
      await sendViaPlatformMessage(listing, draft);
    } else {
      throw new Error(`Hermes: unsupported contactMethod "${listing.contactMethod}"`);
    }
  } catch (err) {
    sendEvent.status = 'failed';
    sendEvent.errorMessage = err.message ?? String(err);
  }

  return sendEvent;
}
