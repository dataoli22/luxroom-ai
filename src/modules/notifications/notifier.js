import notifier from 'node-notifier';
import nodemailer from 'nodemailer';

const CORRIDOR_LABELS = {
  'north-line10': 'North Line 10',
  'city': 'Luxembourg City',
  'south': 'South',
  'other': 'Other',
};

// ---------------------------------------------------------------------------
// Email HTML template — with one-click approve / discard buttons
// ---------------------------------------------------------------------------

function buildEmailHtml(listing, draft, approvalPort) {
  const {
    verdict = 'CONSIDER',
    location = 'Unknown',
    rentTotal = 'unknown',
    estimatedCommute = 'unknown',
    opportunityScore,
    url = '',
    corridor,
  } = listing;

  const corridorLabel = CORRIDOR_LABELS[corridor] ?? 'Other';
  const scoreColor = opportunityScore >= 9 ? '#22c55e' : opportunityScore >= 7 ? '#f59e0b' : '#94a3b8';
  const draftText  = (draft?.body ?? draft?.message ?? draft?.text ?? '').replace(/\n/g, '<br>');

  const approveUrl = approvalPort
    ? `http://127.0.0.1:${approvalPort}/approve?listingUrl=${encodeURIComponent(url)}&draftId=${encodeURIComponent(draft?.id ?? '')}`
    : null;
  const discardUrl = approvalPort
    ? `http://127.0.0.1:${approvalPort}/discard?listingUrl=${encodeURIComponent(url)}&draftId=${encodeURIComponent(draft?.id ?? '')}`
    : null;

  const btn = (href, label, bg, color) =>
    href
      ? `<a href="${href}" style="display:inline-block;padding:12px 28px;background:${bg};color:${color};border-radius:8px;font-weight:700;font-size:15px;text-decoration:none;margin-right:12px;">${label}</a>`
      : '';

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f0f13;font-family:'Segoe UI',system-ui,sans-serif;color:#e2e8f0;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">

    <!-- Header -->
    <div style="margin-bottom:24px;">
      <span style="font-size:20px;font-weight:800;color:#c4b5fd;letter-spacing:-0.5px;">LuxRoom AI</span>
      <span style="margin-left:12px;font-size:13px;color:#64748b;">New high-opportunity listing</span>
    </div>

    <!-- Verdict badge + score -->
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap;">
      <span style="background:#7c3aed33;color:#a78bfa;border:1px solid #7c3aed55;border-radius:6px;padding:4px 14px;font-weight:700;font-size:13px;letter-spacing:1px;">
        ${verdict}
      </span>
      ${opportunityScore != null ? `<span style="color:${scoreColor};font-weight:700;font-size:18px;">Score ${opportunityScore}<span style="color:#475569;font-size:13px;font-weight:400">/10</span></span>` : ''}
    </div>

    <!-- Listing details -->
    <div style="background:#1a1d27;border:1px solid #2e3250;border-radius:12px;padding:20px 22px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr>
          <td style="color:#64748b;font-size:13px;padding:5px 0;width:120px;">📍 Location</td>
          <td style="color:#e2e8f0;font-size:14px;font-weight:600;padding:5px 0;">${location} · ${corridorLabel}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:13px;padding:5px 0;">💶 Rent</td>
          <td style="color:#e2e8f0;font-size:14px;font-weight:600;padding:5px 0;">${rentTotal}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:13px;padding:5px 0;">⏱ Commute</td>
          <td style="color:#e2e8f0;font-size:14px;padding:5px 0;">${estimatedCommute}</td>
        </tr>
        <tr>
          <td style="color:#64748b;font-size:13px;padding:5px 0;">🔗 Listing</td>
          <td style="padding:5px 0;"><a href="${url}" style="color:#818cf8;font-size:13px;word-break:break-all;">${url}</a></td>
        </tr>
      </table>
    </div>

    <!-- Draft message -->
    ${draftText ? `
    <div style="margin-bottom:20px;">
      <div style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:8px;">
        Draft outreach message ${draft?.language ? `(${draft.language.toUpperCase()})` : ''}
      </div>
      <div style="background:#0d1020;border:1px solid #2e3250;border-radius:8px;padding:16px 18px;color:#cbd5e1;font-size:14px;line-height:1.7;">
        ${draftText}
      </div>
    </div>` : ''}

    <!-- Action buttons -->
    <div style="margin-bottom:28px;">
      ${approveUrl && discardUrl ? `
        <div style="margin-bottom:12px;">
          ${btn(approveUrl, '✓ Approve &amp; Send', '#166534', '#4ade80')}
          ${btn(discardUrl, '✗ Discard', '#7f1d1d', '#f87171')}
        </div>
        <div style="color:#475569;font-size:12px;line-height:1.6;">
          These buttons work while LuxRoom AI is running on your computer.<br>
          You can also manage this in the <strong style="color:#64748b">Approvals</strong> tab in the app.
        </div>
      ` : `
        <div style="color:#64748b;font-size:13px;">
          Open the <strong>Approvals</strong> tab in LuxRoom AI to review and send this message.
        </div>
      `}
    </div>

    <!-- Footer -->
    <div style="border-top:1px solid #1e2235;padding-top:16px;color:#334155;font-size:12px;">
      LuxRoom AI · Open Source · Running locally on your device
    </div>
  </div>
</body>
</html>`;
}

function buildEmailText(listing, draft) {
  const { verdict, location, rentTotal, estimatedCommute, url, opportunityScore } = listing;
  const draftText = draft?.body ?? draft?.message ?? draft?.text ?? '';
  return [
    `LuxRoom AI — New listing (${verdict})`,
    '',
    `📍 ${location}`,
    `💶 ${rentTotal}  ⏱ ${estimatedCommute}`,
    `Opportunity score: ${opportunityScore}/10`,
    `🔗 ${url}`,
    '',
    draftText ? `Draft message:\n${draftText}` : '',
    '',
    'Open the Approvals tab in LuxRoom AI to approve and send this message.',
  ].filter(l => l !== undefined).join('\n');
}

// ---------------------------------------------------------------------------
// Channels
// ---------------------------------------------------------------------------

export async function notifyTelegram(listing) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;

  const { verdict, location, corridor, rentTotal, estimatedCommute, url, opportunityScore } = listing;
  const corridorLabel = CORRIDOR_LABELS[corridor] ?? 'Other';
  const text = [
    `🏠 <b>LuxRoom AI — ${verdict}</b>`,
    `📍 ${location} · ${corridorLabel}`,
    `💶 ${rentTotal} · ⏱ ${estimatedCommute}`,
    `🔥 Opportunity: ${opportunityScore}/10`,
    `🔗 <a href="${url}">${url}</a>`,
  ].join('\n');

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) { console.error('[notifier] Telegram:', data.description); return false; }
    return true;
  } catch (err) {
    console.error('[notifier] Telegram failed:', err.message);
    return false;
  }
}

export async function notifyDesktop(listing) {
  const { verdict, location, rentTotal, opportunityScore } = listing;
  return new Promise(resolve => {
    try {
      notifier.notify(
        { title: `LuxRoom AI — ${verdict}`, message: `${location} · ${rentTotal} · Score ${opportunityScore}/10` },
        err => resolve(!err)
      );
    } catch { resolve(false); }
  });
}

export async function notifyEmail(listing, draft) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? '587', 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const to   = process.env.NOTIFICATION_EMAIL;

  if (!host || !user || !pass || !from || !to) {
    console.warn('[notifier] Email skipped — SMTP not configured.');
    return false;
  }

  const approvalPort = process.env.LUXROOM_APPROVAL_PORT
    ? Number(process.env.LUXROOM_APPROVAL_PORT)
    : null;

  const { verdict, location } = listing;

  try {
    const transport = nodemailer.createTransport({
      host, port,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });

    await transport.sendMail({
      from, to,
      subject: `LuxRoom AI — ${verdict} listing in ${location}`,
      text: buildEmailText(listing, draft),
      html: buildEmailHtml(listing, draft, approvalPort),
    });

    console.log('[notifier] Email sent.');
    return true;
  } catch (err) {
    console.error('[notifier] Email failed:', err.message);
    return false;
  }
}

export async function notifyAll(listing, draft) {
  const [telegram, desktop, email] = await Promise.all([
    notifyTelegram(listing),
    notifyDesktop(listing),
    notifyEmail(listing, draft),
  ]);
  console.log(`[notifier] Telegram:${telegram} Desktop:${desktop} Email:${email}`);
  return { telegram, desktop, email };
}
