import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { addDays, daysBetween, formatShort } from '../core/dates';
import type { ISODate } from '../core/types';
import './charts.css';

/** Paleta categórica validada (CVD y contraste) contra la superficie oscura #141414, en este orden fijo. */
export const SERIES_COLORS = ['#059669', '#8b5cf6', '#d97706'] as const;
export const NEUTRAL_MARK = '#8b8b94';

const M = { top: 12, right: 12, bottom: 22, left: 38 };

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(320);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.floor(entry!.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

/** Ticks "bonitos": paso = {1, 2, 2.5, 5} × 10ⁿ, el menor que deja ≤ `count` intervalos. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const raw = (max - min) / count;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw)!;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.5; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

function fmtNum(n: number): string {
  return Math.abs(n) >= 1000 ? `${Math.round(n / 100) / 10}k` : String(Math.round(n * 10) / 10);
}

interface TooltipState {
  left: number;
  title: string;
  rows: { color: string; value: string; label: string; dot?: boolean }[];
}

function Tooltip({ tip, width }: { tip: TooltipState | null; width: number }) {
  if (!tip) return null;
  const left = Math.min(Math.max(tip.left, 70), width - 70);
  return (
    <div className="chart-tip" style={{ left }}>
      <div className="chart-tip-title">{tip.title}</div>
      {tip.rows.map((r, i) => (
        <div key={i} className="chart-tip-row">
          <span className={r.dot ? 'key-dot' : 'key-line'} style={{ background: r.color }} />
          <strong className="num">{r.value}</strong>
          <span className="muted">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; color: string; kind: 'line' | 'dot' | 'bar' }[] }) {
  return (
    <div className="chart-legend">
      {items.map((it) => (
        <span key={it.label} className="row small">
          <span className={`key-${it.kind}`} style={{ background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface LineSeries {
  id: string;
  label: string;
  color: string;
  kind: 'line' | 'dots';
  points: { x: ISODate; y: number }[];
}

interface LineChartProps {
  series: LineSeries[];
  domain: [ISODate, ISODate];
  unit: string;
  height?: number;
  ariaLabel: string;
  endLabels?: boolean;
}

export function LineChart({ series, domain, unit, height = 180, ariaLabel, endLabels = false }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [hoverX, setHoverX] = useState<ISODate | null>(null);

  const all = series.flatMap((s) => s.points.map((p) => p.y));
  if (all.length === 0) return <div className="empty small">Sin datos en este rango</div>;

  const right = endLabels ? 48 : M.right;
  const span = Math.max(1, daysBetween(domain[0], domain[1]));
  const ticks = niceTicks(Math.min(...all), Math.max(...all));
  const yMin = ticks[0]!;
  const yMax = ticks.at(-1)!;
  const plotW = width - M.left - right;
  const plotH = height - M.top - M.bottom;
  const x = (d: ISODate) => M.left + (daysBetween(domain[0], d) / span) * plotW;
  const y = (v: number) => M.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;
  const xTicks = [domain[0], addDays(domain[0], Math.round(span / 2)), domain[1]];
  const dates = [...new Set(series.flatMap((s) => s.points.map((p) => p.x)))].sort();

  const onMove = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    let nearest = dates[0]!;
    for (const d of dates) if (Math.abs(x(d) - px) < Math.abs(x(nearest) - px)) nearest = d;
    setHoverX(nearest);
    setTip({
      left: x(nearest),
      title: formatShort(nearest),
      rows: series
        .map((s) => {
          const p = s.points.find((pt) => pt.x === nearest);
          return p ? { color: s.color, value: `${fmtNum(p.y)} ${unit}`, label: s.label, dot: s.kind === 'dots' } : null;
        })
        .filter((r): r is NonNullable<typeof r> => r !== null),
    });
  };

  return (
    <div ref={ref} className="chart" style={{ height }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.left - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {fmtNum(t)}
            </text>
          </g>
        ))}
        {xTicks.map((d, i) => (
          <text key={i} x={x(d)} y={height - 6} className="axis" textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>
            {formatShort(d)}
          </text>
        ))}
        {hoverX && <line x1={x(hoverX)} x2={x(hoverX)} y1={M.top} y2={M.top + plotH} className="crosshair" />}
        {series.map((s) => {
          const pts = [...s.points].sort((a, b) => a.x.localeCompare(b.x));
          if (s.kind === 'dots') {
            return (
              <g key={s.id}>
                {pts.map((p) => (
                  <circle key={p.x} cx={x(p.x)} cy={y(p.y)} r={p.x === hoverX ? 5 : 3.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} />
                ))}
              </g>
            );
          }
          const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
          const last = pts.at(-1);
          return (
            <g key={s.id}>
              <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts.map((p) =>
                p.x === hoverX ? <circle key={p.x} cx={x(p.x)} cy={y(p.y)} r={4.5} fill={s.color} stroke="var(--surface)" strokeWidth={2} /> : null,
              )}
              {endLabels && last && (
                <text x={x(last.x) + 6} y={y(last.y)} className="end-label" dominantBaseline="middle">
                  {fmtNum(last.y)}
                </text>
              )}
            </g>
          );
        })}
        <rect
          x={M.left}
          y={M.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={(e) => onMove(e.clientX, (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect())}
          onPointerLeave={() => {
            setTip(null);
            setHoverX(null);
          }}
        />
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

export interface Bar {
  key: string;
  /** Fecha (modo alineado con un LineChart) o etiqueta de categoría. */
  x: string;
  value: number;
  title: string;
}

