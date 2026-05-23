'use client';

import { useState, useEffect } from 'react';
import { Search, RefreshCw, Users, AlertCircle, Clock, Network } from 'lucide-react';

interface RouterConfig { id: string; name: string; host: string; status: string; }
interface PppoeUser { id: string; name: string; service: string; callerId: string; address: string; uptime: string; }

export default function PppoePage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [pppoeUsers, setPppoeUsers] = useState<PppoeUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/routers').then(r => r.json()).then(d => {
      const online = d.filter((r: RouterConfig) => r.status === 'online');
      setRouters(online);
      if (online.length > 0) setSelectedRouterId(online[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fetchPppoeUsers = async (routerId: string) => {
    if (!routerId) return;
    setFetchingUsers(true); setError(null);
    try {
      const res = await fetch(`/api/routers/${routerId}/stats?pppoe=true`);
      if (res.ok) { const d = await res.json(); setPppoeUsers(d.pppoeList || []); }
      else { const d = await res.json(); setError(d.error || 'Failed to retrieve PPPoE sessions.'); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setFetchingUsers(false); setLoading(false); }
  };

  useEffect(() => { if (selectedRouterId) fetchPppoeUsers(selectedRouterId); }, [selectedRouterId]);

  const filtered = pppoeUsers.filter(u => {
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.address.toLowerCase().includes(q) || u.callerId.toLowerCase().includes(q) || u.uptime.toLowerCase().includes(q);
  });

  const uniqueSubnets = new Set(pppoeUsers.map(u => u.address.split('.').slice(0, 3).join('.'))).size;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">PPPoE Analytics</h1>
          <p className="page-subtitle">Active broadband user sessions in real-time</p>
        </div>
        <div className="flex gap-2 items-center">
          {routers.length > 0 && (
            <select className="form-select" style={{ width: 220 }} value={selectedRouterId} onChange={e => setSelectedRouterId(e.target.value)} disabled={fetchingUsers}>
              {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.host})</option>)}
            </select>
          )}
          <button className="btn btn-secondary" onClick={() => fetchPppoeUsers(selectedRouterId)} disabled={!selectedRouterId || fetchingUsers}>
            <RefreshCw size={13} className={fetchingUsers ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}><RefreshCw size={13} className="animate-spin" /> Loading…</div>
      ) : routers.length === 0 ? (
        <div className="glass-card empty-state"><Users size={32} opacity={0.2} /><p>No online routers available.</p></div>
      ) : (
        <>
          <div className="grid-stats">
            <div className="stat-card" style={{ '--accent-line': 'var(--cyan)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--cyan-dim)' }}><Users size={15} color="var(--cyan)" /></div>
              <div className="stat-label">Active Sessions</div>
              <div className="stat-value" style={{ color: 'var(--cyan)' }}>{pppoeUsers.length}</div>
              <div className="stat-desc">PPPoE tunnels online</div>
            </div>
            <div className="stat-card" style={{ '--accent-line': 'var(--purple)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--purple-dim)' }}><Network size={15} color="var(--purple)" /></div>
              <div className="stat-label">Unique Subnets</div>
              <div className="stat-value" style={{ color: 'var(--purple)' }}>{uniqueSubnets}</div>
              <div className="stat-desc">Allocated to PPPoE users</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon" style={{ background: 'rgba(255,255,255,0.04)' }}><Clock size={15} color="var(--text-3)" /></div>
              <div className="stat-label">Monitoring</div>
              <div className="stat-value" style={{ fontSize: '1rem', color: 'var(--text-2)', marginTop: 8, marginBottom: 8 }}>Live SSH</div>
              <div className="stat-desc">Polled dynamically over SSH</div>
            </div>
          </div>

          {error && <div className="alert-banner danger mb-2"><AlertCircle size={15} />{error}</div>}

          <div className="glass-card">
            <div className="flex justify-between items-center mb-2" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <div className="section-title" style={{ marginBottom: 0 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(255,255,255,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Users size={12} color="var(--text-2)" />
                </div>
                Active Sessions ({filtered.length})
              </div>
              <div className="search-wrap" style={{ width: 280 }}>
                <Search size={13} className="search-icon" />
                <input type="text" className="form-input" placeholder="Search user, IP, MAC…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
            </div>

            {fetchingUsers ? (
              <div className="empty-state" style={{ padding: '2rem 0' }}><RefreshCw size={20} className="animate-spin" /><span>Querying sessions…</span></div>
            ) : filtered.length === 0 ? (
              <div className="empty-state"><p>{searchQuery ? 'No sessions match your search.' : 'No active PPPoE sessions.'}</p></div>
            ) : (
              <div className="table-container">
                <table className="glass-table">
                  <thead>
                    <tr><th>#</th><th>Username</th><th>Service</th><th>Caller ID (MAC)</th><th>IP Address</th><th>Uptime</th></tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => (
                      <tr key={u.id}>
                        <td className="mono" style={{ color: 'var(--text-3)' }}>{i + 1}</td>
                        <td style={{ fontWeight: 600, color: 'var(--cyan)' }}>{u.name}</td>
                        <td style={{ color: 'var(--text-2)' }}>{u.service}</td>
                        <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{u.callerId}</td>
                        <td className="mono" style={{ color: 'var(--teal)' }}>{u.address}</td>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>{u.uptime}</td>
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
