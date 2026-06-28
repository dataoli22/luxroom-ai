import { useState, useEffect, useCallback } from 'react';

const PALETTE = {
  bg: '#0f1117',
  surface: '#1a1d27',
  surfaceAlt: '#22263a',
  border: '#2e3250',
  text: '#e2e8f0',
  textMuted: '#8892b0',
  green: '#22c55e',
  greenDim: '#166534',
  red: '#ef4444',
  redDim: '#7f1d1d',
  grey: '#475569',
  greyDim: '#1e293b',
  accent: '#818cf8',
  gold: '#f59e0b',
};

const LANG_FLAGS = {
  EN: '🇬🇧',
  FR: '🇫🇷',
  DE: '🇩🇪',
  LB: '🇱🇺',
};

function VerdictBadge({ verdict }) {
  const color =
    verdict === 'APPLY' ? PALETTE.green :
    verdict === 'SKIP' ? PALETTE.red :
    PALETTE.gold;
  return (
    <span style={{
      background: color + '22',
      color: color,
      border: `1px solid ${color}55`,
      borderRadius: 6,
      padding: '2px 10px',
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: 1,
      textTransform: 'uppercase',
    }}>
      {verdict}
    </span>
  );
}

function Toast({ toasts }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 28,
      right: 28,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      pointerEvents: 'none',
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: t.type === 'success' ? PALETTE.greenDim : PALETTE.redDim,
          color: t.type === 'success' ? PALETTE.green : PALETTE.red,
          border: `1px solid ${t.type === 'success' ? PALETTE.green : PALETTE.red}55`,
          borderRadius: 10,
          padding: '12px 20px',
          fontSize: 14,
          fontWeight: 600,
          boxShadow: '0 4px 24px #0008',
          minWidth: 220,
          maxWidth: 340,
          pointerEvents: 'auto',
        }}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

function LiveIndicator() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: PALETTE.green,
        boxShadow: `0 0 6px ${PALETTE.green}`,
        display: 'inline-block',
        animation: 'pulse 2s infinite',
      }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
      <span style={{ color: PALETTE.textMuted, fontSize: 13 }}>Live</span>
    </span>
  );
}

