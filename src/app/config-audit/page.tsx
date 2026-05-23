'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  FileText,
  Plus,
  Trash2,
  Code2,
  GitCompare,
  Clock,
  Server,
  AlertCircle,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';

interface ConfigSnapshot {
  id: string;
  routerId: string;
  routerName: string;
  timestamp: string;
  label: string;
  filename: string;
  content?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  line1?: number;
  line2?: number;
  content: string;
}

interface RouterConfig {
  id: string;
  name: string;
  host: string;
  status: string;
}

export default function ConfigAuditPage() {
  const [snapshots, setSnapshots] = useState<ConfigSnapshot[]>([]);
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [snapshotting, setSnapshotting] = useState(false);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);
  const [snapshotSuccess, setSnapshotSuccess] = useState(false);

  // Diff state
  const [snapshot1Id, setSnapshot1Id] = useState('');
  const [snapshot2Id, setSnapshot2Id] = useState('');
  const [diffResult, setDiffResult] = useState<DiffLine[] | null>(null);
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);

  // Expanded snapshot
  const [expandedSnapshotId, setExpandedSnapshotId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [rRes, sRes] = await Promise.all([
        fetch('/api/routers'),
        fetch(`/api/config-audit${selectedRouterId ? `?routerId=${selectedRouterId}` : ''}`),
      ]);
      const rData = await rRes.json();
      const sData = await sRes.json();
      setRouters(rData);
      setSnapshots(sData);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedRouterId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleTakeSnapshot = async () => {
    if (!selectedRouterId) return;
    setSnapshotting(true);
    setSnapshotError(null);
    setSnapshotSuccess(false);
    try {
      const res = await fetch('/api/config-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routerId: selectedRouterId,
          label: `Snapshot - ${new Date().toLocaleString()}`,
        }),
      });
      if (res.ok) {
        setSnapshotSuccess(true);
        fetchData();
      } else {
        const d = await res.json();
        setSnapshotError(d.error || 'Failed to take snapshot.');
      }
    } catch (e) {
      setSnapshotError(e instanceof Error ? e.message : String(e));
    } finally {
      setSnapshotting(false);
    }
  };

  const handleDeleteSnapshot = async (id: string) => {
    if (!confirm('Delete this config snapshot?')) return;
    const res = await fetch(`/api/config-audit?id=${id}`, { method: 'DELETE' });
    if (res.ok) fetchData();
  };

  const handleDiff = async () => {
    if (!snapshot1Id || !snapshot2Id) return;
    setDiffLoading(true);
    setDiffError(null);
    try {
      const res = await fetch(`/api/config-audit/diff?id1=${snapshot1Id}&id2=${snapshot2Id}`);
      if (res.ok) {
        const d = await res.json();
        setDiffResult(d.diff);
      } else {
        const d = await res.json();
        setDiffError(d.error || 'Failed to compute diff.');
      }
    } catch (e) {
      setDiffError(e instanceof Error ? e.message : String(e));
    } finally {
      setDiffLoading(false);
    }
  };

  const toggleExpanded = (snapshot: ConfigSnapshot) => {
    setExpandedSnapshotId(expandedSnapshotId === snapshot.id ? null : snapshot.id);
  };

  const getStats = () => {
    const total = snapshots.length;
    const uniqueRouters = new Set(snapshots.map(s => s.routerName)).size;
    return { total, uniqueRouters };
  };

  const stats = getStats();

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Config Audit</h1>
          <p className="page-subtitle">Track RouterOS configuration changes over time with diff comparison</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="form-select"
            style={{ width: 220 }}
            value={selectedRouterId}
            onChange={e => setSelectedRouterId(e.target.value)}
          >
            <option value="">All Routers</option>
            {routers.map(r => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.status})
              </option>
            ))}
          </select>
          <button
            className="btn btn-primary"
            onClick={handleTakeSnapshot}
            disabled={snapshotting || !selectedRouterId}
          >
            {snapshotting ? (
              <><RefreshCw size={13} className="animate-spin" /> Capturing…</>
            ) : (
              <><Plus size={13} /> Take Snapshot</>
            )}
          </button>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {snapshotError && (
        <div className="alert-banner danger mb-2"><AlertCircle size={15} />{snapshotError}</div>
      )}
      {snapshotSuccess && (
        <div className="alert-banner success mb-2"><CheckCircle2 size={15} />Config snapshot captured successfully!</div>
      )}

      {/* Stats */}
      <div className="grid-stats">
        <div className="stat-card" style={{ '--accent-line': 'var(--cyan)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ background: 'var(--cyan-dim)' }}>
            <FileText size={15} color="var(--cyan)" />
          </div>
          <div className="stat-label">Snapshots</div>
          <div className="stat-value" style={{ color: 'var(--cyan)' }}>{stats.total}</div>
          <div className="stat-desc">Saved config versions</div>
        </div>
        <div className="stat-card" style={{ '--accent-line': 'var(--purple)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ background: 'var(--purple-dim)' }}>
            <Server size={15} color="var(--purple)" />
          </div>
          <div className="stat-label">Routers Tracked</div>
          <div className="stat-value" style={{ color: 'var(--purple)' }}>{stats.uniqueRouters}</div>
          <div className="stat-desc">With config history</div>
        </div>
        <div className="stat-card" style={{ '--accent-line': 'var(--teal)' } as React.CSSProperties}>
          <div className="stat-icon" style={{ background: 'var(--teal-dim)' }}>
            <GitCompare size={15} color="var(--teal)" />
          </div>
          <div className="stat-label">Comparison</div>
          <div className="stat-value" style={{ fontSize: '1rem', color: 'var(--teal)' }}>Diff Tool</div>
          <div className="stat-desc">Select two snapshots below</div>
        </div>
      </div>

      <div className="grid-sidebar">
        {/* Diff panel */}
        <div className="glass-card glow-cyan">
          <div className="section-title">
            <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
              <GitCompare size={12} color="var(--cyan)" />
            </div>
            Diff Comparison
          </div>

          {snapshots.length < 2 ? (
            <div className="empty-state" style={{ padding: '2rem 0' }}>
              <GitCompare size={24} opacity={0.2} />
              <span>Take at least 2 snapshots to compare.</span>
            </div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label">Older Snapshot</label>
                <select className="form-select" value={snapshot1Id} onChange={e => setSnapshot1Id(e.target.value)}>
                  <option value="">Select…</option>
                  {snapshots.filter(s => s.id !== snapshot2Id).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.routerName} — {s.label} ({new Date(s.timestamp).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Newer Snapshot</label>
                <select className="form-select" value={snapshot2Id} onChange={e => setSnapshot2Id(e.target.value)}>
                  <option value="">Select…</option>
                  {snapshots.filter(s => s.id !== snapshot1Id).map(s => (
                    <option key={s.id} value={s.id}>
                      {s.routerName} — {s.label} ({new Date(s.timestamp).toLocaleDateString()})
                    </option>
                  ))}
                </select>
              </div>
              <button
                className="btn btn-primary"
                style={{ width: '100%' }}
                onClick={handleDiff}
                disabled={!snapshot1Id || !snapshot2Id || diffLoading}
              >
                {diffLoading ? (
                  <><RefreshCw size={13} className="animate-spin" /> Computing…</>
                ) : (
                  <><ArrowUpDown size={13} /> Compare Configs</>
                )}
              </button>

              {diffError && (
                <div className="alert-banner danger mt-1" style={{ fontSize: '0.75rem' }}>{diffError}</div>
              )}

              {diffResult && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <div className="flex gap-1 items-center" style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}>
                      <span style={{ color: 'var(--offline)', fontWeight: 700 }}>
                        {diffResult.filter(l => l.type === 'removed').length}
                      </span> removed ·
                      <span style={{ color: 'var(--online)', fontWeight: 700 }}>
                        {diffResult.filter(l => l.type === 'added').length}
                      </span> added
                    </div>
                    <button className="btn btn-ghost btn-xs" onClick={() => setDiffResult(null)}>
                      <X size={12} /> Clear
                    </button>
                  </div>
                  <div
                    className="terminal-window"
                    style={{
                      maxHeight: 500,
                      fontSize: '0.65rem',
                      fontFamily: '"JetBrains Mono", monospace',
                      lineHeight: 1.6,
                    }}
                  >
                    {diffResult.slice(0, 200).map((line, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          gap: 8,
                          background:
                            line.type === 'added'
                              ? 'rgba(16, 217, 160, 0.08)'
                              : line.type === 'removed'
                              ? 'rgba(244, 63, 94, 0.08)'
                              : 'transparent',
                          borderLeft: `3px solid ${
                            line.type === 'added'
                              ? 'var(--online)'
                              : line.type === 'removed'
                              ? 'var(--offline)'
                              : 'transparent'
                          }`,
                          padding: '1px 6px',
                        }}
                      >
                        <span style={{ color: 'var(--text-4)', minWidth: 24, textAlign: 'right', userSelect: 'none' }}>
                          {line.type === 'added' ? '' : line.line1}
                        </span>
                        <span style={{ color: 'var(--text-4)', minWidth: 24, textAlign: 'right', userSelect: 'none' }}>
                          {line.type === 'removed' ? '' : line.line2}
                        </span>
                        <span
                          style={{
                            color:
                              line.type === 'added'
                                ? 'var(--online)'
                                : line.type === 'removed'
                                ? 'var(--offline)'
                                : 'var(--text-2)',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                          }}
                        >
                          {line.content}
                        </span>
                      </div>
                    ))}
                    {diffResult.length > 200 && (
                      <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: '0.5rem' }}>
                        … showing 200 of {diffResult.length} lines
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Snapshot history */}
        <div className="glass-card">
          <div className="section-title">
            <div className="section-icon" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <FileText size={12} color="var(--text-2)" />
            </div>
            Snapshot History ({snapshots.length})
          </div>

          {loading ? (
            <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}>
              <RefreshCw size={13} className="animate-spin" /> Loading…
            </div>
          ) : snapshots.length === 0 ? (
            <div className="empty-state">
              <Code2 size={28} opacity={0.2} />
              <p>No config snapshots yet.</p>
              <span>Select a router and take a snapshot to start tracking changes.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {snapshots.map(snap => (
                <div
                  key={snap.id}
                  className="glass-card"
                  style={{
                    padding: '0.75rem 1rem',
                    cursor: 'pointer',
                    borderColor: expandedSnapshotId === snap.id ? 'var(--border-cyan)' : undefined,
                  }}
                  onClick={() => toggleExpanded(snap)}
                >
                  <div className="flex justify-between items-center">
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex gap-1 items-center" style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                        <Server size={11} color="var(--cyan)" />
                        {snap.routerName}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginTop: 2 }} className="truncate">
                        {snap.label}
                      </div>
                    </div>
                    <div className="flex gap-1 items-center" style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-4)', display: 'flex', alignItems: 'center', gap: 3 }}>
                        <Clock size={10} />
                        {new Date(snap.timestamp).toLocaleDateString()}
                      </span>
                      <button
                        className="btn btn-ghost btn-icon"
                        style={{ padding: 3 }}
                        onClick={e => {
                          e.stopPropagation();
                          handleDeleteSnapshot(snap.id);
                        }}
                        title="Delete snapshot"
                      >
                        <Trash2 size={11} color="var(--offline)" />
                      </button>
                      <div style={{ color: 'var(--text-3)' }}>
                        {expandedSnapshotId === snap.id ? (
                          <ChevronDown size={13} />
                        ) : (
                          <ChevronRight size={13} />
                        )}
                      </div>
                    </div>
                  </div>
                  {/* Expanded config content */}
                  {expandedSnapshotId === snap.id && snap.content && (
                    <div style={{ marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-4)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        RouterOS Configuration ({snap.content.split('\n').length} lines)
                      </div>
                      <div
                        className="terminal-window"
                        style={{
                          maxHeight: 400,
                          fontSize: '0.6rem',
                          fontFamily: '"JetBrains Mono", monospace',
                          lineHeight: 1.5,
                          background: 'rgba(0,0,0,0.3)',
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          overflow: 'auto',
                          padding: '0.75rem',
                        }}
                      >
                        <pre style={{ margin: 0, color: 'var(--text-2)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {snap.content}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