interface BarChartProps {
  bars: Bar[];
  color: string;
  unit: string;
  label: string;
  height?: number;
  ariaLabel: string;
  /** Si se pasa, las barras se colocan por fecha con la misma escala X que un LineChart. */
  domain?: [ISODate, ISODate];
  refLine?: { value: number; label: string };
  minY?: number;
}

export function BarChart({ bars, color, unit, label, height = 140, ariaLabel, domain, refLine, minY = 0 }: BarChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  if (bars.length === 0) return <div className="empty small">Sin datos en este rango</div>;

  const values = bars.map((b) => b.value).concat(refLine ? [refLine.value] : []);
  const ticks = niceTicks(minY, Math.max(...values));
  const yMax = ticks.at(-1)!;
  const yMin = ticks[0]!;
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const y = (v: number) => M.top + plotH - ((v - yMin) / (yMax - yMin || 1)) * plotH;

  let centers: number[];
  let barW: number;
  if (domain) {
    const span = Math.max(1, daysBetween(domain[0], domain[1]));
    centers = bars.map((b) => M.left + (daysBetween(domain[0], b.x) / span) * plotW);
    barW = Math.max(3, Math.min(14, (plotW / (span + 1)) * 0.7));
  } else {
    const band = plotW / bars.length;
    centers = bars.map((_, i) => M.left + band * (i + 0.5));
    barW = Math.min(40, band - 6);
  }

  const showTip = (b: Bar, cx: number) => {
    setHover(b.key);
    setTip({ left: cx, title: b.title, rows: [{ color, value: `${fmtNum(b.value)} ${unit}`, label }] });
  };

  const xLabelIdx = domain ? [0, bars.length - 1] : bars.map((_, i) => i);

  return (
    <div ref={ref} className="chart" style={{ height }}>
      <svg width={width} height={height} role="img" aria-label={ariaLabel}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} className="grid" />
            <text x={M.left - 6} y={y(t)} className="axis" textAnchor="end" dominantBaseline="middle">
              {fmtNum(t)}
            </text>
          </g>
        ))}
        {bars.map((b, i) => {
          const top = y(Math.max(b.value, yMin));
          const h = Math.max(0, y(yMin) - top);
          const r = Math.min(4, barW / 2, h);
          const left = centers[i]! - barW / 2;
          return (
            <g key={b.key}>
              <path
                d={`M${left},${y(yMin)} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${y(yMin)} Z`}
                fill={color}
                opacity={hover && hover !== b.key ? 0.55 : 1}
              />
              <rect
                x={centers[i]! - Math.max(barW, 24) / 2}
                y={M.top}
                width={Math.max(barW, 24)}
                height={plotH}
                fill="transparent"
                tabIndex={0}
                onPointerEnter={() => showTip(b, centers[i]!)}
                onFocus={() => showTip(b, centers[i]!)}
                onPointerLeave={() => {
                  setTip(null);
                  setHover(null);
                }}
                onBlur={() => {
                  setTip(null);
                  setHover(null);
                }}
              />
            </g>
          );
        })}
        {refLine && (
          <g>
            <line x1={M.left} x2={width - M.right} y1={y(refLine.value)} y2={y(refLine.value)} className="ref-line" />
            <text x={width - M.right} y={y(refLine.value) - 4} className="axis" textAnchor="end">
              {refLine.label}
            </text>
          </g>
        )}
        {xLabelIdx.map((i) => {
          const b = bars[i];
          if (!b) return null;
          const anchor = domain ? (i === 0 ? 'start' : 'end') : 'middle';
          return (
            <text key={b.key} x={domain ? (i === 0 ? M.left : width - M.right) : centers[i]} y={height - 6} className="axis" textAnchor={anchor}>
              {domain ? formatShort(b.x) : b.x}
            </text>
          );
        })}
      </svg>
      <Tooltip tip={tip} width={width} />
    </div>
  );
}

export function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="card chart-card">
      <h2 style={{ marginBottom: 2 }}>{title}</h2>
      {subtitle && <div className="small faint" style={{ marginBottom: 8 }}>{subtitle}</div>}
      {children}
    </section>
  );
}
