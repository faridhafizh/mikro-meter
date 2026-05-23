'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  RefreshCw,
  Activity,
  ArrowDown,
  ArrowUp,
  AlertCircle,
  HelpCircle,
  Network,
  Cable,
  Wifi,
  GitMerge,
  EthernetPort,
  Radio,
  ChevronDown,
  ChevronRight,
  XCircle,
} from 'lucide-react';
import InterfaceChart from '@/components/InterfaceChart';

interface RouterConfig {
  id: string;
  name: string;
  host: string;
  status: string;
}

interface InterfaceInfo {
  name: string;
  type: string;
  status: 'up' | 'down' | 'disabled';
  speed: string;
  duplex: string;
  mtu: number;
  mac: string;
  rxBps: number;
  txBps: number;
  rxErrors?: number;
  txErrors?: number;
  rxDrop?: number;
  txDrop?: number;
}

interface HistoryPoint {
  timestamp: string;
  rxBps: number;
  txBps: number;
}

const TYPE_ICONS: Record<string, typeof Network> = {
  ether: Cable,
  wlan: Wifi,
  bridge: GitMerge,
  vlan: EthernetPort,
  pppoe: Radio,
  l2tp: Radio,
  sstp: Radio,
  ovpn: Radio,
  wireguard: Radio,
};

const TYPE_COLORS: Record<string, string> = {
  ether: 'var(--cyan)',
  wlan: 'var(--teal)',
  bridge: 'var(--purple)',
  vlan: 'var(--amber)',
  pppoe: 'var(--pink)',
  l2tp: 'var(--pink)',
  sstp: 'var(--pink)',
  wireguard: 'var(--teal)',
};

function getTypeIcon(type: string) {
  const key = Object.keys(TYPE_ICONS).find(k => type.startsWith(k));
  return key ? TYPE_ICONS[key] : Network;
}

function getTypeColor(type: string) {
  const key = Object.keys(TYPE_COLORS).find(k => type.startsWith(k));
  return key ? TYPE_COLORS[key] : 'var(--text-3)';
}

