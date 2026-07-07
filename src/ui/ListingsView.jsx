import { useState, useEffect, useCallback } from 'react';

const VERDICT_COLORS = {
  STRONG: '#4ade80',
  CONSIDER: '#facc15',
  SKIP: '#f87171',
};

const CORRIDOR_LABELS = {
  'north-line10': 'North Line 10 🚂',
  city: 'Luxembourg City 🏙',
  south: 'South 🏭',
  other: 'Other',
};

const DOMICILIATION_COLORS = {
  ok: '#4ade80',
  refused: '#f87171',
  unknown: '#6b7280',
};

function ScoreDots({ score }) {
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: i < score ? '#a855f7' : '#374151',
          }}
        />
      ))}
    </div>
  );
}

function VerdictBadge({ verdict }) {
  const color = VERDICT_COLORS[verdict] || '#6b7280';
  return (
    <span
      style={{
        backgroundColor: color + '22',
        color,
        border: `1px solid ${color}`,
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 1,
      }}
    >
      {verdict}
    </span>
  );
}

function CorridorBadge({ corridor }) {
  const label = CORRIDOR_LABELS[corridor] || corridor || 'Other';
  return (
    <span
      style={{
        backgroundColor: '#1e293b',
        color: '#94a3b8',
        border: '1px solid #334155',
        borderRadius: 4,
        padding: '2px 8px',
        fontSize: 11,
      }}
    >
      {label}
    </span>
  );
}

function DomiciliationChip({ status }) {
  const color = DOMICILIATION_COLORS[status] || DOMICILIATION_COLORS.unknown;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
  return (
    <span
      style={{
        backgroundColor: color + '22',
        color,
        border: `1px solid ${color}`,
        borderRadius: 12,
        padding: '2px 10px',
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      Domiciliation: {label}
    </span>
  );
}

function Toast({ message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#1e293b',
        border: '1px solid #4ade80',
        color: '#4ade80',
        padding: '12px 24px',
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 600,
        zIndex: 9999,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
      }}
    >
      {message}
    </div>
  );
}

