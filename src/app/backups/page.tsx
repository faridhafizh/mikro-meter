'use client';

import { useState, useEffect } from 'react';
import { Download, RefreshCw, Play, FileText, HardDrive, CheckCircle2, XCircle, Trash2, Database } from 'lucide-react';

interface RouterConfig { id: string; name: string; host: string; status: string; }
interface BackupLog {
  id: string; routerId: string; routerName: string; filename: string;
  format: 'rsc' | 'backup'; sizeBytes: number; timestamp: string;
  status: 'success' | 'failed'; error?: string;
}

export default function BackupsPage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [backups, setBackups] = useState<BackupLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [backupFormat, setBackupFormat] = useState<'rsc' | 'backup' | 'both'>('both');
  const [backingUp, setBackingUp] = useState(false);
  const [cleaningUp, setCleaningUp] = useState(false);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [backupSuccess, setBackupSuccess] = useState(false);

  const fetchData = async () => {
    try {
      const [rRes, bRes] = await Promise.all([fetch('/api/routers'), fetch('/api/backups')]);
      const rData = await rRes.json();
      const bData = await bRes.json();
      const online = rData.filter((r: RouterConfig) => r.status === 'online');
      setRouters(online);
      if (online.length > 0) setSelectedRouterId(online[0].id);
      setBackups(bData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleCleanup = async () => {
    if (!confirm('Delete all backup files older than the retention period?')) return;
    setCleaningUp(true);
    try {
      const res = await fetch('/api/backups/cleanup', { method: 'POST' });
      const data = await res.json();
      if (data.success) { alert(data.message); fetchData(); }
      else alert(data.error || 'Cleanup failed.');
    } catch (e) { alert('Error: ' + (e instanceof Error ? e.message : String(e))); }
    finally { setCleaningUp(false); }
  };

  const handleTriggerBackup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRouterId) return;
    setBackingUp(true); setBackupError(null); setBackupSuccess(false);
    try {
      const res = await fetch('/api/backups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ routerId: selectedRouterId, format: backupFormat }) });
      const data = await res.json();
      if (res.ok && data.success) {
        setBackupSuccess(true);
        const bRes = await fetch('/api/backups');
        setBackups(await bRes.json());
      } else setBackupError(data.error || 'Backup failed.');
    } catch (e) { setBackupError(e instanceof Error ? e.message : String(e)); }
    finally { setBackingUp(false); }
  };

  const fmtBytes = (b: number) => {
    if (b === 0) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return `${(b / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Backup Manager</h1>
          <p className="page-subtitle">Save and download .backup and .rsc configuration exports</p>
        </div>
        <div className="flex gap-2 items-center">
          <button className="btn btn-secondary" onClick={handleCleanup} disabled={cleaningUp}>
            {cleaningUp ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {cleaningUp ? 'Cleaning…' : 'Cleanup Old'}
          </button>
          <a href="/api/export/backups" className="btn btn-secondary" download>Export CSV</a>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading || backingUp}>
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid-sidebar">
        {/* Trigger card */}
        <div className="glass-card glow-cyan">
          <div className="section-title">
            <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
              <Play size={12} color="var(--cyan)" />
            </div>
            Instant Backup
          </div>

          {backupError && <div className="alert-banner danger mb-2" style={{ fontSize: '0.8rem' }}>{backupError}</div>}
          {backupSuccess && <div className="alert-banner success mb-2" style={{ fontSize: '0.8rem' }}>Backup completed successfully!</div>}

          {routers.length === 0 ? (
            <p style={{ color: 'var(--text-2)', fontSize: '0.8rem' }}>No online routers available.</p>
          ) : (
            <form onSubmit={handleTriggerBackup}>
              <div className="form-group">
                <label className="form-label">Router</label>
                <select className="form-select" value={selectedRouterId} onChange={e => setSelectedRouterId(e.target.value)} required>
                  {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.host})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Format</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.25rem' }}>
                  {(['rsc', 'backup', 'both'] as const).map(f => (
                    <label key={f} className="toggle-row">
                      <input type="radio" name="format" value={f} checked={backupFormat === f} onChange={() => setBackupFormat(f)} />
                      {f === 'rsc' ? 'RSC Export (.rsc)' : f === 'backup' ? 'Binary Backup (.backup)' : 'Both Formats'}
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '0.5rem' }} disabled={backingUp}>
                {backingUp ? <><RefreshCw size={13} className="animate-spin" /> Backing up…</> : <><Database size={13} /> Run Backup Now</>}
              </button>
            </form>
          )}
        </div>

        {/* History table */}
        <div className="glass-card">
          <div className="section-title">
            <div className="section-icon" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <Database size={12} color="var(--text-2)" />
            </div>
            Backup History
          </div>
          {loading ? (
            <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <RefreshCw size={13} className="animate-spin" /> Loading…
            </div>
          ) : backups.length === 0 ? (
            <div className="empty-state"><Database size={28} opacity={0.2} /><p>No backups found.</p></div>
          ) : (
            <div className="table-container">
              <table className="glass-table">
                <thead>
                  <tr><th>Router</th><th>Format</th><th>Filename</th><th>Size</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Download</th></tr>
                </thead>
                <tbody>
                  {backups.map(log => (
                    <tr key={log.id}>
                      <td style={{ fontWeight: 600 }}>{log.routerName}</td>
                      <td>
                        <span className={`badge badge-${log.format === 'rsc' ? 'cyan' : 'purple'}`}>
                          {log.format === 'rsc' ? <FileText size={10} /> : <HardDrive size={10} />}
                          {log.format.toUpperCase()}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-2)', maxWidth: 200 }}>
                        <span className="truncate" style={{ display: 'block' }}>{log.filename}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{log.status === 'success' ? fmtBytes(log.sizeBytes) : '—'}</td>
                      <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{new Date(log.timestamp).toLocaleString()}</td>
                      <td>
                        {log.status === 'success'
                          ? <span className="flex gap-1 items-center" style={{ color: 'var(--online)', fontSize: '0.8rem' }}><CheckCircle2 size={13} /> OK</span>
                          : <span className="flex gap-1 items-center" style={{ color: 'var(--offline)', fontSize: '0.8rem', cursor: 'help' }} title={log.error}><XCircle size={13} /> Failed</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {log.status === 'success'
                          ? <a href={`/api/backups/download?filename=${encodeURIComponent(log.filename)}`} className="btn btn-ghost btn-icon" download title="Download"><Download size={13} /></a>
                          : <button className="btn btn-ghost btn-icon" title={log.error} onClick={() => alert(`Error:\n${log.error}`)}><XCircle size={13} color="var(--offline)" /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
