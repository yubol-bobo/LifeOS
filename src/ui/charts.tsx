import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Attr } from '../store/types';
import { parseDay } from '../lib/date';
import { toneVar } from './kit';

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    setW(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** Monotone-ish smooth path through points (Catmull-Rom → cubic Bézier, clamped). */
function smooth(pts: [number, number][]) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const t = 0.18;
    const c1x = p1[0] + (p2[0] - p0[0]) * t;
    const c2x = p2[0] - (p3[0] - p1[0]) * t;
    const lo = Math.min(p1[1], p2[1]);
    const hi = Math.max(p1[1], p2[1]);
    const c1y = Math.min(hi, Math.max(lo, p1[1] + (p2[1] - p0[1]) * t));
    const c2y = Math.min(hi, Math.max(lo, p2[1] - (p3[1] - p1[1]) * t));
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function niceTicks(max: number, count = 3) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out: number[] = [];
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}

const fmtTick = (v: number) => (v >= 10000 ? `${+(v / 1000).toFixed(1)}K` : v.toLocaleString());

/* ------------------------------------------------------------------ */

export interface Point {
  x: string; // label
  y: number;
}

export function AreaChart({
  data,
  tone = 'accent',
  height = 180,
  format = (v: number) => v.toLocaleString(),
  baseline = 'zero',
}: {
  data: Point[];
  tone?: Attr | 'accent' | 'gold';
  height?: number;
  format?: (v: number) => string;
  baseline?: 'zero' | 'auto';
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 40, r: 12, t: 14, b: 24 };
  const iw = Math.max(10, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const ys = data.map((d) => d.y);
  const rawMin = baseline === 'zero' ? 0 : Math.min(...ys);
  const rawMax = Math.max(1, ...ys);
  const span = rawMax - rawMin || 1;
  const min = baseline === 'zero' ? 0 : Math.floor(rawMin - span * 0.15);
  const ticks = baseline === 'zero' ? niceTicks(rawMax) : niceTicks(rawMax - min).map((t) => t + min);
  const max = ticks[ticks.length - 1];
  const sx = (i: number) => pad.l + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const sy = (v: number) => pad.t + ih - ((v - min) / (max - min || 1)) * ih;
  const pts = data.map((d, i) => [sx(i), sy(d.y)] as [number, number]);
  const line = smooth(pts);
  const area = pts.length ? `${line} L${pts[pts.length - 1][0]},${pad.t + ih} L${pts[0][0]},${pad.t + ih} Z` : '';
  const labelIdx = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];
  const color = toneVar(tone);
  const last = pts[pts.length - 1];

  return (
    <div ref={ref} className="chart" style={{ height, '--tone': color } as CSSProperties}>
      {w > 0 && data.length > 0 && (
        <svg
          width={w}
          height={height}
          onPointerMove={(e) => {
            const r = (e.currentTarget as SVGElement).getBoundingClientRect();
            const x = e.clientX - r.left - pad.l;
            const i = Math.round((x / iw) * (data.length - 1));
            setHover(Math.max(0, Math.min(data.length - 1, i)));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} className="grid" />
              <text x={pad.l - 8} y={sy(t)} className="tick" textAnchor="end" dominantBaseline="middle">
                {fmtTick(Math.round(t))}
              </text>
            </g>
          ))}
          {labelIdx.map((i) => (
            <text key={i} x={sx(i)} y={height - 6} className="tick" textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}>
              {data[i].x}
            </text>
          ))}
          <path d={area} className="area" />
          <path d={line} className="line" />
          {last && hover == null && <circle cx={last[0]} cy={last[1]} r={4.5} className="dot" />}
          {hover != null && (
            <>
              <line x1={pts[hover][0]} x2={pts[hover][0]} y1={pad.t} y2={pad.t + ih} className="cross" />
              <circle cx={pts[hover][0]} cy={pts[hover][1]} r={5} className="dot" />
            </>
          )}
        </svg>
      )}
      {hover != null && data[hover] && (
        <div className="tip" style={{ left: Math.min(w - 120, Math.max(0, pts[hover][0] - 60)), top: Math.max(0, pts[hover][1] - 58) }}>
          <span className="tip-k">{data[hover].x}</span>
          <span className="tip-v num">{format(data[hover].y)}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Columns({
  data,
  tone = 'accent',
  height = 160,
  format = (v: number) => v.toLocaleString(),
  highlightLast = true,
}: {
  data: Point[];
  tone?: Attr | 'accent' | 'gold';
  height?: number;
  format?: (v: number) => string;
  highlightLast?: boolean;
}) {
  const [ref, w] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 36, r: 6, t: 18, b: 22 };
  const iw = Math.max(10, w - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const ticks = niceTicks(Math.max(1, ...data.map((d) => d.y)));
  const max = ticks[ticks.length - 1];
  const band = iw / Math.max(1, data.length);
  const bw = Math.min(24, band * 0.62);
  const sy = (v: number) => pad.t + ih - (v / max) * ih;
  const color = toneVar(tone);
  return (
    <div ref={ref} className="chart" style={{ height, '--tone': color } as CSSProperties}>
      {w > 0 && (
        <svg width={w} height={height} onPointerLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={w - pad.r} y1={sy(t)} y2={sy(t)} className="grid" />
              <text x={pad.l - 8} y={sy(t)} className="tick" textAnchor="end" dominantBaseline="middle">
                {fmtTick(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const x = pad.l + band * i + (band - bw) / 2;
            const y = sy(d.y);
            const h = Math.max(0, pad.t + ih - y);
            const r = Math.min(4, h);
            const isLast = highlightLast && i === data.length - 1;
            return (
              <g key={i} onPointerEnter={() => setHover(i)}>
                <rect x={pad.l + band * i} y={pad.t} width={band} height={ih} fill="transparent" />
                {h > 0 && (
                  <path
                    className={`col ${isLast ? 'is-last' : ''} ${hover === i ? 'is-hover' : ''}`}
                    d={`M${x},${pad.t + ih} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + bw - r},${y} Q${x + bw},${y} ${x + bw},${y + r} L${x + bw},${pad.t + ih} Z`}
                  />
                )}
                <text x={x + bw / 2} y={height - 6} className="tick" textAnchor="middle">
                  {d.x}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover != null && data[hover] && (
        <div className="tip" style={{ left: Math.min(w - 120, Math.max(0, pad.l + band * hover + band / 2 - 60)), top: Math.max(0, sy(data[hover].y) - 58) }}>
          <span className="tip-k">{data[hover].x}</span>
          <span className="tip-v num">{format(data[hover].y)}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Sparkline({ values, tone = 'accent', width = 120, height = 36 }: { values: number[]; tone?: Attr | 'accent' | 'gold'; width?: number; height?: number }) {
  if (values.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pts = values.map((v, i) => [2 + (i / (values.length - 1)) * (width - 8), 3 + (1 - (v - min) / (max - min || 1)) * (height - 8)] as [number, number]);
  const d = smooth(pts);
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} className="spark" style={{ '--tone': toneVar(tone) } as CSSProperties} aria-hidden>
      <path d={`${d} L${last[0]},${height} L${pts[0][0]},${height} Z`} className="area" />
      <path d={d} className="line" />
      <circle cx={last[0]} cy={last[1]} r={3.5} className="dot" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */

export function Heatmap({
  days,
  value,
  max,
  label,
  weeks = 20,
}: {
  days: string[]; // chronological day keys, ending today
  value: (day: string) => number;
  max: number;
  label: (day: string, v: number) => ReactNode;
  weeks?: number;
}) {
  const [tip, setTip] = useState<{ x: number; y: number; body: ReactNode } | null>(null);
  const cols = useMemo(() => {
    // Align so the last column ends on today; rows are Mon..Sun.
    const last = days[days.length - 1];
    const lastDow = (parseDay(last).getDay() + 6) % 7;
    const total = weeks * 7 - (6 - lastDow);
    const slice = days.slice(-total);
    const out: (string | null)[][] = [];
    let col: (string | null)[] = [];
    const firstDow = (7 + lastDow - ((slice.length - 1) % 7)) % 7;
    for (let i = 0; i < firstDow; i++) col.push(null);
    for (const d of slice) {
      col.push(d);
      if (col.length === 7) {
        out.push(col);
        col = [];
      }
    }
    if (col.length) out.push([...col, ...Array(7 - col.length).fill(null)]);
    return out;
  }, [days, weeks]);
  return (
    <div className="heat" onPointerLeave={() => setTip(null)}>
      {cols.map((c, i) => (
        <div className="heat-col" key={i}>
          {c.map((d, j) => {
            if (!d) return <span key={j} className="heat-cell is-void" />;
            const v = value(d);
            const lvl = v <= 0 ? 0 : Math.min(4, Math.ceil((v / Math.max(1, max)) * 4));
            return (
              <span
                key={j}
                className={`heat-cell l${lvl}`}
                onPointerEnter={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const p = (e.currentTarget.parentElement!.parentElement as HTMLElement).getBoundingClientRect();
                  setTip({ x: r.left - p.left + r.width / 2, y: r.top - p.top, body: label(d, v) });
                }}
              />
            );
          })}
        </div>
      ))}
      {tip && (
        <div className="tip tip-center" style={{ left: tip.x, top: tip.y - 8 }}>
          {tip.body}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function Radar({ axes, size = 240 }: { axes: { key: Attr; label: string; value: number; display: string }[]; size?: number }) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size / 2 - 38;
  const n = axes.length;
  const max = Math.max(1, ...axes.map((a) => a.value));
  const ang = (i: number) => -Math.PI / 2 + (i / n) * Math.PI * 2;
  const pt = (i: number, r: number) => [cx + Math.cos(ang(i)) * r, cy + Math.sin(ang(i)) * r];
  const poly = axes.map((a, i) => pt(i, R * (0.12 + 0.88 * (a.value / max))).join(',')).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${size} ${size}`} className="radar" role="img" aria-label={axes.map((a) => `${a.label} ${a.display}`).join(', ')}>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon key={f} className="radar-web" points={axes.map((_, i) => pt(i, R * f).join(',')).join(' ')} />
      ))}
      {axes.map((_, i) => {
        const [x, y] = pt(i, R);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar-web" />;
      })}
      <polygon points={poly} className="radar-shape" />
      {axes.map((a, i) => {
        const [x, y] = pt(i, R * (0.12 + 0.88 * (a.value / max)));
        const [lx, ly] = pt(i, R + 20);
        return (
          <g key={a.key}>
            <circle cx={x} cy={y} r={4.5} style={{ fill: `var(--c-${a.key})` }} className="radar-dot" />
            <text x={lx} y={ly - 5} textAnchor="middle" className="radar-label">
              {a.label}
            </text>
            <text x={lx} y={ly + 9} textAnchor="middle" className="radar-val">
              {a.display}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
