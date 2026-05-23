'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Globe,
  Network,
  Route,
  Radio,
  Wifi,
  AlertCircle,
  HelpCircle,
  Search,
} from 'lucide-react';

interface RouterConfig {
  id: string;
  name: string;
  host: string;
  status: string;
}

interface BgpSession {
  name: string;
  remoteAs: string;
  remoteAddress: string;
  state: string;
  uptime?: string;
  prefixCount?: number;
  localAddress?: string;
}

interface OspfNeighbor {
  routerId: string;
  address: string;
  interface: string;
  state: string;
  priority?: number;
}

interface OspfInterface {
  name: string;
  area: string;
  state: string;
  cost: number;
  type: string;
  passive: boolean;
}

interface RouteEntry {
  dstAddress: string;
  gateway: string;
  distance: number;
  routingMark: string;
  interface: string;
  prefSrc?: string;
  dynamic: boolean;
  type: string;
  comment?: string;
}

interface RoutingData {
  bgpSessions?: BgpSession[];
  bgpError?: string;
  ospfNeighbors?: OspfNeighbor[];
  ospfError?: string;
  ospfInterfaces?: OspfInterface[];
  routeTable?: { routes: RouteEntry[]; total: number };
  ipv6Routes?: { routes: RouteEntry[]; total: number };
}