function ListingCard({ listing, onDraftCreated }) {
  const [draftLoading, setDraftLoading] = useState(false);

  const {
    url,
    listingTitle,
    verdict,
    score,
    corridor,
    location,
    rent,
    commute,
    availability,
    domiciliation,
    pros = [],
    cons = [],
    dealbreakers = [],
    topReason,
    opportunityScore,
    urgency,
    source,
    analyzedAt,
    stale,
  } = listing;

  const title = listingTitle || url || 'Untitled';
  const truncatedTitle =
    title.length > 80 ? title.slice(0, 77) + '...' : title;

  const handleDraft = async () => {
    if (!url) return;
    setDraftLoading(true);
    try {
      await window.luxroom.approvals.generateDraft(url, 'introduction');
      onDraftCreated('Draft created — check Approvals tab');
    } catch (e) {
      onDraftCreated('Error creating draft');
    } finally {
      setDraftLoading(false);
    }
  };

  const formattedTime = analyzedAt
    ? new Date(analyzedAt).toLocaleString()
    : null;

  const openListing = () => {
    if (url) window.luxroom?.listings?.openUrl(url);
  };

  return (
    <div
      role="article"
      style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: 10,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.15s',
        cursor: url ? 'pointer' : 'default',
        opacity: stale ? 0.6 : 1,
      }}
      onClick={(e) => { if (!e.target.closest('button') && url) openListing(); }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#334155')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#1e293b')}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        {verdict && <VerdictBadge verdict={verdict} />}
        <ScoreDots score={score || 0} />
        {corridor && <CorridorBadge corridor={corridor} />}
        {stale && (
          <span style={{
            marginLeft: 'auto', backgroundColor: '#42200f', color: '#fb923c',
            border: '1px solid #7c2d12', borderRadius: 4, padding: '2px 8px',
            fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
          }} title="Not seen in recent scans — the listing may have been taken down">
            ⚠ MAY BE GONE
          </span>
        )}
      </div>

      {/* Title */}
      <div
        style={{
          color: '#f1f5f9',
          fontWeight: 600,
          fontSize: 14,
          lineHeight: 1.4,
          wordBreak: 'break-word',
        }}
        title={title}
      >
        {truncatedTitle}
      </div>

      {/* Info grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px 12px',
        }}
      >
        {[
          ['Location', location],
          ['Rent', rent],
          ['Commute', commute],
          ['Availability', availability],
        ].map(([label, value]) => (
          <div key={label}>
            <span style={{ color: '#64748b', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {label}
            </span>
            <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 1 }}>
              {value || '—'}
            </div>
          </div>
        ))}
      </div>

      {/* Domiciliation */}
      {domiciliation && (
        <div>
          <DomiciliationChip status={domiciliation} />
        </div>
      )}

      {/* Pros */}
      {pros.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {pros.slice(0, 2).map((p, i) => (
            <div key={i} style={{ color: '#4ade80', fontSize: 12, display: 'flex', gap: 6 }}>
              <span>✓</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cons */}
      {cons.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {cons.slice(0, 2).map((c, i) => (
            <div key={i} style={{ color: '#f87171', fontSize: 12, display: 'flex', gap: 6 }}>
              <span>✗</span>
              <span>{c}</span>
            </div>
          ))}
        </div>
      )}

      {/* Dealbreakers */}
      {dealbreakers.length > 0 && (
        <div
          style={{
            backgroundColor: '#f871711a',
            border: '1px solid #f87171',
            borderRadius: 6,
            padding: '8px 12px',
          }}
        >
          <div style={{ color: '#f87171', fontWeight: 700, fontSize: 11, marginBottom: 4 }}>
            DEALBREAKERS
          </div>
          {dealbreakers.map((d, i) => (
            <div key={i} style={{ color: '#fca5a5', fontSize: 12 }}>
              • {d}
            </div>
          ))}
        </div>
      )}

      {/* Top reason */}
      {topReason && (
        <div style={{ color: '#6b7280', fontSize: 12, fontStyle: 'italic' }}>
          {topReason}
        </div>
      )}

      {/* Opportunity score */}
      {opportunityScore != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: '#94a3b8', fontSize: 12, fontWeight: 600 }}>
            Opp: {Number(opportunityScore).toFixed(1)}/10
          </span>
          {urgency === 'HIGH' && (
            <span
              style={{
                backgroundColor: '#f97316',
                color: '#fff',
                borderRadius: 4,
                padding: '1px 7px',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1,
              }}
            >
              HIGH
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div
        style={{
          borderTop: '1px solid #1e293b',
          paddingTop: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          marginTop: 2,
        }}
      >
        {source && (
          <span
            style={{
              backgroundColor: '#1e293b',
              color: '#64748b',
              border: '1px solid #334155',
              borderRadius: 4,
              padding: '1px 7px',
              fontSize: 10,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {source}
          </span>
        )}
        {formattedTime && (
          <span style={{ color: '#475569', fontSize: 11 }}>{formattedTime}</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {url && (
            <button
              onClick={(e) => { e.stopPropagation(); openListing(); }}
              style={{
                background: 'none', border: 'none',
                color: '#818cf8', fontSize: 12, cursor: 'pointer', fontWeight: 500,
                padding: 0,
              }}
            >
              Open listing ↗
            </button>
          )}
          <button
            onClick={handleDraft}
            disabled={draftLoading || !url}
            style={{
              backgroundColor: draftLoading ? '#1e293b' : '#312e81',
              color: draftLoading ? '#475569' : '#a5b4fc',
              border: '1px solid #4338ca',
              borderRadius: 5,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
              cursor: draftLoading || !url ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            {draftLoading ? 'Drafting…' : 'Draft message'}
          </button>
        </div>
      </div>
    </div>
  );
}

const AI_LABEL = { groq: 'Groq', 'ollama-cloud': 'Ollama Cloud', gemini: 'Gemini', openai: 'OpenAI', anthropic: 'Claude', ollama: 'Local (CPU)', hermes: 'Hermes' };

// Export listings to a CSV that Excel/Sheets open directly (UTF-8 BOM, no deps).
function exportListingsToExcel(listings) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const header = ['Verdict', 'Score', 'Opportunity', 'Title', 'Location', 'Corridor', 'Rent', 'Commute', 'Availability', 'Domiciliation', 'Source', 'URL', 'Top reason', 'Pros', 'Cons'];
  const rows = listings.map(l => [
    l.verdict, l.score, l.opportunityScore, l.listingTitle, l.location, l.corridor,
    l.rentTotal, l.estimatedCommute, l.availability, (l.domiciliationFlag ?? l.domiciliation),
    l.source, l.url, l.topReason, (l.pros || []).join('; '), (l.cons || []).join('; '),
  ]);
  const csv = '﻿' + [header, ...rows].map(r => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `luxroom-listings-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function ListingsView({ status = {}, aiProvider, onConfigureAi }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [verdictFilter, setVerdictFilter] = useState('All');
  const [corridorFilter, setCorridorFilter] = useState('All');
  const [toast, setToast] = useState(null);

  const fetchListings = useCallback(async () => {
    try {
      const data = await window.luxroom.listings.getAll();
      setListings(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error('Failed to fetch listings:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchListings();
    const interval = setInterval(fetchListings, 30000);
    return () => clearInterval(interval);
  }, [fetchListings]);

  const filtered = listings.filter(l => {
    if (verdictFilter !== 'All' && l.verdict !== verdictFilter) return false;
    if (corridorFilter !== 'All') {
      const c = l.corridor || 'other';
      if (corridorFilter === 'other') {
        if (c !== 'other') return false;
      } else {
        if (c !== corridorFilter) return false;
      }
    }
    return true;
  });

  const strongCount = listings.filter(l => l.verdict === 'STRONG').length;
  const considerCount = listings.filter(l => l.verdict === 'CONSIDER').length;
  const scores = listings.map(l => l.score).filter(s => s != null);
  const avgScore =
    scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : '—';

  const verdicts = ['All', 'STRONG', 'CONSIDER', 'SKIP'];
  const corridors = ['All', 'north-line10', 'city', 'south', 'other'];

  const filterBtnStyle = (active) => ({
    backgroundColor: active ? '#1e293b' : 'transparent',
    color: active ? '#f1f5f9' : '#64748b',
    border: active ? '1px solid #334155' : '1px solid transparent',
    borderRadius: 6,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: active ? 700 : 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  return (
    <div
      style={{
        backgroundColor: '#020617',
        minHeight: '100vh',
        color: '#f1f5f9',
        fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif",
        padding: '24px 20px',
        boxSizing: 'border-box',
      }}
    >
      {/* AI configuration bar */}
      {aiProvider && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          marginBottom: 16, padding: '10px 14px', borderRadius: 10,
          background: '#0f172a', border: '1px solid #1e293b',
        }}>
          <span style={{ fontSize: 14 }}>🧠</span>
          <span style={{ fontSize: 13, color: '#94a3b8' }}>
            Analysing with <strong style={{ color: '#e2e8f0' }}>{AI_LABEL[aiProvider] || aiProvider}</strong>
            {aiProvider === 'ollama' && <span style={{ color: '#f0a868' }}> — local & slower. Add a cloud key for speed.</span>}
          </span>
          <button onClick={onConfigureAi} style={{
            marginLeft: 'auto', background: '#1e1633', border: '1px solid #7c5cbf',
            color: '#c4b5fd', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>⚙ Configure AI</button>
        </div>
      )}

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 20,
          marginBottom: 20,
          alignItems: 'center',
        }}
      >
        {/* Verdict filter */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginRight: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Verdict
          </span>
          {verdicts.map(v => (
            <button
              key={v}
              onClick={() => setVerdictFilter(v)}
              style={{
                ...filterBtnStyle(verdictFilter === v),
                ...(v !== 'All' && verdictFilter === v
                  ? { color: VERDICT_COLORS[v], borderColor: VERDICT_COLORS[v] + '66' }
                  : {}),
              }}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Corridor filter */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#475569', fontSize: 11, fontWeight: 600, marginRight: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Corridor
          </span>
          {corridors.map(c => (
            <button
              key={c}
              onClick={() => setCorridorFilter(c)}
              style={filterBtnStyle(corridorFilter === c)}
            >
              {c === 'All' ? 'All' : (CORRIDOR_LABELS[c] || c)}
            </button>
          ))}
        </div>

        {/* Export */}
        <button
          onClick={() => exportListingsToExcel(filtered)}
          disabled={filtered.length === 0}
          title="Download the current listings as a spreadsheet (opens in Excel)"
          style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6,
            background: '#132038', color: filtered.length ? '#a5b4fc' : '#475569',
            border: '1px solid #334155', borderRadius: 6, padding: '6px 12px',
            fontSize: 12, fontWeight: 600, cursor: filtered.length ? 'pointer' : 'not-allowed',
          }}
        >
          ⬇ Export to Excel
        </button>
      </div>

      {/* Live scan banner */}
      {status.running && listings.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
          background: '#1a0f2e', border: '1px solid #4c1d95', borderRadius: 8,
          padding: '8px 14px', fontSize: 13, color: '#a78bfa',
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#a78bfa', flexShrink: 0, animation: 'pulse 1.2s infinite' }} />
          Scanning housing sites — new listings will appear automatically when found.
        </div>
      )}

      {/* Stats row */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        {[
          { label: 'Total', value: listings.length },
          { label: 'STRONG', value: strongCount, color: '#4ade80' },
          { label: 'CONSIDER', value: considerCount, color: '#facc15' },
          { label: 'Avg Score', value: avgScore, color: '#a855f7' },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            style={{
              backgroundColor: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 8,
              padding: '10px 18px',
              minWidth: 90,
            }}
          >
            <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
              {label}
            </div>
            <div style={{ color: color || '#f1f5f9', fontSize: 22, fontWeight: 700 }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ color: '#475569', textAlign: 'center', marginTop: 60, fontSize: 14 }}>
          Loading listings…
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: 80 }}>
          {listings.length === 0 ? (
            status.running ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 16 }}>🔍</div>
                <div style={{ color: '#a78bfa', fontWeight: 600, fontSize: 15, marginBottom: 8 }}>
                  Scanning housing sites now…
                </div>
                <div style={{ color: '#475569', fontSize: 13 }}>
                  First scan takes a few minutes. Listings will appear here automatically.
                </div>
                <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 6 }}>
                  {[0,1,2].map(i => (
                    <div key={i} style={{
                      width: 8, height: 8, borderRadius: '50%', background: '#a78bfa',
                      opacity: 0.3, animation: `bounce 1.2s ${i * 0.2}s infinite`,
                    }} />
                  ))}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, marginBottom: 16 }}>🏠</div>
                <div style={{ color: '#475569', fontSize: 15, marginBottom: 8 }}>No listings yet.</div>
                <div style={{ color: '#334155', fontSize: 13 }}>Click <span style={{ color: '#f1f5f9' }}>Run Now</span> in the header to start your first scan.</div>
              </>
            )
          ) : (
            <div style={{ color: '#475569', fontSize: 15 }}>No listings match the current filters.</div>
          )}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((listing, idx) => (
            <ListingCard
              key={listing.url || listing.id || idx}
              listing={listing}
              onDraftCreated={setToast}
            />
          ))}
        </div>
      )}

      {/* Toast */}
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}
    </div>
  );
}
