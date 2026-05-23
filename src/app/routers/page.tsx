'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, ShieldCheck, ShieldAlert, RefreshCw, X, Server, Zap } from 'lucide-react';

interface RouterConfig {
  id: string; name: string; host: string; port: number; username: string;
  monitoredInterfaces?: string[]; backupSchedule?: 'none' | 'daily' | 'weekly';
  status?: 'online' | 'offline'; lastChecked?: string; lastBackupTime?: string;
  latitude?: number; longitude?: number;
}

export default function RoutersPage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRouterId, setEditRouterId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState('22');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [interfacesInput, setInterfacesInput] = useState('ether1');
  const [backupSchedule, setBackupSchedule] = useState<'none' | 'daily' | 'weekly'>('none');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');

  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; msg?: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchRouters = () => {
    setLoading(true);
    fetch('/api/routers').then(r => r.json()).then(d => { setRouters(d); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchRouters(); }, []);

  const openAddModal = () => {
    setEditRouterId(null); setName(''); setHost(''); setPort('22'); setUsername('admin');
    setPassword(''); setInterfacesInput('ether1'); setBackupSchedule('none');
    setLatitude(''); setLongitude(''); setTestResult(null); setActionError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (r: RouterConfig) => {
    setEditRouterId(r.id); setName(r.name); setHost(r.host); setPort(String(r.port));
    setUsername(r.username); setPassword(''); setInterfacesInput(r.monitoredInterfaces?.join(', ') || '');
    setBackupSchedule(r.backupSchedule || 'none'); setLatitude(String(r.latitude ?? ''));
    setLongitude(String(r.longitude ?? '')); setTestResult(null); setActionError(null);
    setIsModalOpen(true);
  };

  const handleTestConnection = async () => {
    if (!host || !username) { setTestResult({ success: false, msg: 'Host and username required.' }); return; }
    setTestingConnection(true); setTestResult(null);
    try {
      const res = await fetch('/api/routers/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ host, port: Number(port), username, password }) });
      const data = await res.json();
      setTestResult(data.success ? { success: true } : { success: false, msg: data.error || 'Connection failed' });
    } catch (e) { setTestResult({ success: false, msg: e instanceof Error ? e.message : String(e) }); }
    finally { setTestingConnection(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this router and its associated alerts?')) return;
    const res = await fetch(`/api/routers/${id}`, { method: 'DELETE' });
    if (res.ok) fetchRouters();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setActionError(null);
    const monitoredInterfaces = interfacesInput.split(',').map(i => i.trim()).filter(Boolean);
    const payload = { name, host, port: Number(port), username, password, monitoredInterfaces, backupSchedule,
      latitude: latitude !== '' ? Number(latitude) : undefined, longitude: longitude !== '' ? Number(longitude) : undefined };
    const url = editRouterId ? `/api/routers/${editRouterId}` : '/api/routers';
    try {
      const res = await fetch(url, { method: editRouterId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setIsModalOpen(false); fetchRouters(); }
      else { const d = await res.json(); setActionError(d.error || 'Failed to save.'); }
    } catch (e) { setActionError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Router Configurations</h1>
          <p className="page-subtitle">Manage SSH connections to your MikroTik devices</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={14} /> Add Router
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <RefreshCw size={14} className="animate-spin" /> Loading routers…
        </div>
      ) : routers.length === 0 ? (
        <div className="glass-card empty-state">
          <Server size={32} opacity={0.2} />
          <p>No routers configured yet.</p>
          <button className="btn btn-primary" onClick={openAddModal}><Plus size={14} /> Add Your First Router</button>
        </div>
      ) : (
        <div className="glass-card">
          <div className="table-container">
            <table className="glass-table">
              <thead>
                <tr>
                  <th>Name</th><th>Host</th><th>Port</th><th>User</th>
                  <th>Backup</th><th>Status</th><th>Last Check</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {routers.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td className="mono" style={{ color: 'var(--cyan)' }}>{r.host}</td>
                    <td className="mono">{r.port}</td>
                    <td style={{ color: 'var(--text-2)' }}>{r.username}</td>
                    <td style={{ textTransform: 'capitalize', color: 'var(--text-2)' }}>{r.backupSchedule || 'None'}</td>
                    <td>
                      <span className={`badge badge-${r.status === 'online' ? 'online' : 'offline'}`}>
                        <span className={`dot dot-${r.status === 'online' ? 'online' : 'offline'}`} />
                        {r.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                      {r.lastChecked ? new Date(r.lastChecked).toLocaleString() : 'Never'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => openEditModal(r)} title="Edit"><Edit2 size={13} /></button>
                        <button className="btn btn-danger btn-icon" onClick={() => handleDelete(r.id)} title="Delete"><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card">
            <div className="flex justify-between items-center" style={{
              borderBottom: '1px solid var(--border)',
              paddingBottom: '0.875rem',
              marginBottom: '1.25rem',
            }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
                  <Server size={12} color="var(--cyan)" />
                </div>
                {editRouterId ? 'Edit Router' : 'Add Router'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}><X size={16} /></button>
            </div>

            {actionError && <div className="alert-banner danger mb-2">{actionError}</div>}

            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Router Name</label>
                <input type="text" className="form-input" placeholder="e.g. Core Router" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-row-3-1">
                <div className="form-group">
                  <label className="form-label">Host IP</label>
                  <input type="text" className="form-input" placeholder="192.168.88.1" value={host} onChange={e => setHost(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">SSH Port</label>
                  <input type="number" className="form-input" placeholder="22" value={port} onChange={e => setPort(e.target.value)} required />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input type="text" className="form-input" value={username} onChange={e => setUsername(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input type="password" className="form-input" placeholder={editRouterId ? '•••• (unchanged)' : 'Enter password'} value={password} onChange={e => setPassword(e.target.value)} required={!editRouterId} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Monitored Interfaces</label>
                <input type="text" className="form-input" placeholder="ether1, ether2, bridge" value={interfacesInput} onChange={e => setInterfacesInput(e.target.value)} />
                <span className="stat-desc">Comma-separated. Used for bandwidth alerts.</span>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Latitude</label>
                  <input type="number" step="any" className="form-input" placeholder="40.7128" value={latitude} onChange={e => setLatitude(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Longitude</label>
                  <input type="number" step="any" className="form-input" placeholder="-74.0060" value={longitude} onChange={e => setLongitude(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Backup Schedule</label>
                <select className="form-select" value={backupSchedule}                onChange={e => setBackupSchedule(e.target.value as 'none' | 'daily' | 'weekly')}>
                  <option value="none">None (Manual only)</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>

              {/* Connection test */}
              <div style={{
                background: 'rgba(0, 212, 255, 0.03)',
                border: '1px solid var(--border-cyan)',
                borderRadius: 10,
                padding: '0.875rem 1rem',
                marginBottom: '1rem',
              }}>
                <div className="flex justify-between items-center">
                  <div className="flex gap-1-5 items-center">
                    <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
                      <ShieldCheck size={12} color="var(--cyan)" />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-2)' }}>SSH Connection Test</span>
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={handleTestConnection} disabled={testingConnection || !host}>
                    {testingConnection ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                    {testingConnection ? 'Testing…' : 'Test SSH'}
                  </button>
                </div>
                {testResult && (
                  <div className="flex gap-1 items-center" style={{
                    fontSize: '0.8rem',
                    padding: '0.5rem 0.75rem',
                    marginTop: '0.625rem',
                    borderRadius: 8,
                    background: testResult.success ? 'var(--online-dim)' : 'var(--offline-dim)',
                    border: `1px solid ${testResult.success ? 'rgba(16,217,160,0.2)' : 'rgba(244,63,94,0.2)'}`,
                  }}>
                    {testResult.success
                      ? <><ShieldCheck size={14} color="var(--online)" /><span style={{ color: 'var(--online)', fontWeight: 600 }}>Connected successfully</span></>
                      : <><ShieldAlert size={14} color="var(--offline)" /><span style={{ color: 'var(--offline)' }}>Failed: {testResult.msg}</span></>}
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : 'Save Router'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
