'use client';

import { useState, useEffect } from 'react';
import { Gauge, RefreshCw, Activity, Clock, Zap, ArrowDown, ArrowUp, AlertCircle } from 'lucide-react';

interface RouterConfig { id: string; name: string; host: string; status: string; }
interface SpeedtestLog {
  id: string; routerId: string; routerName: string; timestamp: string;
  downloadMbps: number; uploadMbps: number; latencyMs: number; jitterMs: number;
  packetLossPercent: number; status: 'success' | 'failed'; error?: string;
}

export default function SpeedtestPage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [speedtests, setSpeedtests] = useState<SpeedtestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/routers').then(r => r.json()).then(d => {
      const online = d.filter((r: RouterConfig) => r.status === 'online');
      setRouters(online);
      if (online.length > 0) setSelectedRouterId(online[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedRouterId) return;
    setLoading(true); setError(null);
    fetch(`/api/routers/${selectedRouterId}/speedtest`).then(r => r.json()).then(d => {
      setSpeedtests(Array.isArray(d) ? d : []);
    }).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [selectedRouterId]);

  const handleRunSpeedtest = async () => {
    if (!selectedRouterId) return;
    setTesting(true); setError(null);
    try {
      const res = await fetch(`/api/routers/${selectedRouterId}/speedtest`, { method: 'POST' });
      if (res.ok) { const log = await res.json(); setSpeedtests(prev => [log, ...prev]); }
      else { const d = await res.json(); setError(d.error || 'Speedtest failed.'); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setTesting(false); }
  };

  const latest = speedtests.find(s => s.status === 'success');

  const renderChart = () => {
    const success = speedtests.filter(s => s.status === 'success').slice(0, 15).reverse();
    if (success.length < 2) return (
      <div className="empty-state" style={{ height: 200 }}>
        <Activity size={24} opacity={0.2} />
        <span>Run at least 2 speedtests to see the trend chart.</span>
      </div>
    );
    const W = 600, H = 180, P = 20;
    const cW = W - P * 2, cH = H - P * 2;
    const dlVals = success.map(t => t.downloadMbps);
    const ulVals = success.map(t => t.uploadMbps);
    const maxVal = Math.max(...dlVals, ...ulVals, 10);
    const n = success.length;
    const coords = (vals: number[]) => vals.map((v, i) => ({ x: P + (i / (n - 1)) * cW, y: P + cH - (v / maxVal) * cH }));
    const path = (pts: {x:number;y:number}[]) => pts.map((c,i) => `${i===0?'M':'L'} ${c.x} ${c.y}`).join(' ');
    const area = (pts: {x:number;y:number}[]) => `${path(pts)} L ${pts[pts.length-1].x} ${H-P} L ${pts[0].x} ${H-P} Z`;
    const dl = coords(dlVals), ul = coords(ulVals);
    return (
      <div>
        <div className="flex justify-between items-center mb-1" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <span>Max: {maxVal.toFixed(0)} Mbps</span>
          <div className="flex gap-2">
            <span style={{ color: 'var(--teal)', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:2, background:'var(--teal)', display:'inline-block', borderRadius:2 }}/><ArrowDown size={11}/> Download</span>
            <span style={{ color: 'var(--purple)', display:'flex', alignItems:'center', gap:4 }}><span style={{ width:10, height:2, background:'var(--purple)', display:'inline-block', borderRadius:2 }}/><ArrowUp size={11}/> Upload</span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', background:'rgba(0,0,0,0.15)', borderRadius:8 }}>
          <line x1={P} y1={P} x2={W-P} y2={P} stroke="rgba(255,255,255,0.03)" />
          <line x1={P} y1={P+cH/2} x2={W-P} y2={P+cH/2} stroke="rgba(255,255,255,0.03)" />
          <line x1={P} y1={H-P} x2={W-P} y2={H-P} stroke="rgba(255,255,255,0.07)" />
          <path d={area(dl)} fill="rgba(0,229,192,0.06)" />
          <path d={area(ul)} fill="rgba(139,92,246,0.06)" />
          <path d={path(dl)} fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d={path(ul)} fill="none" stroke="var(--purple)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {dl.map((c,i) => <circle key={i} cx={c.x} cy={c.y} r="2.5" fill="var(--teal)" />)}
          {ul.map((c,i) => <circle key={i} cx={c.x} cy={c.y} r="2.5" fill="var(--purple)" />)}
        </svg>
      </div>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">SLA Speedtest</h1>
          <p className="page-subtitle">Monitor ISP bandwidth, latency, and jitter over time</p>
        </div>
        <div className="flex gap-2 items-center">
          {routers.length > 0 && (
            <select className="form-select" style={{ width: 220 }} value={selectedRouterId} onChange={e => setSelectedRouterId(e.target.value)} disabled={testing || loading}>
              {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.host})</option>)}
            </select>
          )}
          <button className="btn btn-primary" onClick={handleRunSpeedtest} disabled={!selectedRouterId || testing}>
            <Gauge size={13} className={testing ? 'animate-spin' : ''} />
            {testing ? 'Testing…' : 'Run Speedtest'}
          </button>
          <a href="/api/export/speedtests" className="btn btn-secondary" download>Export CSV</a>
        </div>
      </div>

      {testing && (
        <div className="alert-banner info mb-2">
          <RefreshCw size={15} className="animate-spin" />
          <div><strong>Running speedtest on router…</strong><div style={{ marginTop: 2, opacity: 0.8 }}>MikroTik is measuring traffic (~6 seconds). Please wait.</div></div>
        </div>
      )}

      {loading ? (
        <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}><RefreshCw size={13} className="animate-spin" /> Loading…</div>
      ) : routers.length === 0 ? (
        <div className="glass-card empty-state"><Gauge size={32} opacity={0.2} /><p>No online routers available.</p></div>
      ) : (
        <>
          {error && <div className="alert-banner danger mb-2"><AlertCircle size={15} />{error}</div>}

          <div className="grid-stats">
            <div className="stat-card" style={{ '--accent-line': 'var(--teal)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--teal-dim)' }}><ArrowDown size={15} color="var(--teal)" /></div>
              <div className="stat-label">Download</div>
              <div className="stat-value" style={{ color: 'var(--teal)' }}>
                {latest ? latest.downloadMbps.toFixed(1) : '—'}
                <span style={{ fontSize: '0.9rem', color: 'var(--text-3)', fontWeight: 400 }}> Mbps</span>
              </div>
              <div className="stat-desc">Latest throughput</div>
            </div>
            <div className="stat-card" style={{ '--accent-line': 'var(--purple)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--purple-dim)' }}><ArrowUp size={15} color="var(--purple)" /></div>
              <div className="stat-label">Upload</div>
              <div className="stat-value" style={{ color: 'var(--purple)' }}>
                {latest ? latest.uploadMbps.toFixed(1) : '—'}
                <span style={{ fontSize: '0.9rem', color: 'var(--text-3)', fontWeight: 400 }}> Mbps</span>
              </div>
              <div className="stat-desc">Reverse throughput</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.04)' }}><Clock size={15} color="var(--text-3)" /></div>
              <div className="stat-label">Latency / Jitter</div>
              <div className="stat-value" style={{ fontSize: '1.1rem', color: 'var(--text-1)', marginTop: 6, marginBottom: 6 }}>
                {latest ? `${latest.latencyMs} ms` : '—'}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-3)', fontWeight: 400 }}> / {latest ? `${latest.jitterMs} ms` : '—'}</span>
              </div>
              <div className="stat-desc">Packet loss: {latest ? `${latest.packetLossPercent}%` : '—'}</div>
            </div>
          </div>

          <div className="grid-2-1" style={{ marginTop: '0.25rem' }}>
            <div className="glass-card glow-cyan">
              <div className="section-title">
                <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
                  <Activity size={12} color="var(--cyan)" />
                </div>
                SLA Performance Trend
              </div>
              {renderChart()}
            </div>
            <div className="glass-card glow-purple">
              <div className="section-title">
                <div className="section-icon" style={{ background: 'var(--purple-dim)' }}>
                  <Zap size={12} color="var(--purple)" />
                </div>
                Scheduler Info
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-2)', lineHeight: 1.6, marginBottom: '0.875rem' }}>
                MikroMeter can automatically audit your router speeds on a schedule. Configure the interval in Settings.
              </p>
              <div className="divider" />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-3)', lineHeight: 1.6 }}>
                💡 If speeds show simulated metrics, the router is using v6 ping fallback — safe and non-intrusive.
              </p>
            </div>
          </div>

          <div className="glass-card mt-2">
            <div className="section-title">              <div className="section-icon" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <Activity size={12} color="var(--text-2)" />
                </div>
                History Log
            </div>
            {speedtests.length === 0 ? (
              <div className="empty-state"><p>No tests yet. Run a speedtest above.</p></div>
            ) : (
              <div className="table-container">
                <table className="glass-table">
                  <thead>
                    <tr><th>Timestamp</th><th>Router</th><th>Download</th><th>Upload</th><th>Latency</th><th>Jitter</th><th>Loss</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {speedtests.map(s => (
                      <tr key={s.id}>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{new Date(s.timestamp).toLocaleString()}</td>
                        <td style={{ color: 'var(--text-2)' }}>{s.routerName}</td>
                        <td className="mono" style={{ fontWeight: 700, color: 'var(--teal)' }}>{s.downloadMbps > 0 ? `${s.downloadMbps.toFixed(1)} Mbps` : '—'}</td>
                        <td className="mono" style={{ fontWeight: 700, color: 'var(--purple)' }}>{s.uploadMbps > 0 ? `${s.uploadMbps.toFixed(1)} Mbps` : '—'}</td>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>{s.status === 'success' ? `${s.latencyMs} ms` : '—'}</td>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>{s.status === 'success' ? `${s.jitterMs} ms` : '—'}</td>
                        <td className="mono" style={{ fontSize: '0.8rem', color: s.packetLossPercent > 0 ? 'var(--offline)' : 'var(--text-3)' }}>{s.status === 'success' ? `${s.packetLossPercent}%` : '—'}</td>
                        <td>
                          <span className={`badge badge-${s.status === 'success' ? 'online' : 'offline'}`} style={{ fontSize: '0.65rem' }}>
                            {s.status === 'success' ? 'OK' : 'Failed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
