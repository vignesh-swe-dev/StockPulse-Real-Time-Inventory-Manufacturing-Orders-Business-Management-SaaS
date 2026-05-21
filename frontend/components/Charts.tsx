"use client";

import React from "react";

export const CHART_COLORS = ["#0369a1", "#14b8a6", "#f59e0b", "#7c8cf8", "#e11d48", "#64748b"];

/** Horizontal bars that grow in on load. Values are shown through `format`. */
export function BarList({ items, format }: { items: { label: string; value: number }[]; format: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {items.map((it, i) => (
        <div key={it.label}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 6, gap: 12 }}>
            <span style={{ color: "var(--text-secondary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
            <span className="tabular-nums" style={{ color: "var(--text-primary)", fontWeight: 600, whiteSpace: "nowrap" }}>{format(it.value)}</span>
          </div>
          <div style={{ height: 9, borderRadius: 99, background: "var(--bg-subtle)", overflow: "hidden" }}>
            <div
              className="bar-fill"
              style={{ ["--i" as any]: i, height: "100%", width: `${Math.max(3, (it.value / max) * 100)}%`, borderRadius: 99, background: "var(--gradient-brand)" }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Donut chart with a legend. Segments draw themselves in. */
export function Donut({ items, format, centerLabel }: { items: { label: string; value: number }[]; format: (n: number) => string; centerLabel: string }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const R = 52;
  const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 24, flexWrap: "wrap" }}>
      <svg width="150" height="150" viewBox="0 0 140 140" role="img" aria-label={centerLabel}>
        <circle cx="70" cy="70" r={R} fill="none" stroke="var(--bg-subtle)" strokeWidth="16" />
        {items.map((it, i) => {
          const len = (it.value / total) * C;
          const el = (
            <circle
              key={it.label}
              className="donut-seg"
              cx="70" cy="70" r={R} fill="none"
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth="16"
              strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 70 70)"
              style={{ ["--i" as any]: i, ["--len" as any]: len }}
            />
          );
          offset += len;
          return el;
        })}
        <text x="70" y="66" textAnchor="middle" style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, fill: "var(--text-primary)" }}>{items.length}</text>
        <text x="70" y="84" textAnchor="middle" style={{ fontSize: 9.5, fill: "var(--text-muted)", letterSpacing: ".06em" }}>{centerLabel.toUpperCase()}</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 160, flex: 1 }}>
        {items.map((it, i) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
            <span style={{ flex: 1, color: "var(--text-secondary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.label}</span>
            <span className="tabular-nums" style={{ fontWeight: 600 }}>{Math.round((it.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
