'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';

interface DataPoint {
  timestamp: string;
  rxBps: number;
  txBps: number;
}

interface Props {
  data: DataPoint[];
  ifaceName: string;
}

export default function InterfaceChart({ data }: Props) {
  if (data.length < 2) {
    return (
      <div className="empty-state" style={{ height: 160, padding: '1rem' }}>
        <span>Waiting for traffic data…</span>
      </div>
    );
  }

  const W = 600, H = 140, P = 16;
  const cW = W - P * 2, cH = H - P * 2;

  const rxVals = data.map(p => p.rxBps);
  const txVals = data.map(p => p.txBps);
  const maxVal = Math.max(...rxVals, ...txVals, 1_000_000);
  const n = data.length;

  const coords = (vals: number[]) =>
    vals.map((v, i) => ({
      x: P + (i / (n - 1)) * cW,
      y: P + cH - (v / maxVal) * cH,
    }));

  const path = (pts: { x: number; y: number }[]) =>
    pts.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');

  const area = (pts: { x: number; y: number }[]) =>
    `${path(pts)} L ${pts[pts.length - 1].x} ${H - P} L ${pts[0].x} ${H - P} Z`;

  const rx = coords(rxVals);
  const tx = coords(txVals);

  const fmtMbps = (bps: number) => `${(bps / 1_000_000).toFixed(1)}`;

  return (
    <div>
      <div
        className="flex justify-between items-center mb-1"
        style={{ fontSize: '0.7rem', color: 'var(--text-3)' }}
      >
        <span>
          Max: <span className="mono" style={{ color: 'var(--text-1)', fontWeight: 700 }}>{fmtMbps(maxVal)}</span> Mbps
        </span>
        <div className="flex gap-2">
          <span
            style={{
              color: 'var(--cyan)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.65rem',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 8,
                height: 2,
                background: 'var(--cyan)',
                display: 'inline-block',
                borderRadius: 2,
                boxShadow: '0 0 4px var(--cyan-glow)',
              }}
            />
            <ArrowDown size={9} /> Rx
          </span>
          <span
            style={{
              color: 'var(--purple)',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: '0.65rem',
              fontWeight: 600,
            }}
          >
            <span
              style={{
                width: 8,
                height: 2,
                background: 'var(--purple)',
                display: 'inline-block',
                borderRadius: 2,
                boxShadow: '0 0 4px var(--purple-glow)',
              }}
            />
            <ArrowUp size={9} /> Tx
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{
          width: '100%',
          height: 'auto',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: 8,
          border: '1px solid rgba(255,255,255,0.03)',
        }}
      >
        <line x1={P} y1={P} x2={W - P} y2={P} stroke="rgba(255,255,255,0.03)" />
        <line x1={P} y1={P + cH / 2} x2={W - P} y2={P + cH / 2} stroke="rgba(255,255,255,0.03)" />
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="rgba(255,255,255,0.06)" />
        <path d={area(rx)} fill="url(#rxGrad)" />
        <path d={area(tx)} fill="url(#txGrad)" />
        <path
          d={path(rx)}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
        <path
          d={path(tx)}
          fill="none"
          stroke="var(--purple)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#glow)"
        />
        {rx.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2" fill="var(--cyan)" stroke="var(--depth-2)" strokeWidth="1" />
        ))}
        {tx.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r="2" fill="var(--purple)" stroke="var(--depth-2)" strokeWidth="1" />
        ))}
        <defs>
          <linearGradient id="rxGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--cyan)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--cyan)" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="txGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--purple)" stopOpacity="0.12" />
            <stop offset="100%" stopColor="var(--purple)" stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="1.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>
    </div>
  );
}
