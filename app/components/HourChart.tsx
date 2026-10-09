"use client";

import { useEffect, useRef, useState } from "react";

const H = 220, L = 32, R = 8, T = 28, B = 28;
const label = (h: number) => (h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`);

/** Calls by hour of day (IST), with the front desk's 10am–7pm shaded so after-hours demand is visible. */
export function HourChart({ data, open = 10, close = 19 }: { data: { hour: number; value: number }[]; open?: number; close?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  // Draw at the container's real width so labels stay 11px on a phone instead of being scaled down.
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(720);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const every = W < 480 ? 6 : 3;
  const max = Math.max(1, ...data.map((d) => d.value));
  const step = max <= 5 ? 1 : max <= 10 ? 2 : Math.ceil(max / 5);
  const top = Math.ceil(max / step) * step;
  const ticks = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const slot = (W - L - R) / 24;
  const bw = Math.min(16, slot - 4);
  const x = (h: number) => L + h * slot;
  const y = (v: number) => T + (H - T - B) * (1 - v / top);

  return (
    <div className="chart" ref={ref} onPointerLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Calls by hour of day">
        <rect x={x(open)} y={T - 20} width={(close - open) * slot} height={H - B - T + 20} fill="var(--band)" />
        <text x={x(open) + 6} y={T - 6} fontSize="11" fill="var(--text-secondary)">{W < 480 ? "Front desk hours" : "Front desk hours, 10am–7pm"}</text>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--grid)"} strokeWidth="1" />
            <text x={L - 8} y={y(t) + 4} fontSize="11" textAnchor="end" fill="var(--text-muted)" style={{ fontVariantNumeric: "tabular-nums" }}>{t}</text>
          </g>
        ))}
        {data.map((d) => {
          const bx = x(d.hour) + (slot - bw) / 2;
          const by = y(d.value);
          const h = y(0) - by;
          return (
            <g key={d.hour}>
              {d.value > 0 && (
                <path
                  d={`M${bx} ${y(0)}V${by + Math.min(4, h)}q0 -4 4 -4h${bw - 8}q4 0 4 4V${y(0)}z`}
                  fill="var(--series-1)"
                  opacity={hover === null || hover === d.hour ? 1 : 0.55}
                />
              )}
              <rect
                x={x(d.hour)} y={T - 20} width={slot} height={H - B - T + 20} fill="transparent"
                tabIndex={0} aria-label={`${label(d.hour)}: ${d.value} calls`}
                onPointerEnter={() => setHover(d.hour)} onFocus={() => setHover(d.hour)} onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
        {Array.from({ length: 24 / every }, (_, i) => i * every).map((h) => (
          <text key={h} x={x(h) + slot / 2} y={H - 8} fontSize="11" textAnchor="middle" fill="var(--text-muted)">{label(h)}</text>
        ))}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: `${((x(hover) + slot / 2) / W) * 100}%`, top: `${(y(data[hover].value) / H) * 100}%` }}>
          <strong>{data[hover].value} {data[hover].value === 1 ? "call" : "calls"}</strong>
          {label(hover)}–{label((hover + 1) % 24)}{hover < open || hover >= close ? " · front desk closed" : ""}
        </div>
      )}
    </div>
  );
}
