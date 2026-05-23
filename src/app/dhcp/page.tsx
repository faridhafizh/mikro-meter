'use client';

import { useState, useEffect } from 'react';
import { UsersRound, RefreshCw, Radio, Ban, LockKeyhole, LockKeyholeOpen, HelpCircle, AlertCircle } from 'lucide-react';

interface RouterConfig { id: string; name: string; host: string; status: string; }
interface ClientDevice { ip: string; mac: string; hostname: string; bytesConsumed: number; isStatic: boolean; isBlocked: boolean; status: string; }

export default function DhcpTalkersPage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [clients, setClients] = useState<ClientDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/routers').then(r => r.json()).then(d => {
      const online = d.filter((r: RouterConfig) => r.status === 'online');
      setRouters(online);
      if (online.length > 0) setSelectedRouterId(online[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fetchTalkers = async (routerId: string) => {
    if (!routerId) return;
    setPolling(true); setError(null);
    try {
      const res = await fetch(`/api/routers/${routerId}/talkers`);
      if (res.ok) { const d = await res.json(); setClients(d.clients || []); }
      else { const d = await res.json(); setError(d.error || 'Failed to retrieve client data.'); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setPolling(false); setLoading(false); }
  };

  useEffect(() => { if (selectedRouterId) fetchTalkers(selectedRouterId); }, [selectedRouterId]);

  const handleAction = async (ip: string, action: 'static' | 'block' | 'unblock') => {
    if (!selectedRouterId) return;
    setActioning(`${ip}-${action}`); setError(null);
    try {
      const res = await fetch(`/api/routers/${selectedRouterId}/talkers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, ip }) });
      if (res.ok) await fetchTalkers(selectedRouterId);
      else { const d = await res.json(); setError(d.error || `Failed to ${action}.`); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setActioning(null); }
  };

  const fmtBytes = (b: number) => {
    if (b === 0) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
  };

  const totalBytes = clients.reduce((a, c) => a + c.bytesConsumed, 0);
  const maxBytes = Math.max(...clients.map(c => c.bytesConsumed), 1024);
  const staticCount = clients.filter(c => c.isStatic).length;
  const blockedCount = clients.filter(c => c.isBlocked).length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">DHCP & Top Talkers</h1>
          <p className="page-subtitle">Real-time client bandwidth and router administration</p>
        </div>
        <div className="flex gap-2 items-center">
          {routers.length > 0 && (
            <select className="form-select" style={{ width: 220 }} value={selectedRouterId} onChange={e => setSelectedRouterId(e.target.value)} disabled={polling}>
              {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.host})</option>)}
            </select>
          )}
          <button className="btn btn-secondary" onClick={() => fetchTalkers(selectedRouterId)} disabled={!selectedRouterId || polling}>
            <RefreshCw size={13} className={polling ? 'animate-spin' : ''} /> Poll Live
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}><RefreshCw size={13} className="animate-spin" /> Querying clients…</div>
      ) : routers.length === 0 ? (
        <div className="glass-card empty-state"><UsersRound size={32} opacity={0.2} /><p>No online routers available.</p></div>
      ) : (
        <>
          {error && <div className="alert-banner danger mb-2"><AlertCircle size={15} />{error}</div>}

          <div className="grid-stats">
            <div className="stat-card" style={{ '--accent-line': 'var(--cyan)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--cyan-dim)' }}><UsersRound size={15} color="var(--cyan)" /></div>
              <div className="stat-label">Connected Devices</div>
              <div className="stat-value" style={{ color: 'var(--cyan)' }}>{clients.length}</div>
              <div className="stat-desc">{clients.length - staticCount} dynamic · {staticCount} static</div>
            </div>
            <div className="stat-card" style={{ '--accent-line': 'var(--purple)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--purple-dim)' }}><Radio size={15} color="var(--purple)" /></div>
              <div className="stat-label">Total Traffic</div>
              <div className="stat-value" style={{ color: 'var(--purple)' }}>{fmtBytes(totalBytes)}</div>
              <div className="stat-desc">Accumulated LAN snapshot</div>
            </div>
            <div className="stat-card" style={{ '--accent-line': blockedCount > 0 ? 'var(--offline)' : 'var(--text-3)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: blockedCount > 0 ? 'var(--offline-dim)' : 'rgba(255,255,255,0.04)' }}>
                <Ban size={15} color={blockedCount > 0 ? 'var(--offline)' : 'var(--text-3)'} />
              </div>
              <div className="stat-label">Blocked Clients</div>
              <div className="stat-value" style={{ color: blockedCount > 0 ? 'var(--offline)' : 'var(--text-3)' }}>{blockedCount}</div>
              <div className="stat-desc">Firewall address-list</div>
            </div>
          </div>

          <div className="grid-1-2" style={{ marginTop: '0.25rem' }}>
            {/* Top Talkers */}
            <div className="glass-card glow-cyan">
              <div className="section-title">
                <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
                  <Radio size={12} color="var(--cyan)" />
                </div>
                Top Talkers
              </div>
              {clients.filter(c => c.bytesConsumed > 0).length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 0' }}>
                  <HelpCircle size={24} opacity={0.2} />
                  <span>No traffic data yet. Click Poll Live.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {clients.filter(c => c.bytesConsumed > 0).slice(0, 7).map(c => (
                    <div key={c.ip}>
                      <div className="flex justify-between items-center mb-1" style={{ fontSize: '0.8rem' }}>
                        <span style={{ fontWeight: 600 }}>{c.hostname !== 'Unknown' ? c.hostname : c.ip}</span>
                        <span style={{ color: 'var(--teal)', fontWeight: 700 }}>{fmtBytes(c.bytesConsumed)}</span>
                      </div>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${(c.bytesConsumed / maxBytes) * 100}%`, background: 'linear-gradient(90deg, var(--cyan), var(--teal))', boxShadow: '0 0 4px var(--cyan)' }} />
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 2 }}>{c.ip}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Clients table */}
            <div className="glass-card">
              <div className="section-title">
                <div className="section-icon" style={{ background: 'rgba(255,255,255,0.04)' }}>
                  <UsersRound size={12} color="var(--text-2)" />
                </div>
                Active Leases
              </div>
              {clients.length === 0 ? (
                <div className="empty-state"><p>No DHCP leases found.</p></div>
              ) : (
                <div className="table-container">
                  <table className="glass-table">
                    <thead>
                      <tr><th>Hostname</th><th>IP</th><th>MAC</th><th>Type</th><th>Traffic</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                    </thead>
                    <tbody>
                      {clients.map(c => (
                        <tr key={c.ip} style={{ background: c.isBlocked ? 'rgba(244,63,94,0.03)' : 'transparent' }}>
                          <td style={{ fontWeight: 600 }}>{c.hostname}</td>
                          <td className="mono" style={{ color: 'var(--teal)' }}>{c.ip}</td>
                          <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{c.mac}</td>
                          <td>
                            <span className={`badge badge-${c.isStatic ? 'cyan' : 'purple'}`} style={{ fontSize: '0.65rem' }}>
                              {c.isStatic ? 'STATIC' : 'DYNAMIC'}
                            </span>
                          </td>
                          <td className="mono" style={{ fontWeight: 700, fontSize: '0.8rem' }}>{fmtBytes(c.bytesConsumed)}</td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                              {!c.isStatic && c.mac !== 'Unknown (Static IP)' && (
                                <button className="btn btn-secondary btn-sm" onClick={() => handleAction(c.ip, 'static')} disabled={actioning !== null}>
                                  {actioning === `${c.ip}-static` ? '…' : 'Static'}
                                </button>
                              )}
                              {c.isBlocked ? (
                                <button className="btn btn-secondary btn-sm" onClick={() => handleAction(c.ip, 'unblock')} disabled={actioning !== null} style={{ borderColor: 'rgba(0,212,255,0.3)', color: 'var(--cyan)' }}>
                                  <LockKeyholeOpen size={11} /> {actioning === `${c.ip}-unblock` ? '…' : 'Unblock'}
                                </button>
                              ) : (
                                <button className="btn btn-danger btn-sm" onClick={() => handleAction(c.ip, 'block')} disabled={actioning !== null}>
                                  <LockKeyhole size={11} /> {actioning === `${c.ip}-block` ? '…' : 'Block'}
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
