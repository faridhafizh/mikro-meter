'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Server, Users, ShieldAlert, ShieldCheck, Activity,
  Cpu, HardDrive, RefreshCw, AlertTriangle, MapPin,
  ChevronDown, ChevronRight, ArrowDown, ArrowUp, Wifi,
} from 'lucide-react';

const DashboardMap = dynamic(() => import('@/components/DashboardMap'), { ssr: false });

interface RouterConfig {
  id: string; name: string; host: string; port: number;
  status: 'online' | 'offline'; lastChecked?: string;
  monitoredInterfaces?: string[]; latitude?: number; longitude?: number;
}

interface StatsPoint {
  timestamp: string; cpu: number; memoryUsed: number; memoryTotal: number;
  rxBps: Record<string, number>; txBps: Record<string, number>; activePppoe: number;
}

export default function Dashboard() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [statsHistory, setStatsHistory] = useState<StatsPoint[]>([]);
  const [polling, setPolling] = useState(false);
  const [monitoredInterface, setMonitoredInterface] = useState('');
  const [mapExpanded, setMapExpanded] = useState(false);
  const [timeRange, setTimeRange] = useState<string>('default'); // 'default', '1h', '6h', '24h', '7d'

  const fetchDashboardData = async (routerIdToPoll?: string, range?: string) => {
    try {
      const routersRes = await fetch('/api/routers');
      const routersData = await routersRes.json();
      setRouters(routersData);
      const activeId = routerIdToPoll || selectedRouterId || (routersData.length > 0 ? routersData[0].id : '');
      if (activeId) {
        setSelectedRouterId(activeId);
        setPolling(true);
        const rangeParam = range || timeRange;
        const rangeQuery = rangeParam && rangeParam !== 'default' ? `?range=${rangeParam}` : '';
        const statsRes = await fetch(`/api/routers/${activeId}/stats${rangeQuery}`);
        const statsData = await statsRes.json();
        setStatsHistory(statsData.history || []);
        const router = routersData.find((r: RouterConfig) => r.id === activeId);
        if (router?.monitoredInterfaces?.length) {
          setMonitoredInterface(router.monitoredInterfaces[0]);
        } else if (statsData.history?.length > 0) {
          const firstIface = Object.keys(statsData.history[statsData.history.length - 1].rxBps)[0];
          setMonitoredInterface(firstIface || '');
        }
      }
    } catch (err) { console.error(err); }
    finally { setPolling(false); }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(() => fetchDashboardData(), 10000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRouterId, timeRange]);

  const selectedRouter = routers.find(r => r.id === selectedRouterId);
  const latestStats = statsHistory.length > 0 ? statsHistory[statsHistory.length - 1] : null;
  const onlineCount = routers.filter(r => r.status === 'online').length;
  const totalRouters = routers.length;
  const totalPppoe = latestStats?.activePppoe ?? 0;

  const fmtMbps = (bps: number) => `${(bps / 1_000_000).toFixed(2)}`;
  const fmtMB = (b: number) => `${(b / (1024 * 1024)).toFixed(0)} MB`;

  const renderChart = () => {
    if (statsHistory.length < 2 || !monitoredInterface) {
      return (
        <div className="empty-state" style={{ height: 180 }}>
          <Activity size={24} opacity={0.3} />
          <span>Waiting for traffic data…</span>
        </div>
      );
    }
    const W = 600, H = 160, P = 18;
    const cW = W - P * 2, cH = H - P * 2;
    const rxVals = statsHistory.map(p => p.rxBps[monitoredInterface] || 0);
    const txVals = statsHistory.map(p => p.txBps[monitoredInterface] || 0);
    const maxVal = Math.max(...rxVals, ...txVals, 1_000_000);
    const n = statsHistory.length;
    const coords = (vals: number[]) => vals.map((v, i) => ({
      x: P + (i / (n - 1)) * cW,
      y: P + cH - (v / maxVal) * cH,
    }));
    const path = (pts: {x:number;y:number}[]) => pts.map((c,i) => `${i===0?'M':'L'} ${c.x} ${c.y}`).join(' ');
    const area = (pts: {x:number;y:number}[]) => `${path(pts)} L ${pts[pts.length-1].x} ${H-P} L ${pts[0].x} ${H-P} Z`;
    const rx = coords(rxVals), tx = coords(txVals);
    return (
      <div>
        <div className="flex justify-between items-center mb-1" style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--online)', boxShadow: '0 0 6px var(--online-glow)' }} />
            Live · Max: <span className="mono" style={{ color: 'var(--text-1)', fontWeight: 700 }}>{fmtMbps(maxVal)}</span> Mbps
          </span>
          <div className="flex gap-3">
            <span style={{ color: 'var(--cyan)', display:'flex', alignItems:'center', gap:4, fontSize: '0.7rem', fontWeight: 600 }}>
              <span style={{ width:10, height:2.5, background:'var(--cyan)', display:'inline-block', borderRadius:2, boxShadow:'0 0 4px var(--cyan-glow)' }}/>
              <ArrowDown size={10}/> Rx
            </span>
            <span style={{ color: 'var(--purple)', display:'flex', alignItems:'center', gap:4, fontSize: '0.7rem', fontWeight: 600 }}>
              <span style={{ width:10, height:2.5, background:'var(--purple)', display:'inline-block', borderRadius:2, boxShadow:'0 0 4px var(--purple-glow)' }}/>
              <ArrowUp size={10}/> Tx
            </span>
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', background:'var(--bg-input)', borderRadius:10, border: '1px solid var(--border)' }}>
          {/* Grid lines */}
          <line x1={P} y1={P} x2={W-P} y2={P} stroke="var(--border)" />
          <line x1={P} y1={P+cH/2} x2={W-P} y2={P+cH/2} stroke="var(--border)" />
          <line x1={P} y1={H-P} x2={W-P} y2={H-P} stroke="var(--border-hover)" />
          {/* Area fills */}
          <path d={area(rx)} fill="url(#rxGrad)" />
          <path d={area(tx)} fill="url(#txGrad)" />
          {/* Line paths */}
          <path d={path(rx)} fill="none" stroke="var(--cyan)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
          <path d={path(tx)} fill="none" stroke="var(--purple)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
          {/* Data points */}
          {rx.map((c,i) => <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--cyan)" stroke="var(--depth-2)" strokeWidth="1.5" />)}
          {tx.map((c,i) => <circle key={i} cx={c.x} cy={c.y} r="3" fill="var(--purple)" stroke="var(--depth-2)" strokeWidth="1.5" />)}
          {/* Gradients & filters */}
          <defs>
            <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--purple)" stopOpacity="0.15" />
              <stop offset="100%" stopColor="var(--purple)" stopOpacity="0" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
        </svg>
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Real-time router analytics and performance overview</p>
        </div>
        <div className="flex gap-2 items-center">
          {routers.length > 0 && (
            <>
              <select className="form-select" style={{ width: 200 }} value={selectedRouterId}
                onChange={e => setSelectedRouterId(e.target.value)}>
                {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.host})</option>)}
              </select>
              {/* Time-range selector for historical trending */}
              <select className="form-select" style={{ width: 120 }} value={timeRange}
                onChange={e => setTimeRange(e.target.value)}>
                <option value="default">Live (30 pts)</option>
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
              </select>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => fetchDashboardData(selectedRouterId, timeRange)} disabled={polling || !selectedRouterId}>
            <RefreshCw size={14} className={polling ? 'animate-spin' : ''} />
            {polling ? 'Syncing…' : 'Sync'}
          </button>
        </div>
      </div>

      {routers.length === 0 ? (
        <div className="glass-card empty-state">
          <Wifi size={36} opacity={0.2} />
          <p>No MikroTik routers configured yet.</p>
          <span>Add a router to start tracking performance metrics.</span>
          <a href="/routers" className="btn btn-primary" style={{ marginTop: '0.5rem' }}>Configure Routers</a>
        </div>
      ) : (
        <>
          {/* Outage banner */}
          {onlineCount < totalRouters && (
            <div className="alert-banner danger" style={{ marginBottom: '1.25rem' }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--offline-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <AlertTriangle size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '0.85rem' }}>Outage Detected</strong>
                <div style={{ marginTop: 2, color: 'inherit', opacity: 0.85 }}>
                  {totalRouters - onlineCount} of {totalRouters} routers are currently offline.
                </div>
              </div>
              <span className="badge badge-offline" style={{ fontSize: '0.6rem' }}>{totalRouters - onlineCount} Down</span>
            </div>
          )}

          {/* Stats row */}
          <div className="grid-stats">
            <div className="stat-card" style={{ '--accent-line': 'var(--cyan)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--cyan-dim)' }}>
                <Server size={16} color="var(--cyan)" />
              </div>
              <div className="stat-label">Routers Online</div>
              <div className="stat-value" style={{ color: 'var(--cyan)' }}>
                {onlineCount}<span style={{ fontSize: '1rem', color: 'var(--text-3)', fontWeight: 400 }}> / {totalRouters}</span>
              </div>
              <div className="stat-desc" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="dot dot-online" /> Active SSH connections
              </div>
            </div>

            <div className="stat-card" style={{ '--accent-line': 'var(--purple)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--purple-dim)' }}>
                <Users size={16} color="var(--purple)" />
              </div>
              <div className="stat-label">PPPoE Users</div>
              <div className="stat-value" style={{ color: 'var(--purple)' }}>{totalPppoe}</div>
              <div className="stat-desc">Active broadband sessions</div>
            </div>

            <div className="stat-card" style={{ '--accent-line': latestStats ? 'var(--teal)' : 'var(--text-3)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: latestStats ? 'var(--teal-dim)' : 'var(--bg-surface)' }}>
                <Cpu size={16} color={latestStats ? 'var(--teal)' : 'var(--text-3)'} />
              </div>
              <div className="stat-label">CPU Load</div>
              <div className="stat-value" style={{ color: latestStats ? 'var(--text-1)' : 'var(--text-3)' }}>
                {latestStats ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>{latestStats.cpu}%</span>
                    <div className="progress-track" style={{ width: 60, height: 4 }}>
                      <div className="progress-fill" style={{
                        width: `${latestStats.cpu}%`,
                        background: latestStats.cpu > 80 ? 'var(--offline)' : latestStats.cpu > 50 ? 'var(--warning)' : 'var(--gradient-teal-cyan)',
                      }} />
                    </div>
                  </span>
                ) : '—'}
              </div>
              <div className="stat-desc">{selectedRouter?.name ?? 'No router selected'}</div>
            </div>

            <div className="stat-card" style={{ '--accent-line': onlineCount === totalRouters ? 'var(--online)' : 'var(--offline)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: onlineCount === totalRouters ? 'var(--online-dim)' : 'var(--offline-dim)' }}>
                {onlineCount === totalRouters
                  ? <ShieldCheck size={16} color="var(--online)" />
                  : <ShieldAlert size={16} color="var(--offline)" />}
              </div>
              <div className="stat-label">System Status</div>
              <div className="stat-value" style={{ fontSize: '1.15rem', color: onlineCount === totalRouters ? 'var(--online)' : 'var(--offline)' }}>
                {onlineCount === totalRouters ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="dot dot-online" />
                    Healthy
                  </span>
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="dot dot-offline" />
                    Degraded
                  </span>
                )}
              </div>
              <div className="stat-desc">Infrastructure health</div>
            </div>
          </div>

          {/* Map collapsible */}
          <div className="glass-card mb-2">
            <div className="flex justify-between items-center" style={{ cursor: 'pointer', paddingBottom: mapExpanded ? '1rem' : 0 }}
              onClick={() => setMapExpanded(!mapExpanded)}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
                  <MapPin size={13} color="var(--cyan)" />
                </div>
                Router Locations
              </div>
              <div className="flex gap-1-5 items-center">
                <span style={{ fontSize: '0.7rem', color: 'var(--text-3)', fontWeight: 500 }}>
                  <span className="mono" style={{ color: 'var(--cyan)' }}>{routers.filter(r => r.latitude && r.longitude).length}</span>/{routers.length} located
                </span>
                <div style={{
                  width: 24, height: 24, borderRadius: 6,
                  background: 'var(--bg-surface)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'var(--ease)',
                }}>
                  {mapExpanded ? <ChevronDown size={13} color="var(--text-2)" /> : <ChevronRight size={13} color="var(--text-2)" />}
                </div>
              </div>
            </div>
            {mapExpanded && <DashboardMap routers={routers} />}
          </div>

          {/* Charts + Resources */}
          {selectedRouter && (
            <div className="grid-2-1" style={{ gap: '1.25rem' }}>
              {/* Bandwidth chart */}
              <div className="glass-card glow-cyan">
                <div className="section-title">
                  <div className="section-icon" style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--cyan-dim)' }}>
                    <Activity size={14} color="var(--cyan)" />
                  </div>
                  Live Bandwidth — {monitoredInterface || 'Interface'}
                </div>
                {selectedRouter.status === 'offline' ? (
                  <div className="empty-state" style={{ height: 180 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--offline-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldAlert size={20} color="var(--offline)" />
                    </div>
                    <span style={{ color: 'var(--offline)', fontWeight: 600 }}>Router Offline — Metrics Unavailable</span>
                  </div>
                ) : renderChart()}
              </div>

              {/* Resource utilization */}
              <div className="glass-card glow-purple">
                <div className="section-title">
                  <div className="section-icon" style={{ width: 26, height: 26, borderRadius: 7, background: 'var(--purple-dim)' }}>
                    <HardDrive size={14} color="var(--purple)" />
                  </div>
                  Resource Utilization
                </div>
                {selectedRouter.status === 'offline' ? (
                  <div className="empty-state" style={{ height: 200 }}>
                    <span style={{ color: 'var(--offline)' }}>Router offline</span>
                  </div>
                ) : !latestStats ? (
                  <div className="empty-state" style={{ height: 200 }}>
                    <RefreshCw size={18} className="animate-spin" />
                    <span>Gathering stats…</span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {/* CPU */}
                    <div>
                      <div className="flex justify-between items-center mb-1" style={{ fontSize: '0.8rem' }}>
                        <div className="flex gap-1 items-center">
                          <Cpu size={12} color="var(--cyan)" />
                          <span style={{ color: 'var(--text-2)' }}>CPU Load</span>
                        </div>
                        <span style={{ fontWeight: 700, color: latestStats.cpu > 80 ? 'var(--offline)' : 'var(--cyan)' }} className="mono">{latestStats.cpu}%</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{
                          width: `${latestStats.cpu}%`,
                          background: latestStats.cpu > 80 ? 'var(--offline)' : latestStats.cpu > 50 ? 'var(--gradient-warm)' : 'var(--gradient-teal-cyan)',
                          boxShadow: latestStats.cpu > 80 ? '0 0 8px var(--offline)' : '0 0 6px var(--cyan)',
                        }} />
                      </div>
                    </div>
                    {/* RAM */}
                    <div>
                      <div className="flex justify-between items-center mb-1" style={{ fontSize: '0.8rem' }}>
                        <div className="flex gap-1 items-center">
                          <HardDrive size={12} color="var(--teal)" />
                          <span style={{ color: 'var(--text-2)' }}>RAM</span>
                        </div>
                        <span style={{ fontWeight: 700, color: 'var(--teal)' }} className="mono">
                          {((latestStats.memoryUsed / latestStats.memoryTotal) * 100).toFixed(0)}%
                          <span style={{ fontWeight: 400, color: 'var(--text-3)', fontSize: '0.7rem', marginLeft: 4 }}>
                            {fmtMB(latestStats.memoryUsed)} / {fmtMB(latestStats.memoryTotal)}
                          </span>
                        </span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{
                          width: `${(latestStats.memoryUsed / latestStats.memoryTotal) * 100}%`,
                          background: 'var(--gradient-teal-cyan)',
                          boxShadow: '0 0 6px var(--teal)',
                        }} />
                      </div>
                    </div>
                    {/* Meta info */}
                    <div style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 10,
                      padding: '0.875rem 1rem',
                      marginTop: '0.25rem',
                    }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.75rem' }}>
                        <div>
                          <div style={{ color: 'var(--text-3)', marginBottom: 2, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Host</div>
                          <div className="mono" style={{ color: 'var(--text-1)', fontSize: '0.8rem' }}>{selectedRouter.host}:{selectedRouter.port || 22}</div>
                        </div>
                        <div>
                          <div style={{ color: 'var(--text-3)', marginBottom: 2, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Last Check</div>
                          <div style={{ color: 'var(--online)', fontSize: '0.8rem' }}>
                            {selectedRouter.lastChecked ? new Date(selectedRouter.lastChecked).toLocaleTimeString() : 'Never'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
