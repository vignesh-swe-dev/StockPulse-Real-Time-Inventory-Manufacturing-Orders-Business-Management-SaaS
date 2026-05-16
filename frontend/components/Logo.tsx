import React from "react";

/** StockPulse brand mark: a gradient tile with a live "pulse" line running through it. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sp-g" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0369a1" />
          <stop offset="0.55" stopColor="#0ea5e9" />
          <stop offset="1" stopColor="#14b8a6" />
        </linearGradient>
        <linearGradient id="sp-shine" x1="0" y1="0" x2="0" y2="48" gradientUnits="userSpaceOnUse">
          <stop stopColor="#fff" stopOpacity="0.35" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#sp-g)" />
      <rect x="2" y="2" width="44" height="44" rx="14" fill="url(#sp-shine)" />
      {/* stacked crate outline */}
      <path
        d="M24 9.5 38 17v14L24 38.5 10 31V17L24 9.5Z"
        stroke="#fff"
        strokeOpacity="0.45"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* pulse */}
      <path
        className="pulse-line"
        d="M8 25h8l3.5-9 6 17 4-11 2 3H40"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ size = 40, showTagline = true, tagline }: { size?: number; showTagline?: boolean; tagline?: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 12, maxWidth: "100%", minWidth: 0 }}>
      <span style={{ flexShrink: 0, display: "inline-flex" }}><LogoMark size={size} /></span>
      <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.1, minWidth: 0, overflow: "hidden" }}>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: size * 0.46,
            letterSpacing: "-0.03em",
            color: "var(--text-primary)"
          }}
        >
          Stock<span style={{ background: "var(--gradient-brand)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Pulse</span>
        </span>
        {showTagline && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              color: "var(--text-muted)",
              letterSpacing: ".08em",
              textTransform: "uppercase",
              marginTop: 3,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
          >
            {tagline ?? "Inventory · Production · Finance"}
          </span>
        )}
      </span>
    </span>
  );
}
