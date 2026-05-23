'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Info, HelpCircle, Network } from 'lucide-react';

interface TopologyNode { id: string; label: string; type: 'router' | 'neighbor'; ip?: string; mac?: string; platform?: string; status: 'online' | 'offline' | 'discovered'; }
interface TopologyLink { id: string; from: string; to: string; label: string; }
interface Position { x: number; y: number; }

export default function TopologyPage() {
  const [nodes, setNodes] = useState<TopologyNode[]>([]);
  const [links, setLinks] = useState<TopologyLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);

  const fetchTopology = async () => {
    setLoading(true); setSelectedNode(null);
    try {
      const res = await fetch('/api/topology');
      if (res.ok) { const d = await res.json(); setNodes(d.nodes || []); setLinks(d.links || []); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTopology(); }, []);

  const getPositions = (): Record<string, Position> => {
    const pos: Record<string, Position> = {};
    if (!nodes.length) return pos;
    const W = 800, H = 480, cx = W / 2, cy = H / 2;
    const routers = nodes.filter(n => n.type === 'router');
    const neighbors = nodes.filter(n => n.type === 'neighbor');
    if (routers.length === 1) {
      pos[routers[0].id] = { x: cx, y: cy };
      neighbors.forEach((n, i) => {
        const a = (2 * Math.PI * i) / neighbors.length;
        pos[n.id] = { x: cx + 170 * Math.cos(a), y: cy + 170 * Math.sin(a) };
      });
    } else {
      routers.forEach((n, i) => {
        const a = (2 * Math.PI * i) / routers.length;
        pos[n.id] = { x: cx + 100 * Math.cos(a), y: cy + 100 * Math.sin(a) };
      });
      neighbors.forEach((n, i) => {
        const a = (2 * Math.PI * i) / neighbors.length;
        pos[n.id] = { x: cx + 230 * Math.cos(a), y: cy + 230 * Math.sin(a) };
      });
    }
    return pos;
  };

  const positions = getPositions();

  const nodeColor = (status: string) => ({
    online: { stroke: 'var(--cyan)', fill: 'rgba(0,212,255,0.12)', glow: 'var(--cyan)' },
    offline: { stroke: 'var(--offline)', fill: 'rgba(244,63,94,0.12)', glow: 'var(--offline)' },
    discovered: { stroke: 'var(--purple)', fill: 'rgba(139,92,246,0.12)', glow: 'var(--purple)' },
  }[status] || { stroke: 'rgba(255,255,255,0.2)', fill: '#0f111a', glow: 'transparent' });

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Network Topology</h1>
          <p className="page-subtitle">Discovered nodes and neighbors via MNDP/LLDP</p>
        </div>
        <button className="btn btn-secondary" onClick={fetchTopology} disabled={loading}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Discover
        </button>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}><RefreshCw size={13} className="animate-spin" /> Discovering…</div>
      ) : nodes.length === 0 ? (
        <div className="glass-card empty-state"><Network size={32} opacity={0.2} /><p>No nodes discovered.</p><span>Add an online router to start discovery.</span></div>
      ) : (
        <div className="grid-sidebar-right">
          {/* Canvas */}
          <div className="topology-container">
            <div className="topology-overlay">
              <div className="topology-legend">
                {[['var(--cyan)', 'Router (Online)'], ['var(--offline)', 'Router (Offline)'], ['var(--purple)', 'Neighbor Node']].map(([color, label]) => (
                  <div key={label} className="flex gap-1 items-center" style={{ marginBottom: 4, fontSize: '0.75rem', color: 'var(--text-2)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <svg viewBox="0 0 800 480" className="topology-canvas">
              {links.map(link => {
                const from = positions[link.from], to = positions[link.to];
                if (!from || !to) return null;
                const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
                return (
                  <g key={link.id}>
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(0,212,255,0.08)" strokeWidth="6" />
                    <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                    <circle r="3.5" fill="var(--cyan)" opacity="0.8">
                      <animateMotion path={`M ${from.x} ${from.y} L ${to.x} ${to.y}`} dur="3s" repeatCount="indefinite" />
                    </circle>
                    <g transform={`translate(${mx},${my})`}>
                      <rect x="-26" y="-9" width="52" height="16" rx="4" fill="#06070a" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                      <text textAnchor="middle" y="2" fill="var(--text-3)" fontSize="8" fontFamily="monospace">{link.label}</text>
                    </g>
                  </g>
                );
              })}

              {nodes.map(node => {
                const pos = positions[node.id];
                if (!pos) return null;
                const sel = selectedNode?.id === node.id;
                const c = nodeColor(node.status);
                return (
                  <g key={node.id} transform={`translate(${pos.x},${pos.y})`} style={{ cursor: 'pointer' }} onClick={() => setSelectedNode(node)}>
                    <circle r={sel ? 24 : 18} fill="none" stroke={c.glow} strokeWidth={sel ? 8 : 4} opacity={sel ? 0.3 : 0.12} />
                    <circle r={sel ? 18 : 14} fill={c.fill} stroke={c.stroke} strokeWidth="2" />
                    <text textAnchor="middle" y="4" fill="#fff" fontSize="9" fontWeight="700">{node.type === 'router' ? 'R' : 'N'}</text>
                    <text textAnchor="middle" y="30" fill={sel ? '#fff' : 'var(--text-2)'} fontSize="10" fontWeight={sel ? '700' : '400'}>{node.label}</text>
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Details */}
          <div className="glass-card glow-purple" style={{ minHeight: 480 }}>
            <div className="section-title">
              <div className="section-icon" style={{ background: 'var(--purple-dim)' }}>
                <Info size={12} color="var(--purple)" />
              </div>
              Node Details
            </div>
            {selectedNode ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Identity</div>
                  <div style={{ fontWeight: 700, color: 'var(--text-1)' }}>{selectedNode.label}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Role</div>
                  <span className={`badge badge-${selectedNode.type === 'router' ? 'cyan' : 'purple'}`} style={{ fontSize: '0.65rem' }}>
                    {selectedNode.type === 'router' ? 'PRIMARY ROUTER' : 'NEIGHBOR'}
                  </span>
                </div>
                {selectedNode.ip && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>IP Address</div>
                    <div className="mono" style={{ color: 'var(--teal)', fontSize: '0.875rem' }}>{selectedNode.ip}</div>
                  </div>
                )}
                {selectedNode.mac && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>MAC Address</div>
                    <div className="mono" style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{selectedNode.mac}</div>
                  </div>
                )}
                {selectedNode.platform && (
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Platform</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-2)' }}>{selectedNode.platform}</div>
                  </div>
                )}
                <div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</div>
                  <span className={`badge badge-${selectedNode.status === 'online' ? 'online' : selectedNode.status === 'offline' ? 'offline' : 'purple'}`}>
                    {selectedNode.status}
                  </span>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '3rem 0' }}>
                <HelpCircle size={24} opacity={0.2} />
                <span>Click a node to inspect its details.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