function fmtBps(bps: number) {
  if (bps >= 1_000_000_000) return `${(bps / 1_000_000_000).toFixed(2)} Gbps`;
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toFixed(1)} Mbps`;
  if (bps >= 1_000) return `${(bps / 1_000).toFixed(0)} Kbps`;
  return `${bps} bps`;
}

export default function InterfacesPage() {
  const [routers, setRouters] = useState<RouterConfig[]>([]);
  const [selectedRouterId, setSelectedRouterId] = useState('');
  const [interfaces, setInterfaces] = useState<InterfaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedIface, setExpandedIface] = useState<string | null>(null);
  const [chartData, setChartData] = useState<HistoryPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [timeRange, setTimeRange] = useState('default');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetch('/api/routers')
      .then(r => r.json())
      .then(d => {
        const online = d.filter((r: RouterConfig) => r.status === 'online');
        setRouters(online);
        if (online.length > 0) setSelectedRouterId(online[0].id);
        else setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchInterfaces = useCallback(async (routerId: string) => {
    if (!routerId) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/routers/${routerId}/interfaces`);
      if (res.ok) {
        const d = await res.json();
        setInterfaces(d.interfaces || []);
      } else {
        const d = await res.json();
        setError(d.error || 'Failed to fetch interfaces.');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setFetching(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRouterId) fetchInterfaces(selectedRouterId);
  }, [selectedRouterId, fetchInterfaces]);

  const fetchChart = async (ifaceName: string) => {
    if (!selectedRouterId) return;
    setChartLoading(true);
    try {
      const rangeParam = timeRange !== 'default' ? `?range=${timeRange}` : '';
      const res = await fetch(
        `/api/routers/${selectedRouterId}/interfaces/${encodeURIComponent(ifaceName)}/history${rangeParam}`
      );
      if (res.ok) {
        const d = await res.json();
        setChartData(d.history || []);
      }
    } catch {
      // ignore
    } finally {
      setChartLoading(false);
    }
  };

  const handleExpand = (name: string) => {
    if (expandedIface === name) {
      setExpandedIface(null);
      setChartData([]);
    } else {
      setExpandedIface(name);
      fetchChart(name);
    }
  };

  const filtered = search
    ? interfaces.filter(
        i =>
          i.name.toLowerCase().includes(search.toLowerCase()) ||
          i.type.toLowerCase().includes(search.toLowerCase())
      )
    : interfaces;

  const onlineCount = interfaces.filter(i => i.status === 'up').length;
  const totalRx = interfaces.reduce((a, i) => a + i.rxBps, 0);
  const totalTx = interfaces.reduce((a, i) => a + i.txBps, 0);
  const totalErrors = interfaces.reduce(
    (a, i) => a + (i.rxErrors || 0) + (i.txErrors || 0),
    0
  );
  const disabledCount = interfaces.filter(i => i.status === 'disabled').length;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Interface Dashboard</h1>
          <p className="page-subtitle">
            Real-time interface stats, traffic graphs, and error monitoring
          </p>
        </div>
        <div className="flex gap-2 items-center">
          {routers.length > 0 && (
            <>
              <select
                className="form-select"
                style={{ width: 220 }}
                value={selectedRouterId}
                onChange={e => setSelectedRouterId(e.target.value)}
                disabled={fetching}
              >
                {routers.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.host})
                  </option>
                ))}
              </select>
              <select
                className="form-select"
                style={{ width: 120 }}
                value={timeRange}
                onChange={e => {
                  setTimeRange(e.target.value);
                  if (expandedIface) fetchChart(expandedIface);
                }}
              >
                <option value="default">Live (30 pts)</option>
                <option value="1h">Last Hour</option>
                <option value="6h">Last 6 Hours</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
              </select>
            </>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => fetchInterfaces(selectedRouterId)}
            disabled={!selectedRouterId || fetching}
          >
            <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
            {fetching ? 'Fetching…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading ? (
        <div
          style={{
            color: 'var(--text-2)',
            display: 'flex',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <RefreshCw size={13} className="animate-spin" /> Loading…
        </div>
      ) : routers.length === 0 ? (
        <div className="glass-card empty-state">
          <Network size={32} opacity={0.2} />
          <p>No online routers available.</p>
          <span>Connect a router to view its interfaces.</span>
        </div>
      ) : (
        <>
          {error && (
            <div className="alert-banner danger mb-2">
              <AlertCircle size={15} />
              {error}
            </div>
          )}

          <div className="grid-stats">
            <div
              className="stat-card"
              style={{ '--accent-line': 'var(--cyan)' } as React.CSSProperties}
            >
              <div
                className="stat-icon"
                style={{ background: 'var(--cyan-dim)' }}
              >
                <Cable size={15} color="var(--cyan)" />
              </div>
              <div className="stat-label">Interfaces</div>
              <div className="stat-value" style={{ color: 'var(--cyan)' }}>
                {onlineCount}
                <span
                  style={{
                    fontSize: '1rem',
                    color: 'var(--text-3)',
                    fontWeight: 400,
                  }}
                >
                  {' '}
                  / {interfaces.length}
                </span>
              </div>
              <div className="stat-desc">
                {disabledCount > 0
                  ? `${disabledCount} disabled`
                  : 'All enabled'}
              </div>
            </div>

            <div
              className="stat-card"
              style={{ '--accent-line': 'var(--teal)' } as React.CSSProperties}
            >
              <div
                className="stat-icon"
                style={{ background: 'var(--teal-dim)' }}
              >
                <ArrowDown size={15} color="var(--teal)" />
              </div>
              <div className="stat-label">Total Inbound</div>
              <div className="stat-value" style={{ color: 'var(--teal)' }}>
                {fmtBps(totalRx)}
              </div>
              <div className="stat-desc">Aggregate receive</div>
            </div>

            <div
              className="stat-card"
              style={
                { '--accent-line': 'var(--purple)' } as React.CSSProperties
              }
            >
              <div
                className="stat-icon"
                style={{ background: 'var(--purple-dim)' }}
              >
                <ArrowUp size={15} color="var(--purple)" />
              </div>
              <div className="stat-label">Total Outbound</div>
              <div className="stat-value" style={{ color: 'var(--purple)' }}>
                {fmtBps(totalTx)}
              </div>
              <div className="stat-desc">Aggregate transmit</div>
            </div>

            <div
              className="stat-card"
              style={
                {
                  '--accent-line':
                    totalErrors > 0 ? 'var(--warning)' : 'var(--text-3)',
                } as React.CSSProperties
              }
            >
              <div
                className="stat-icon"
                style={{
                  background:
                    totalErrors > 0
                      ? 'var(--warning-dim)'
                      : 'rgba(255,255,255,0.04)',
                }}
              >
                <XCircle
                  size={15}
                  color={totalErrors > 0 ? 'var(--warning)' : 'var(--text-3)'}
                />
              </div>
              <div className="stat-label">Errors</div>
              <div className="stat-value" style={{ color: 'var(--text-1)' }}>
                {totalErrors > 0 ? totalErrors : '0'}
              </div>
              <div className="stat-desc">
                {totalErrors > 0
                  ? 'Interfaces with errors'
                  : 'No errors detected'}
              </div>
            </div>
          </div>

          <div className="search-wrap" style={{ width: 320, marginBottom: '1rem' }}>
            <Activity size={12} className="search-icon" />
            <input
              type="text"
              className="form-input"
              placeholder="Search interfaces by name or type…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.75rem 0.4rem 2rem' }}
            />
          </div>

          {filtered.length === 0 ? (
            <div className="glass-card empty-state">
              <HelpCircle size={24} opacity={0.2} />
              <span>No interfaces match your search.</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {filtered.map(iface => {
                const TypeIcon = getTypeIcon(iface.type);
                const typeColor = getTypeColor(iface.type);
                const isExpanded = expandedIface === iface.name;

                return (
                  <div key={iface.name} className="glass-card" style={{ padding: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '1rem 1.25rem',
                        cursor: 'pointer',
                        transition: 'var(--ease)',
                      }}
                      onClick={() => handleExpand(iface.name)}
                    >
                      <div
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          background: `${typeColor}15`,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        <TypeIcon size={13} color={typeColor} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '0.875rem',
                              color: 'var(--text-1)',
                            }}
                          >
                            {iface.name}
                          </span>
                          <span
                            className="tag"
                            style={{
                              fontSize: '0.6rem',
                              color: typeColor,
                              borderColor: `${typeColor}30`,
                              background: `${typeColor}10`,
                            }}
                          >
                            {iface.type}
                          </span>
                          <span
                            className={`badge badge-${
                              iface.status === 'up'
                                ? 'online'
                                : iface.status === 'disabled'
                                ? 'warning'
                                : 'offline'
                            }`}
                            style={{ fontSize: '0.55rem' }}
                          >
                            <span
                              className={`dot dot-${
                                iface.status === 'up'
                                  ? 'online'
                                  : iface.status === 'disabled'
                                  ? 'warning'
                                  : 'offline'
                              }`}
                            />
                            {iface.status}
                          </span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            gap: '1rem',
                            marginTop: 4,
                            fontSize: '0.7rem',
                            color: 'var(--text-3)',
                          }}
                        >
                          <span>
                            Speed:{' '}
                            <span className="mono" style={{ color: 'var(--text-2)' }}>
                              {iface.speed}
                            </span>
                          </span>
                          {iface.duplex !== 'N/A' && (
                            <span>
                              Duplex:{' '}
                              <span className="mono" style={{ color: 'var(--text-2)' }}>
                                {iface.duplex}
                              </span>
                            </span>
                          )}
                          <span className="mono" style={{ fontSize: '0.65rem' }}>
                            MTU {iface.mtu}
                          </span>
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--cyan)',
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          <ArrowDown
                            size={10}
                            style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }}
                          />
                          {fmtBps(iface.rxBps)}
                        </div>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            color: 'var(--purple)',
                            fontFamily: "'JetBrains Mono', monospace",
                            marginTop: 2,
                          }}
                        >
                          <ArrowUp
                            size={10}
                            style={{ display: 'inline', verticalAlign: 'middle', marginRight: 2 }}
                          />
                          {fmtBps(iface.txBps)}
                        </div>
                      </div>

                      {(iface.rxErrors || iface.txErrors) &&
                        (iface.rxErrors! > 0 || iface.txErrors! > 0) && (
                          <div
                            className="badge badge-warning"
                            style={{ fontSize: '0.6rem', flexShrink: 0 }}
                            title={`Rx Errors: ${iface.rxErrors}, Tx Errors: ${iface.txErrors}`}
                          >
                            {iface.rxErrors! + iface.txErrors!} err
                          </div>
                        )}

                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 6,
                          background: 'rgba(255,255,255,0.04)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          transition: 'var(--ease)',
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown size={12} color="var(--text-2)" />
                        ) : (
                          <ChevronRight size={12} color="var(--text-2)" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        style={{
                          borderTop: '1px solid var(--border)',
                          padding: '1rem 1.25rem 1.25rem',
                        }}
                      >
                        {chartLoading ? (
                          <div
                            style={{
                              height: 140,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                              color: 'var(--text-3)',
                            }}
                          >
                            <RefreshCw size={13} className="animate-spin" />{' '}
                            Loading chart…
                          </div>
                        ) : (
                          <InterfaceChart
                            data={chartData}
                            ifaceName={iface.name}
                          />
                        )}

                        <div
                          className="flex gap-2"
                          style={{
                            marginTop: '0.75rem',
                            fontSize: '0.7rem',
                            color: 'var(--text-3)',
                            flexWrap: 'wrap',
                          }}
                        >
                          <span className="mono" style={{ fontSize: '0.65rem' }}>
                            MAC: {iface.mac}
                          </span>
                          {iface.rxDrop !== undefined && (
                            <span>
                              Drop (Rx/Tx):{' '}
                              <span className="mono">{iface.rxDrop}</span> /{' '}
                              <span className="mono">{iface.txDrop}</span>
                            </span>
                          )}
                          {iface.rxErrors !== undefined && (
                            <span>
                              Errors (Rx/Tx):{' '}
                              <span
                                className="mono"
                                style={{
                                  color:
                                    iface.rxErrors! > 0
                                      ? 'var(--warning)'
                                      : 'var(--text-3)',
                                }}
                              >
                                {iface.rxErrors}
                              </span>{' '}
                              /{' '}
                              <span
                                className="mono"
                                style={{
                                  color:
                                    iface.txErrors! > 0
                                      ? 'var(--warning)'
                                      : 'var(--text-3)',
                                }}
                              >
                                {iface.txErrors}
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
