'use client';

import { useState, useEffect } from 'react';
import { Ticket, RefreshCw, Clock, HardDrive, Trash2, Printer, AlertCircle, Plus } from 'lucide-react';

interface RouterConfig { id: string; name: string; host: string; status: string; }
interface HotspotVoucher {
  id: string; routerId: string; routerName: string; username: string; password?: string;
  profile: string; limitUptime?: string; limitBytes?: number; timestamp: string;
  status: 'active' | 'used' | 'expired';
}

export default function HotspotVouchersPage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [vouchers, setVouchers] = useState<HotspotVoucher[]>([]);
  const [profiles, setProfiles] = useState<string[]>(['default']);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [fetchingConfig, setFetchingConfig] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedProfile, setSelectedProfile] = useState('default');
  const [limitUptime, setLimitUptime] = useState('2h');
  const [limitBytes, setLimitBytes] = useState('0');
  const [customCode, setCustomCode] = useState('');

  useEffect(() => {
    Promise.all([fetch('/api/routers').then(r => r.json()), fetch('/api/vouchers').then(r => r.json())])
      .then(([rData, vData]) => {
        const online = rData.filter((r: RouterConfig) => r.status === 'online');
        setRouters(online);
        if (online.length > 0) setSelectedRouterId(online[0].id);
        setVouchers(vData);
      }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedRouterId) return;
    setFetchingConfig(true); setError(null);
    fetch(`/api/routers/${selectedRouterId}/hotspot`).then(r => r.json()).then(d => {
      setProfiles(d.profiles || ['default']);
      if (d.profiles?.length) setSelectedProfile(d.profiles[0]);
    }).catch(e => setError(e.message)).finally(() => setFetchingConfig(false));
  }, [selectedRouterId]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRouterId) return;
    setGenerating(true); setError(null);
    try {
      const res = await fetch(`/api/routers/${selectedRouterId}/hotspot`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: selectedProfile, limitUptime: limitUptime || 'none', limitBytes: limitBytes !== '0' ? parseInt(limitBytes) * 1024 * 1024 : 0, code: customCode || undefined }),
      });
      if (res.ok) { const v = await res.json(); setVouchers(prev => [v, ...prev]); setCustomCode(''); }
      else { const d = await res.json(); setError(d.error || 'Failed to generate voucher.'); }
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setGenerating(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this voucher log?')) return;
    const res = await fetch(`/api/vouchers?id=${id}`, { method: 'DELETE' });
    if (res.ok) setVouchers(prev => prev.filter(v => v.id !== id));
  };

  const handlePrint = (v: HotspotVoucher) => {
    const w = window.open('', '_blank');
    if (!w) return;
    const router = routers.find(r => r.id === v.routerId);
    const qr = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(v.username)}`;
    w.document.write(`<html><head><title>Voucher</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#fff}.card{width:280px;border:2px dashed #333;border-radius:12px;padding:20px;text-align:center}.brand{font-size:1.3rem;font-weight:800;margin-bottom:4px}.sub{font-size:.8rem;color:#666;margin-bottom:14px}.qr img{width:130px;height:130px;margin:0 auto 14px;display:block}.lbl{font-size:.7rem;color:#888;text-transform:uppercase;letter-spacing:1px}.val{font-size:1.6rem;font-weight:800;font-family:monospace;background:#f0f0f0;padding:4px;border-radius:6px;margin:4px 0 14px}.det{font-size:.82rem;color:#444;line-height:1.5}.foot{font-size:.7rem;color:#999;border-top:1px solid #eee;padding-top:10px;margin-top:14px}</style></head><body><div class="card"><div class="brand">✨ WI-FI ACCESS</div><div class="sub">${router?.name || 'Guest WiFi'}</div><div class="qr"><img src="${qr}"/></div><div class="lbl">Voucher Code</div><div class="val">${v.username}</div><div class="det">${v.limitUptime ? `Duration: ${v.limitUptime}` : 'Unlimited'}<br/>${v.limitBytes ? `Quota: ${Math.round(v.limitBytes / (1024 * 1024))} MB` : 'Unlimited Quota'}<br/>Profile: ${v.profile}</div><div class="foot">Connect to Wi-Fi, scan QR or enter code on login page.</div></div><script>window.onload=()=>{window.print();setTimeout(()=>window.close(),500)}</script></body></html>`);
    w.document.close();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Hotspot Vouchers</h1>
          <p className="page-subtitle">Generate and manage guest portal access vouchers</p>
        </div>
        <div className="flex gap-2 items-center">
          {routers.length > 0 && (
            <select className="form-select" style={{ width: 220 }} value={selectedRouterId} onChange={e => setSelectedRouterId(e.target.value)} disabled={loading || fetchingConfig}>
              {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.host})</option>)}
            </select>
          )}
          <button className="btn btn-secondary" onClick={() => { fetch('/api/vouchers').then(r => r.json()).then(setVouchers); }} disabled={loading}>
            <RefreshCw size={13} /> Sync
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}><RefreshCw size={13} className="animate-spin" /> Loading…</div>
      ) : routers.length === 0 ? (
        <div className="glass-card empty-state"><Ticket size={32} opacity={0.2} /><p>No online routers available.</p></div>
      ) : (
        <div className="grid-sidebar">
          {/* Form */}
          <div className="glass-card glow-cyan">
          <div className="section-title">
            <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
              <Plus size={12} color="var(--cyan)" />
            </div>
              Generate Voucher
            </div>
            {error && <div className="alert-banner danger mb-2" style={{ fontSize: '0.8rem' }}><AlertCircle size={13} />{error}</div>}
            {fetchingConfig ? (
              <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8rem' }}><RefreshCw size={12} className="animate-spin" /> Reading profiles…</div>
            ) : (
              <form onSubmit={handleGenerate} style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Profile</label>
                  <select className="form-select" value={selectedProfile} onChange={e => setSelectedProfile(e.target.value)}>
                    {profiles.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Uptime Limit</label>
                  <select className="form-select" value={limitUptime} onChange={e => setLimitUptime(e.target.value)}>
                    <option value="none">Unlimited</option>
                    <option value="30m">30 Minutes</option>
                    <option value="1h">1 Hour</option>
                    <option value="2h">2 Hours</option>
                    <option value="3h">3 Hours</option>
                    <option value="6h">6 Hours</option>
                    <option value="12h">12 Hours</option>
                    <option value="1d">1 Day</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Data Quota</label>
                  <select className="form-select" value={limitBytes} onChange={e => setLimitBytes(e.target.value)}>
                    <option value="0">Unlimited</option>
                    <option value="250">250 MB</option>
                    <option value="500">500 MB</option>
                    <option value="1024">1 GB</option>
                    <option value="2048">2 GB</option>
                    <option value="5120">5 GB</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Custom Code (optional)</label>
                  <input type="text" className="form-input" placeholder="e.g. GUEST2026" value={customCode} onChange={e => setCustomCode(e.target.value)} />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={generating}>
                  {generating ? <><RefreshCw size={13} className="animate-spin" /> Deploying…</> : <><Ticket size={13} /> Generate & Deploy</>}
                </button>
              </form>
            )}
          </div>

          {/* Table */}
          <div className="glass-card">
          <div className="section-title">
            <div className="section-icon" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Ticket size={12} color="var(--text-2)" />
            </div>
              Voucher History ({vouchers.length})
            </div>
            {vouchers.length === 0 ? (
              <div className="empty-state"><Ticket size={28} opacity={0.2} /><p>No vouchers generated yet.</p></div>
            ) : (
              <div className="table-container">
                <table className="glass-table">
                  <thead>
                    <tr><th>Code</th><th>Router</th><th>Profile</th><th>Duration</th><th>Quota</th><th>Generated</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {vouchers.map(v => (
                      <tr key={v.id}>
                        <td className="mono" style={{ fontWeight: 700, color: 'var(--cyan)', fontSize: '0.9rem' }}>{v.username}</td>
                        <td style={{ color: 'var(--text-2)' }}>{v.routerName}</td>
                        <td><span className="badge badge-purple" style={{ fontSize: '0.65rem' }}>{v.profile}</span></td>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>
                          {v.limitUptime ? <span className="flex gap-1 items-center"><Clock size={11} color="var(--purple)" />{v.limitUptime}</span> : '∞'}
                        </td>
                        <td className="mono" style={{ fontSize: '0.8rem' }}>
                          {v.limitBytes ? <span className="flex gap-1 items-center"><HardDrive size={11} color="var(--teal)" />{Math.round(v.limitBytes / (1024 * 1024))} MB</span> : '∞'}
                        </td>
                        <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{new Date(v.timestamp).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>
                          <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                            <button className="btn btn-ghost btn-icon" onClick={() => handlePrint(v)} title="Print voucher"><Printer size={13} /></button>
                            <button className="btn btn-danger btn-icon" onClick={() => handleDelete(v.id)} title="Delete"><Trash2 size={13} /></button>
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
      )}
    </div>
  );
}
