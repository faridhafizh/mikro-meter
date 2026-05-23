'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Edit2, Trash2, Bell, ShieldCheck, Cpu, HardDrive, Radio, X, RefreshCw } from 'lucide-react';

interface RouterConfig { id: string; name: string; host: string; status: string; monitoredInterfaces?: string[]; }
interface AlertRule {
  id: string; routerId: string; routerName: string; interfaceName?: string;
  metric: 'cpu' | 'memory' | 'rx' | 'tx'; operator: 'gt' | 'lt';
  threshold: number; isActive: boolean; isTriggered?: boolean; lastTriggered?: string;
}

export default function AlertsPage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editRuleId, setEditRuleId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [selectedMetric, setSelectedMetric] = useState<'cpu' | 'memory' | 'rx' | 'tx'>('cpu');
  const [selectedInterface, setSelectedInterface] = useState('');
  const [selectedOperator, setSelectedOperator] = useState<'gt' | 'lt'>('gt');
  const [threshold, setThreshold] = useState('80');

  const fetchRouters = useCallback(async () => {
    const res = await fetch('/api/routers'); setRouters(await res.json());
  }, []);
  const fetchRules = useCallback(async () => {
    const res = await fetch('/api/alerts'); setRules(await res.json());
  }, []);

  useEffect(() => {
    Promise.all([fetchRouters(), fetchRules()]).finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openAddModal = () => {
    setEditRuleId(null); setSelectedRouterId(''); setSelectedMetric('cpu');
    setSelectedInterface(''); setSelectedOperator('gt'); setThreshold('80');
    setActionError(null); setIsModalOpen(true);
  };

  const openEditModal = (rule: AlertRule) => {
    setEditRuleId(rule.id); setSelectedRouterId(rule.routerId); setSelectedMetric(rule.metric);
    setSelectedInterface(rule.interfaceName || ''); setSelectedOperator(rule.operator);
    setThreshold(String(rule.threshold)); setActionError(null); setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert rule?')) return;
    const res = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
    if (res.ok) fetchRules();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setActionError(null);
    const payload = { id: editRuleId, routerId: selectedRouterId, interfaceName: selectedInterface || undefined,
      metric: selectedMetric, operator: selectedOperator, threshold: Number(threshold), isActive: true };
    try {
      const res = await fetch('/api/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.ok) { setIsModalOpen(false); fetchRules(); }
      else { const d = await res.json(); setActionError(d.error || 'Failed to save.'); }
    } catch (e) { setActionError(e instanceof Error ? e.message : String(e)); }
    finally { setSaving(false); }
  };

  const metricLabel = (m: string) => ({ cpu: 'CPU Usage', memory: 'Memory', rx: 'Download', tx: 'Upload' }[m] || m);
  const MetricIcon = (m: string) => ({ cpu: Cpu, memory: HardDrive, rx: Radio, tx: Radio }[m] || Bell);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Alerts & Outage History</h1>
          <p className="page-subtitle">Threshold-based alerts and historical incident log</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}><Plus size={14} /> Add Alert Rule</button>
      </div>

      <div className="grid-2">
        {/* Alert Rules */}
        <div>
          <div className="section-title">
            <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
              <Bell size={12} color="var(--cyan)" />
            </div>
            Alert Rules
          </div>
          {loading ? (
            <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <RefreshCw size={13} className="animate-spin" /> Loading…
            </div>
          ) : rules.length === 0 ? (
            <div className="glass-card empty-state">
              <Bell size={28} opacity={0.2} />
              <p>No alert rules configured.</p>
              <button className="btn btn-primary btn-sm" onClick={openAddModal}><Plus size={12} /> Create Rule</button>
            </div>
          ) : (
            <div className="glass-card">
              <div className="table-container">
                <table className="glass-table">
                  <thead>
                    <tr><th>Router</th><th>Metric</th><th>Condition</th><th>Threshold</th><th>Status</th><th style={{ textAlign: 'right' }}>Actions</th></tr>
                  </thead>
                  <tbody>
                    {rules.map(rule => {
                      const Icon = MetricIcon(rule.metric);
                      return (
                        <tr key={rule.id}>
                          <td style={{ fontWeight: 600 }}>{rule.routerName}</td>
                          <td>
                            <div className="flex gap-1 items-center">
                              <Icon size={13} color="var(--cyan)" />
                              <span style={{ color: 'var(--text-2)' }}>{metricLabel(rule.metric)}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>
                            {rule.interfaceName ? rule.interfaceName : 'System'}
                          </td>
                          <td className="mono" style={{ color: 'var(--text-1)' }}>
                            {rule.operator === 'gt' ? '>' : '<'} {rule.threshold}{rule.metric === 'cpu' || rule.metric === 'memory' ? '%' : ' Mbps'}
                          </td>
                          <td>
                            <span className={`badge badge-${rule.isActive ? 'online' : 'offline'}`}>
                              {rule.isActive ? 'Active' : 'Off'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div className="flex gap-1" style={{ justifyContent: 'flex-end' }}>
                              <button className="btn btn-ghost btn-icon" onClick={() => openEditModal(rule)}><Edit2 size={13} /></button>
                              <button className="btn btn-danger btn-icon" onClick={() => handleDelete(rule.id)}><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Outage History */}
        <div>
          <div className="section-title">
            <div className="section-icon" style={{ background: 'var(--purple-dim)' }}>
              <ShieldCheck size={12} color="var(--purple)" />
            </div>
            Recent Outages
          </div>
          <OutageHistory />
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-content glass-card">
            <div className="flex justify-between items-center" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.875rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
                  <Bell size={12} color="var(--cyan)" />
                </div>
                {editRuleId ? 'Edit Alert Rule' : 'Add Alert Rule'}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setIsModalOpen(false)}><X size={16} /></button>
            </div>
            {actionError && <div className="alert-banner danger mb-2">{actionError}</div>}
            <form onSubmit={handleSave}>
              <div className="form-group">
                <label className="form-label">Router</label>
                <select className="form-select" value={selectedRouterId} onChange={e => setSelectedRouterId(e.target.value)} required>
                  <option value="">Select a router…</option>
                  {routers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.host})</option>)}
                </select>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label className="form-label">Metric</label>
                  <select className="form-select" value={selectedMetric}                  onChange={e => setSelectedMetric(e.target.value as 'cpu' | 'memory' | 'rx' | 'tx')}>
                    <option value="cpu">CPU Usage</option>
                    <option value="memory">Memory Usage</option>
                    <option value="rx">Download Speed</option>
                    <option value="tx">Upload Speed</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Operator</label>
                  <select className="form-select" value={selectedOperator}                  onChange={e => setSelectedOperator(e.target.value as 'gt' | 'lt')}>
                    <option value="gt">Greater than (&gt;)</option>
                    <option value="lt">Less than (&lt;)</option>
                  </select>
                </div>
              </div>
              {(selectedMetric === 'rx' || selectedMetric === 'tx') && (
                <div className="form-group">
                  <label className="form-label">Interface</label>
                  <input type="text" className="form-input" placeholder="e.g. ether1" value={selectedInterface} onChange={e => setSelectedInterface(e.target.value)} />
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Threshold</label>
                <input type="number" className="form-input" value={threshold} onChange={e => setThreshold(e.target.value)} required />
                <span className="stat-desc">{selectedMetric === 'cpu' || selectedMetric === 'memory' ? 'Percentage (e.g. 80)' : 'Mbps value (e.g. 100)'}</span>
              </div>
              <div className="flex justify-between items-center" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : 'Save Rule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function OutageHistory() {
  const [outages, setOutages] = useState<{ id: string; routerName: string; event: string; timestamp: string; durationMs?: number }[]>([]);
  const [loading, setOutageLoading] = useState(true);

  useEffect(() => {
    fetch('/api/outages').then(r => r.json()).then(d => { setOutages(d.slice(0, 20)); setOutageLoading(false); }).catch(() => setOutageLoading(false));
  }, []);

  if (loading) return <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}><RefreshCw size={13} className="animate-spin" /> Loading…</div>;

  if (outages.length === 0) return (
    <div className="glass-card empty-state">
      <ShieldCheck size={28} color="var(--online)" opacity={0.4} />
      <p>No outage events recorded.</p>
      <span>All routers have been continuously online.</span>
    </div>
  );

  return (
    <div className="glass-card">
      <div className="table-container">
        <table className="glass-table">
          <thead><tr><th>Router</th><th>Event</th><th>Time</th><th>Duration</th></tr></thead>
          <tbody>
            {outages.map(o => (
              <tr key={o.id}>
                <td style={{ fontWeight: 600 }}>{o.routerName}</td>
                <td>
                  <span className={`badge badge-${o.event === 'offline' ? 'offline' : 'online'}`}>
                    {o.event === 'offline' ? 'Went Offline' : 'Came Online'}
                  </span>
                </td>
                <td style={{ fontSize: '0.75rem', color: 'var(--text-3)' }}>{new Date(o.timestamp).toLocaleString()}</td>
                <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>
                  {o.durationMs ? `${Math.round(o.durationMs / 1000)}s` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
