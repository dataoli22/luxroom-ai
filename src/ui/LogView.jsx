import { useEffect, useRef, useState, useCallback } from 'react';

const MAX_LINES = 500;

function getLineColor(line) {
  if (/error|Error|FAIL/.test(line)) return '#f87171';
  if (/High opportunity|STRONG/.test(line)) return '#4ade80';
  if (/warning|Warning/.test(line)) return '#facc15';
  return '#ccc';
}

function formatTimestamp(date) {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function LogView() {
  const [logLines, setLogLines] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef(null);
  const autoScrollRef = useRef(true);

  useEffect(() => {
    autoScrollRef.current = autoScroll;
  }, [autoScroll]);

  useEffect(() => {
    if (!window.luxroom || typeof window.luxroom.onLine !== 'function') return;

    const unsubscribe = window.luxroom.onLine((line) => {
      setLogLines((prev) => {
        const next = [...prev, { text: line, time: new Date() }];
        return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next;
      });
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
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
    if (!atBottom && autoScrollRef.current) {
      setAutoScroll(false);
    } else if (atBottom && !autoScrollRef.current) {
      setAutoScroll(true);
    }
  }, []);

  const handleClear = () => setLogLines([]);

  const toggleAutoScroll = () => {
    setAutoScroll((prev) => {
      const next = !prev;
      if (next && scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
      return next;
    });
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#0a0a0e',
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#ccc',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          padding: '6px 12px',
          borderBottom: '1px solid #1e1e2e',
          background: '#0d0d14',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            marginRight: 'auto',
            color: '#555',
            fontSize: '12px',
          }}
        >
          {logLines.length} lines
        </span>

        <button
          onClick={toggleAutoScroll}
          style={{
            padding: '3px 10px',
            fontSize: '12px',
            background: autoScroll ? '#1e3a2e' : '#1e1e2e',
            color: autoScroll ? '#4ade80' : '#888',
            border: `1px solid ${autoScroll ? '#4ade80' : '#333'}`,
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Auto-scroll {autoScroll ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={handleClear}
          style={{
            padding: '3px 10px',
            fontSize: '12px',
            background: '#1e1e2e',
            color: '#aaa',
            border: '1px solid #333',
            borderRadius: '4px',
            cursor: 'pointer',
          }}
        >
          Clear
        </button>
      </div>

      {/* Log area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
        }}
      >
        {logLines.length === 0 ? (
          <div
            style={{
              color: '#444',
              marginTop: '24px',
              textAlign: 'center',
            }}
          >
            Pipeline not started. Click Run Now in the header.
          </div>
        ) : (
          logLines.map((entry, i) => (
            <div
              key={i}
              style={{
                color: getLineColor(entry.text),
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              <span style={{ color: '#555', userSelect: 'none', marginRight: '8px' }}>
                {formatTimestamp(entry.time)}
              </span>
              {entry.text}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
