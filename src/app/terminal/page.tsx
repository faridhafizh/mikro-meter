'use client';

import { useState, useEffect, useRef } from 'react';
import { Terminal, RefreshCw, Zap, Trash2, ArrowRightCircle } from 'lucide-react';

interface RouterConfig { id: string; name: string; host: string; status: string; }
interface TerminalLine { type: 'input' | 'output' | 'error'; text: string; }

const PRESETS = [
  { label: 'System Resources', cmd: '/system resource print' },
  { label: 'Active Leases', cmd: '/ip dhcp-server lease print' },
  { label: 'Active PPPoE', cmd: '/ppp active print' },
  { label: 'Ping Google', cmd: '/ping count=3 address=8.8.8.8' },
  { label: 'IP Addresses', cmd: '/ip address print' },
  { label: 'Interfaces', cmd: '/interface print' },
  { label: 'Hotspot Users', cmd: '/ip hotspot user print' },
  { label: 'Router Log', cmd: '/log print' },
];

export default function TerminalConsolePage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [history, setHistory] = useState<TerminalLine[]>([
    { type: 'output', text: '─── MikroMeter Secure CLI Console ───' },
    { type: 'output', text: 'Type any RouterOS command below (e.g. /system resource print)' },
  ]);
  const [commandInput, setCommandInput] = useState('');
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch('/api/routers').then(r => r.json()).then(d => {
      const online = d.filter((r: RouterConfig) => r.status === 'online');
      setRouters(online);
      if (online.length > 0) setSelectedRouterId(online[0].id);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => { consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

  const handleExecute = async (cmd: string) => {
    const clean = cmd.trim();
    if (!clean || !selectedRouterId || executing) return;
    setHistory(prev => [...prev, { type: 'input', text: clean }]);
    setCommandInput('');
    setExecuting(true);
    try {
      const res = await fetch(`/api/routers/${selectedRouterId}/terminal`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ command: clean }) });
      if (res.ok) { const d = await res.json(); setHistory(prev => [...prev, { type: 'output', text: d.output }]); }
      else { const d = await res.json(); setHistory(prev => [...prev, { type: 'error', text: `Error: ${d.error || 'Server error.'}` }]); }
    } catch (e) { setHistory(prev => [...prev, { type: 'error', text: `Network error: ${e instanceof Error ? e.message : String(e)}` }]); }
    finally { setExecuting(false); setTimeout(() => inputRef.current?.focus(), 50); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Console Shell</h1>
          <p className="page-subtitle">Secure SSH terminal for RouterOS commands</p>
        </div>
        <div className="flex gap-2 items-center">
          {routers.length > 0 && (
            <select className="form-select" style={{ width: 220 }} value={selectedRouterId} onChange={e => setSelectedRouterId(e.target.value)} disabled={executing}>
              {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.host})</option>)}
            </select>
          )}
          <button className="btn btn-secondary" onClick={() => setHistory([{ type: 'output', text: '─── Console Cleared ───' }])}>
            <Trash2 size={13} /> Clear
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}><RefreshCw size={13} className="animate-spin" /> Connecting…</div>
      ) : routers.length === 0 ? (
        <div className="glass-card empty-state"><Terminal size={32} opacity={0.2} /><p>No online routers available.</p></div>
      ) : (
        <div className="grid-sidebar-sm">
          {/* Terminal */}
          <div
            onClick={() => inputRef.current?.focus()}
            style={{
              background: '#040610',
              border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: 10,
              height: 520,
              padding: '1rem',
              boxShadow: '0 0 24px rgba(0,212,255,0.08), inset 0 0 30px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              cursor: 'text',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Scanline overlay */}
            <div style={{
              position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
              background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
              opacity: 0.6,
            }} />

            {/* Output */}
            <div style={{ flex: 1, overflowY: 'auto', fontFamily: "'JetBrains Mono', 'Fira Code', monospace", fontSize: '0.8125rem', lineHeight: 1.5, whiteSpace: 'pre-wrap', zIndex: 1 }}>
              {history.map((line, i) => {
                if (line.type === 'input') return (
                  <div key={i} style={{ color: '#fff', marginBottom: '0.375rem' }}>
                    <span style={{ color: 'var(--purple)', fontWeight: 700 }}>[admin@MikroTik] &gt;</span> {line.text}
                  </div>
                );
                if (line.type === 'error') return (
                  <div key={i} style={{ color: 'var(--offline)', marginBottom: '0.375rem', textShadow: '0 0 6px rgba(244,63,94,0.4)' }}>{line.text}</div>
                );
                return <div key={i} style={{ color: 'var(--cyan)', marginBottom: '0.375rem', textShadow: '0 0 4px rgba(0,212,255,0.3)' }}>{line.text}</div>;
              })}
              {executing && (
                <div style={{ color: 'var(--teal)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <RefreshCw size={12} className="animate-spin" /> Awaiting response…
                </div>
              )}
              <div ref={consoleEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={e => { e.preventDefault(); handleExecute(commandInput); }}
              style={{ borderTop: '1px solid rgba(0,212,255,0.15)', paddingTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem', zIndex: 1 }}>
              <span style={{ color: 'var(--purple)', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0 }}>
                [admin@MikroTik] &gt;
              </span>
              <input
                ref={inputRef}
                type="text"
                value={commandInput}
                onChange={e => setCommandInput(e.target.value)}
                disabled={executing}
                autoFocus
                autoComplete="off"
                placeholder="Enter command…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.8125rem', caretColor: 'var(--cyan)' }}
              />
              <button type="submit" disabled={executing || !commandInput.trim()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: commandInput.trim() ? 'var(--cyan)' : 'var(--text-3)', padding: 0 }}>
                <ArrowRightCircle size={18} />
              </button>
            </form>
          </div>

          {/* Presets */}
          <div className="glass-card glow-purple" style={{ minHeight: 520, display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
            <div className="section-title">
              <div className="section-icon" style={{ background: 'var(--purple-dim)' }}>
                <Zap size={12} color="var(--purple)" />
              </div>
              Quick Commands
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.5 }}>Click to send instantly:</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', flex: 1, overflowY: 'auto' }}>
              {PRESETS.map(p => (
                <button key={p.label} className="btn btn-secondary" onClick={() => handleExecute(p.cmd)} disabled={executing}
                  style={{ textAlign: 'left', padding: '0.5rem 0.625rem', minHeight: 'auto', background: 'rgba(255,255,255,0.02)', borderColor: 'rgba(255,255,255,0.06)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.75rem', color: 'var(--text-1)', marginBottom: 2 }}>{p.label}</div>
                  <div className="mono" style={{ fontSize: '0.65rem', color: 'var(--cyan)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.cmd}</div>
                </button>
              ))}
            </div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', borderTop: '1px solid var(--border)', paddingTop: '0.625rem' }}>
              ⚠ Wait for each command to complete before sending another.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
