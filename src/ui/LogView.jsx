import { useEffect, useRef, useState, useCallback } from 'react';

const MAX_LINES = 500;

function getLineColor(line) {
  if (/error|Error|FAIL/.test(line)) return '#f87171';
  if (/High opportunity|STRONG/.test(line)) return '#4ade80';
  if (/warning|Warning/.test(line)) return '#facc15';
  if (/\[pipeline\]/.test(line)) return '#a78bfa';
  return '#ccc';
}

function formatTimestamp(date) {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatDuration(ms) {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function LogView({ status = {} }) {
  const [logLines, setLogLines] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef(null);
  const autoScrollRef = useRef(true);
  const now = useNow(1000);

  useEffect(() => { autoScrollRef.current = autoScroll; }, [autoScroll]);

  useEffect(() => {
    if (!window.luxroom || typeof window.luxroom.onLine !== 'function') return;
    const unsubscribe = window.luxroom.onLine((line) => {
      setLogLines((prev) => {
        const next = [...prev, { text: line, time: new Date() }];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    });
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !autoScrollRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [logLines]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
    if (!atBottom && autoScrollRef.current) setAutoScroll(false);
    else if (atBottom && !autoScrollRef.current) setAutoScroll(true);
  }, []);

  const handleClear = () => setLogLines([]);
  const toggleAutoScroll = () => {
    setAutoScroll((prev) => {
      const next = !prev;
      if (next && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      return next;
    });
  };

  // Next scan countdown — pipeline runs every 3 hours
  const INTERVAL_MS = 3 * 60 * 60 * 1000;
  const lastCrawlMs = status.lastCrawl ? new Date(status.lastCrawl).getTime() : null;
  const nextScanMs  = lastCrawlMs ? lastCrawlMs + INTERVAL_MS : null;
  const timeToNext  = nextScanMs ? nextScanMs - now : null;

  const EmptyState = () => {
    if (status.running) {
      return (
        <div style={{ textAlign: 'center', marginTop: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>⚙️</div>
          <div style={{ color: '#a78bfa', fontWeight: 600, marginBottom: 6 }}>Scan in progress…</div>
          <div style={{ fontSize: 12, color: '#444' }}>Log lines will appear here as sites are crawled.</div>
        </div>
      );
    }
    if (lastCrawlMs) {
      return (
        <div style={{ textAlign: 'center', marginTop: 40, color: '#555' }}>
          <div style={{ fontSize: 28, marginBottom: 12 }}>🕐</div>
          <div style={{ color: '#888', marginBottom: 4 }}>
            Last scan: <span style={{ color: '#ccc' }}>{new Date(lastCrawlMs).toLocaleTimeString()}</span>
          </div>
          {timeToNext > 0 && (
            <div style={{ color: '#555', fontSize: 12 }}>
              Next scan in <span style={{ color: '#a78bfa' }}>{formatDuration(timeToNext)}</span>
            </div>
          )}
          <div style={{ marginTop: 16, fontSize: 12, color: '#444' }}>
            Click <span style={{ color: '#ccc' }}>Run Now</span> to scan immediately.
          </div>
        </div>
      );
    }
    return (
      <div style={{ textAlign: 'center', marginTop: 40, color: '#444' }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>💤</div>
        <div style={{ marginBottom: 6 }}>No scans run yet.</div>
        <div style={{ fontSize: 12 }}>Click <span style={{ color: '#ccc' }}>Run Now</span> in the header to start.</div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0e', fontFamily: 'monospace', fontSize: '13px', color: '#ccc' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '6px 12px', borderBottom: '1px solid #1e1e2e', background: '#0d0d14', flexShrink: 0 }}>
        <span style={{ marginRight: 'auto', color: '#555', fontSize: '12px' }}>{logLines.length} lines</span>

        {/* Live status pill */}
        {status.running && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#a78bfa', marginRight: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#a78bfa', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />
            Scanning now
          </span>
        )}
        {!status.running && timeToNext > 0 && (
          <span style={{ fontSize: 12, color: '#555', marginRight: 8 }}>
            Next scan in <span style={{ color: '#a78bfa' }}>{formatDuration(timeToNext)}</span>
          </span>
        )}

        <button onClick={toggleAutoScroll} style={{ padding: '3px 10px', fontSize: '12px', background: autoScroll ? '#1e3a2e' : '#1e1e2e', color: autoScroll ? '#4ade80' : '#888', border: `1px solid ${autoScroll ? '#4ade80' : '#333'}`, borderRadius: '4px', cursor: 'pointer' }}>
          Auto-scroll {autoScroll ? 'ON' : 'OFF'}
        </button>
        <button onClick={handleClear} style={{ padding: '3px 10px', fontSize: '12px', background: '#1e1e2e', color: '#aaa', border: '1px solid #333', borderRadius: '4px', cursor: 'pointer' }}>
          Clear
        </button>
      </div>

      {/* Log area */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
        {logLines.length === 0 ? <EmptyState /> : logLines.map((entry, i) => (
          <div key={i} style={{ color: getLineColor(entry.text), lineHeight: '1.6', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            <span style={{ color: '#555', userSelect: 'none', marginRight: '8px' }}>{formatTimestamp(entry.time)}</span>
            {entry.text}
          </div>
        ))}
      </div>
    </div>
  );
}