export default function RoutingPage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [data, setData] = useState<RoutingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bgp' | 'ospf' | 'routes'>('bgp');
  const [routeSearch, setRouteSearch] = useState('');

  useEffect(() => {
    fetch('/api/routers').then(r => r.json()).then(d => {
      const online = d.filter((r: RouterConfig) => r.status === 'online');
      setRouters(online);
      if (online.length > 0) setSelectedRouterId(online[0].id);
      else setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const fetchRouting = useCallback(async (routerId: string) => {
    if (!routerId) return;
    setFetching(true); setError(null);
    try {
      const res = await fetch(`/api/routers/${routerId}/routing?section=all`);
      if (res.ok) {
        setData(await res.json());
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to fetch routing data.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRouterId) fetchRouting(selectedRouterId);
  }, [selectedRouterId, fetchRouting]);

  const filteredRoutes = data?.routeTable?.routes.filter(r =>
    !routeSearch ||
    r.dstAddress.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.gateway.toLowerCase().includes(routeSearch.toLowerCase()) ||
    r.interface.toLowerCase().includes(routeSearch.toLowerCase())
  ) || [];

  const bgpEstablished = data?.bgpSessions?.filter(s => s.state === 'established' || s.state === 'running') || [];
  const ospfFull = data?.ospfNeighbors?.filter(n => n.state === 'Full' || n.state === 'full') || [];

  const stateColor = (state: string) => {
    const s = state.toLowerCase();
    if (s === 'established' || s === 'running' || s === 'full') return 'var(--online)';
    if (s === 'connecting' || s === 'active' || s === 'init') return 'var(--warning)';
    if (s === 'idle' || s === 'down') return 'var(--offline)';
    return 'var(--text-3)';
  };

  const typeBadge = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'connected') return <span className="badge badge-cyan" style={{ fontSize: '0.6rem' }}>C</span>;
    if (t === 'static') return <span className="badge badge-purple" style={{ fontSize: '0.6rem' }}>S</span>;
    if (t === 'dynamic' || t === 'active') return <span className="badge badge-online" style={{ fontSize: '0.6rem' }}>D</span>;
    if (t === 'blackhole') return <span className="badge badge-offline" style={{ fontSize: '0.6rem' }}>B</span>;
    return <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>{type[0]?.toUpperCase()}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Routing & BGP/OSPF</h1>
          <p className="page-subtitle">Dynamic routing protocols, BGP sessions, and route table viewer</p>
        </div>
        <div className="flex gap-2 items-center">
          <select
            className="form-select"
            style={{ width: 220 }}
            value={selectedRouterId}
            onChange={e => setSelectedRouterId(e.target.value)}
            disabled={fetching}
          >
            {routers.map(r => (
              <option key={r.id} value={r.id}>{r.name} ({r.host})</option>
            ))}
          </select>
          <button
            className="btn btn-secondary"
            onClick={() => fetchRouting(selectedRouterId)}
            disabled={!selectedRouterId || fetching}
          >
            <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}>
          <RefreshCw size={13} className="animate-spin" /> Loading routers…
        </div>
      ) : routers.length === 0 ? (
        <div className="glass-card empty-state">
          <Globe size={32} opacity={0.2} />
          <p>No online routers available.</p>
        </div>
      ) : error ? (
        <div className="alert-banner danger mb-2"><AlertCircle size={15} />{error}</div>
      ) : (
        <>
          {/* Header Stats */}
          <div className="grid-stats">
            <div className="stat-card" style={{ '--accent-line': 'var(--purple)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--purple-dim)' }}>
                <Globe size={15} color="var(--purple)" />
              </div>
              <div className="stat-label">BGP Sessions</div>
              <div className="stat-value" style={{ color: 'var(--purple)' }}>
                {bgpEstablished.length}<span style={{ fontSize: '1rem', color: 'var(--text-3)', fontWeight: 400 }}> / {data?.bgpSessions?.length || 0}</span>
              </div>
              <div className="stat-desc">{bgpEstablished.length === (data?.bgpSessions?.length || 0) ? 'All established' : `${(data?.bgpSessions?.length || 0) - bgpEstablished.length} non-established`}</div>
            </div>
            <div className="stat-card" style={{ '--accent-line': 'var(--cyan)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--cyan-dim)' }}>
                <Wifi size={15} color="var(--cyan)" />
              </div>
              <div className="stat-label">OSPF Neighbors</div>
              <div className="stat-value" style={{ color: 'var(--cyan)' }}>
                {ospfFull.length}<span style={{ fontSize: '1rem', color: 'var(--text-3)', fontWeight: 400 }}> / {data?.ospfNeighbors?.length || 0}</span>
              </div>
              <div className="stat-desc">Full adjacencies</div>
            </div>
            <div className="stat-card" style={{ '--accent-line': 'var(--teal)' } as React.CSSProperties}>
              <div className="stat-icon" style={{ background: 'var(--teal-dim)' }}>
                <Route size={15} color="var(--teal)" />
              </div>
              <div className="stat-label">Route Table</div>
              <div className="stat-value" style={{ color: 'var(--teal)' }}>{data?.routeTable?.total || 0}</div>
              <div className="stat-desc">{data?.routeTable?.routes.filter(r => r.dynamic).length || 0} dynamic · {data?.routeTable?.routes.filter(r => !r.dynamic).length || 0} static</div>
            </div>
          </div>

          {/* Tab navigation */}
          <div className="glass-card mb-2" style={{ padding: '0.5rem 0.75rem', display: 'flex', gap: '0.25rem' }}>
            {([
              { key: 'bgp', label: 'BGP Sessions', icon: Globe },
              { key: 'ospf', label: 'OSPF Neighbors', icon: Network },
              { key: 'routes', label: 'Route Table', icon: Route },
            ] as const).map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setActiveTab(tab.key)}
                  style={{ borderRadius: 8, padding: '0.4rem 0.875rem' }}
                >
                  <Icon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* BGP Tab */}
          {activeTab === 'bgp' && (
            <div className="glass-card glow-purple">
              <div className="section-title">
                <div className="section-icon" style={{ background: 'var(--purple-dim)' }}>
                  <Globe size={12} color="var(--purple)" />
                </div>
                BGP Peer Sessions
              </div>
              {data?.bgpError ? (
                <div className="empty-state">
                  <HelpCircle size={24} opacity={0.2} />
                  <span>{data.bgpError}</span>
                </div>
              ) : !data?.bgpSessions?.length ? (
                <div className="empty-state">
                  <Globe size={24} opacity={0.2} />
                  <span>No BGP sessions configured.</span>
                </div>
              ) : (
                <div className="table-container">
                  <table className="glass-table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Remote AS</th>
                        <th>Remote Address</th>
                        <th>Local Address</th>
                        <th>State</th>
                        <th>Uptime</th>
                        <th>Prefixes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bgpSessions.map((s, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 600 }}>{s.name}</td>
                          <td className="mono" style={{ color: 'var(--text-2)' }}>{s.remoteAs}</td>
                          <td className="mono" style={{ color: 'var(--teal)' }}>{s.remoteAddress}</td>
                          <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{s.localAddress || '—'}</td>
                          <td>
                            <div className="flex gap-1 items-center">
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateColor(s.state), display: 'inline-block' }} />
                              <span className="mono" style={{ color: stateColor(s.state), fontWeight: 600, textTransform: 'capitalize' }}>
                                {s.state}
                              </span>
                            </div>
                          </td>
                          <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{s.uptime || '—'}</td>
                          <td className="mono" style={{ fontWeight: 700 }}>{s.prefixCount ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* OSPF Tab */}
          {activeTab === 'ospf' && (
            <div className="grid-2" style={{ gap: '1.25rem' }}>
              <div className="glass-card glow-cyan">
                <div className="section-title">
                  <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
                    <Network size={12} color="var(--cyan)" />
                  </div>
                  OSPF Neighbors
                </div>
                {data?.ospfError ? (
                  <div className="empty-state">
                    <HelpCircle size={24} opacity={0.2} />
                    <span>{data.ospfError}</span>
                  </div>
                ) : !data?.ospfNeighbors?.length ? (
                  <div className="empty-state">
                    <Network size={24} opacity={0.2} />
                    <span>No OSPF neighbors discovered.</span>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Router ID</th>
                          <th>Address</th>
                          <th>Interface</th>
                          <th>State</th>
                          <th>Priority</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ospfNeighbors.map((n, i) => (
                          <tr key={i}>
                            <td className="mono" style={{ color: 'var(--purple)', fontWeight: 600 }}>{n.routerId}</td>
                            <td className="mono" style={{ color: 'var(--teal)' }}>{n.address}</td>
                            <td style={{ color: 'var(--text-2)' }}>{n.interface}</td>
                            <td>
                              <div className="flex gap-1 items-center">
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: stateColor(n.state), display: 'inline-block' }} />
                                <span className="mono" style={{ color: stateColor(n.state), fontWeight: 600 }}>
                                  {n.state}
                                </span>
                              </div>
                            </td>
                            <td className="mono" style={{ color: 'var(--text-2)' }}>{n.priority ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="glass-card glow-purple">
                <div className="section-title">
                  <div className="section-icon" style={{ background: 'var(--purple-dim)' }}>
                    <Radio size={12} color="var(--purple)" />
                  </div>
                  OSPF Interfaces
                </div>
                {!data?.ospfInterfaces?.length ? (
                  <div className="empty-state">
                    <Radio size={24} opacity={0.2} />
                    <span>No OSPF interfaces configured.</span>
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="glass-table">
                      <thead>
                        <tr>
                          <th>Interface</th>
                          <th>Area</th>
                          <th>State</th>
                          <th>Cost</th>
                          <th>Type</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.ospfInterfaces.map((iface, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{iface.name}</td>
                            <td className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-2)' }}>{iface.area}</td>
                            <td>
                              <span className={`badge badge-${iface.state === 'dr' || iface.state === 'bdr' ? 'cyan' : iface.passive ? 'warning' : 'purple'}`} style={{ fontSize: '0.6rem' }}>
                                {iface.state}{iface.passive ? ' (passive)' : ''}
                              </span>
                            </td>
                            <td className="mono" style={{ fontWeight: 700 }}>{iface.cost}</td>
                            <td style={{ color: 'var(--text-2)' }}>{iface.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Route Table Tab */}
          {activeTab === 'routes' && (
            <div className="glass-card glow-cyan">
              <div className="flex justify-between items-center mb-2" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>
                  <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
                    <Route size={12} color="var(--cyan)" />
                  </div>
                  IP Route Table ({filteredRoutes.length} of {data?.routeTable?.total || 0} routes)
                </div>
                <div className="search-wrap" style={{ width: 260 }}>
                  <Search size={12} className="search-icon" />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search destination, gateway, interface…"
                    value={routeSearch}
                    onChange={e => setRouteSearch(e.target.value)}
                    style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem 0.4rem 2rem' }}
                  />
                </div>
              </div>

              {!data?.routeTable?.routes.length ? (
                <div className="empty-state">
                  <Route size={24} opacity={0.2} />
                  <span>No routes found.</span>
                </div>
              ) : filteredRoutes.length === 0 ? (
                <div className="empty-state">
                  <Search size={20} opacity={0.2} />
                  <span>No routes match your search.</span>
                </div>
              ) : (
                <div className="table-container" style={{ maxHeight: 520, overflowY: 'auto' }}>
                  <table className="glass-table">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                      <tr>
                        <th style={{ width: 30 }}>#</th>
                        <th>Destination</th>
                        <th>Gateway</th>
                        <th>Interface</th>
                        <th>Distance</th>
                        <th>Routing Mark</th>
                        <th>Type</th>
                        <th>Comment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredRoutes.map((r, i) => (
                        <tr key={i}>
                          <td className="mono" style={{ color: 'var(--text-4)', fontSize: '0.7rem' }}>{i + 1}</td>
                          <td className="mono" style={{ fontWeight: 600, color: 'var(--text-1)' }}>{r.dstAddress}</td>
                          <td className="mono" style={{ color: 'var(--teal)' }}>{r.gateway}</td>
                          <td style={{ color: 'var(--text-2)' }}>{r.interface}</td>
                          <td className="mono">{r.distance}</td>
                          <td className="mono" style={{ fontSize: '0.7rem', color: 'var(--text-2)' }}>{r.routingMark}</td>
                          <td>{typeBadge(r.type)}</td>
                          <td style={{ fontSize: '0.7rem', color: 'var(--text-3)', maxWidth: 180 }} className="truncate">
                            {r.comment || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