function PendingCard({ item, onApprove, onDiscard, onGenerateNew }) {
  const { listing, draft } = item;
  const langCode = draft.language ? draft.language.toUpperCase() : 'EN';
  const flag = LANG_FLAGS[langCode] || '🌐';

  const generatedAt = draft.generatedAt
    ? new Date(draft.generatedAt).toLocaleString()
    : null;

  return (
    <div style={{
      background: PALETTE.surface,
      border: `1px solid ${PALETTE.border}`,
      borderRadius: 14,
      marginBottom: 22,
      overflow: 'hidden',
      boxShadow: '0 2px 16px #0005',
    }}>
      {/* Listing summary */}
      <div style={{
        padding: '18px 22px 14px',
        borderBottom: `1px solid ${PALETTE.border}`,
        background: PALETTE.surfaceAlt,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {listing.verdict && <VerdictBadge verdict={listing.verdict} />}
          {listing.opportunityScore != null && (
            <span style={{ color: PALETTE.gold, fontWeight: 700, fontSize: 15 }}>
              {listing.opportunityScore}
              <span style={{ color: PALETTE.textMuted, fontWeight: 400, fontSize: 12 }}> / 10</span>
            </span>
          )}
          {listing.location && (
            <span style={{ color: PALETTE.textMuted, fontSize: 14 }}>
              📍 {listing.location}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', marginBottom: 10 }}>
          {listing.rentTotal && (
            <span style={{ color: PALETTE.text, fontSize: 14 }}>
              <span style={{ color: PALETTE.textMuted }}>Rent </span>
              <strong>{listing.rentTotal}</strong>
            </span>
          )}
          {listing.estimatedCommute && listing.estimatedCommute !== 'unknown' && (
            <span style={{ color: PALETTE.text, fontSize: 14 }}>
              <span style={{ color: PALETTE.textMuted }}>Commute </span>
              <strong>{listing.estimatedCommute}</strong>
            </span>
          )}
        </div>

        {listing.url && (
          <a
            href={listing.url}
            target="_blank"
            rel="noreferrer"
            style={{ color: PALETTE.accent, fontSize: 13, wordBreak: 'break-all', textDecoration: 'none' }}
            onMouseOver={e => e.currentTarget.style.textDecoration = 'underline'}
            onMouseOut={e => e.currentTarget.style.textDecoration = 'none'}
          >
            {listing.url}
          </a>
        )}
      </div>

      {/* Draft section */}
      <div style={{ padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
          <span style={{ color: PALETTE.text, fontWeight: 600, fontSize: 14 }}>
            Draft message
            {(draft.type || draft.language) && (
              <span style={{ color: PALETTE.textMuted, fontWeight: 400 }}>
                {' '}({[draft.type, draft.language].filter(Boolean).join(' · ')})
              </span>
            )}
          </span>
          <span style={{
            background: PALETTE.greyDim,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 6,
            padding: '2px 9px',
            fontSize: 13,
            color: PALETTE.text,
          }}>
            {flag} {langCode}
          </span>
        </div>

        <textarea
          readOnly
          value={draft.body || draft.message || draft.text || ''}
          style={{
            width: '100%',
            minHeight: 120,
            background: '#0d1020',
            color: PALETTE.text,
            border: `1px solid ${PALETTE.border}`,
            borderRadius: 8,
            padding: '12px 14px',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
            lineHeight: 1.6,
          }}
        />

        {generatedAt && (
          <div style={{ color: PALETTE.textMuted, fontSize: 12, marginTop: 6 }}>
            Generated at {generatedAt}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
          <button
            onClick={() => onApprove(listing.url, draft.id)}
            style={{
              background: PALETTE.greenDim,
              color: PALETTE.green,
              border: `1px solid ${PALETTE.green}55`,
              borderRadius: 8,
              padding: '9px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            ✓ Approve &amp; Send
          </button>
          <button
            onClick={() => onDiscard(listing.url, draft.id)}
            style={{
              background: PALETTE.redDim,
              color: PALETTE.red,
              border: `1px solid ${PALETTE.red}55`,
              borderRadius: 8,
              padding: '9px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            ✗ Discard
          </button>
          <button
            onClick={() => onGenerateNew(listing.url)}
            style={{
              background: PALETTE.greyDim,
              color: PALETTE.textMuted,
              border: `1px solid ${PALETTE.grey}55`,
              borderRadius: 8,
              padding: '9px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'opacity 0.15s',
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.8'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            ↺ Generate New Draft
          </button>
        </div>
      </div>
    </div>
  );
}

function AwayModeToggle() {
  const [mode, setMode] = useState('manual');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.luxroom?.settings.get().then(s => {
      if (s?.APPROVAL_MODE) setMode(s.APPROVAL_MODE);
    }).catch(() => {});
  }, []);

  async function toggle() {
    const next = mode === 'auto' ? 'manual' : 'auto';
    setSaving(true);
    try {
      await window.luxroom?.settings.save({ APPROVAL_MODE: next });
      setMode(next);
    } catch (err) {
      console.error('[AwayMode] save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  const isAuto = mode === 'auto';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      flexWrap: 'wrap', gap: 12,
      background: isAuto ? '#0f1e0f' : '#1a1d27',
      border: `1px solid ${isAuto ? '#16622a' : '#2e3250'}`,
      borderRadius: 12, padding: '14px 18px',
      marginBottom: 22,
      transition: 'all 0.2s',
    }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 16 }}>{isAuto ? '⚡' : '✋'}</span>
          <span style={{ color: isAuto ? '#4ade80' : '#8892b0', fontWeight: 700, fontSize: 14 }}>
            {isAuto ? 'Away Mode is ON' : 'Manual Review Mode'}
          </span>
          {isAuto && (
            <span style={{
              background: '#16622a', color: '#4ade80',
              border: '1px solid #22c55e44', borderRadius: 20,
              padding: '1px 8px', fontSize: 10, fontWeight: 700,
            }}>ACTIVE</span>
          )}
        </div>
        <div style={{ color: '#475569', fontSize: 12, lineHeight: 1.5, maxWidth: 420 }}>
          {isAuto
            ? 'Listings scoring 9–10 / 10 will be sent automatically. You\'ll still receive notifications after each send.'
            : 'Every message waits here for your approval before being sent. Toggle Away Mode when you\'re offline or busy.'}
        </div>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        style={{
          background: isAuto ? '#7f1d1d' : '#1e3a5f',
          color: isAuto ? '#f87171' : '#93c5fd',
          border: `1px solid ${isAuto ? '#f8717144' : '#93c5fd44'}`,
          borderRadius: 8, padding: '8px 18px',
          fontSize: 13, fontWeight: 600,
          cursor: saving ? 'default' : 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
          opacity: saving ? 0.6 : 1,
        }}
      >
        {saving ? '...' : isAuto ? 'Turn Off Away Mode' : 'Turn On Away Mode'}
      </button>
    </div>
  );
}

export default function ApprovalsView() {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const items = await window.luxroom?.approvals.getPending();
      setPending(Array.isArray(items) ? items : []);
    } catch (err) {
      console.error('[ApprovalsView] getPending failed:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();

    // Real-time push from main process (new draft, approve, discard)
    const unsub = window.luxroom?.approvals.onChange(() => fetchPending());

    // 60s polling as a safety net
    const interval = setInterval(fetchPending, 60_000);

    return () => {
      unsub?.();
      clearInterval(interval);
    };
  }, [fetchPending]);

  const handleApprove = useCallback(async (listingUrl, draftId) => {
    try {
      await window.luxroom?.approvals.approve(listingUrl, draftId);
      setPending(prev => prev.filter(
        item => !(item.listing.url === listingUrl && item.draft.id === draftId)
      ));
      addToast('Message approved and sent.', 'success');
    } catch (err) {
      console.error('[ApprovalsView] approve failed:', err);
      addToast('Failed to approve message.', 'error');
    }
  }, [addToast]);

  const handleDiscard = useCallback(async (listingUrl, draftId) => {
    try {
      await window.luxroom?.approvals.discard(listingUrl, draftId);
      setPending(prev => prev.filter(
        item => !(item.listing.url === listingUrl && item.draft.id === draftId)
      ));
      addToast('Draft discarded.', 'success');
    } catch (err) {
      console.error('[ApprovalsView] discard failed:', err);
      addToast('Failed to discard draft.', 'error');
    }
  }, [addToast]);

  const handleGenerateNew = useCallback(async (listingUrl) => {
    try {
      await window.luxroom?.approvals.generateDraft(listingUrl, 'introduction');
      await fetchPending();
      addToast('New draft generated.', 'success');
    } catch (err) {
      console.error('[ApprovalsView] generateDraft failed:', err);
      addToast('Failed to generate new draft.', 'error');
    }
  }, [fetchPending, addToast]);

  return (
    <div style={{
      background: PALETTE.bg,
      minHeight: '100vh',
      padding: '32px 28px',
      fontFamily: "'Inter', 'Segoe UI', sans-serif",
      color: PALETTE.text,
    }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 6 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: PALETTE.text, margin: 0 }}>
            Pending Approvals
          </h2>
          <LiveIndicator />
        </div>
        <p style={{ color: PALETTE.textMuted, fontSize: 14, marginBottom: 20, marginTop: 4 }}>
          Review AI-drafted messages before they're sent. Updates instantly when the pipeline finds new listings.
          You can also approve directly from the email notification.
        </p>

        <AwayModeToggle />

        {loading ? (
          <div style={{ color: PALETTE.textMuted, fontSize: 15, textAlign: 'center', paddingTop: 60 }}>
            Loading...
          </div>
        ) : pending.length === 0 ? (
          <div style={{
            background: PALETTE.surface,
            border: `1px dashed ${PALETTE.border}`,
            borderRadius: 14,
            padding: '52px 32px',
            textAlign: 'center',
            color: PALETTE.textMuted,
            fontSize: 15,
          }}>
            No pending messages. High-opportunity listings will appear here automatically.
          </div>
        ) : (
          pending.map((item, i) => (
            <PendingCard
              key={`${item.listing?.url}-${item.draft?.id}-${i}`}
              item={item}
              onApprove={handleApprove}
              onDiscard={handleDiscard}
              onGenerateNew={handleGenerateNew}
            />
          ))
        )}
      </div>

      <Toast toasts={toasts} />
    </div>
  );
}
