"use client";

import { useState } from "react";

/**
 * Horizontal bars with the value at the tip. `ramp` gives ordered stages (a funnel) one step each;
 * without it every bar is the single series colour.
 */
export function HBars({ data, ramp, shareOf }: { data: { label: string; value: number }[]; ramp?: string[]; shareOf?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="muted">Nothing in this period.</p>;

  return (
    <div role="list" onPointerLeave={() => setHover(null)}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const share = shareOf ? Math.round((d.value / shareOf) * 100) : null;
        return (
          <div
            key={d.label} role="listitem" tabIndex={0}
            aria-label={`${d.label}: ${d.value}${share !== null ? `, ${share}%` : ""}`}
            onPointerEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
            style={{ display: "grid", gridTemplateColumns: "minmax(120px, 38%) 1fr", alignItems: "center", gap: 12, padding: "5px 0", borderRadius: 6, background: hover === i ? "var(--hover)" : "transparent" }}
          >
            <span style={{ color: "var(--text-secondary)", fontSize: 13 }}>{d.label}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
              <span style={{ height: 18, width: `calc(${pct}% - 40px)`, minWidth: d.value ? 4 : 0, background: ramp?.[i] ?? "var(--series-1)", borderRadius: "0 4px 4px 0" }} />
              <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {d.value}
                {hover === i && share !== null && <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · {share}%</span>}
              </span>
            </span>
          </div>
        );
      })}
    </div>
  );
}
