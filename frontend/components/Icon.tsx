import React from "react";

const PATHS: Record<string, React.ReactNode> = {
  dashboard: (<><rect x="3" y="3" width="7.5" height="9" rx="2" /><rect x="13.5" y="3" width="7.5" height="5" rx="2" /><rect x="13.5" y="11" width="7.5" height="10" rx="2" /><rect x="3" y="15" width="7.5" height="6" rx="2" /></>),
  inventory: (<><path d="M21 8 12 3 3 8v8l9 5 9-5V8Z" /><path d="m3 8 9 5 9-5M12 13v8" /></>),
  tag: (<><path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z" /><circle cx="8" cy="8" r="1.4" /></>),
  orders: (<><rect x="5" y="3" width="14" height="18" rx="2.5" /><path d="M9 3.5h6M9 9h6M9 13h6M9 17h3" /></>),
  production: (<><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>),
  truck: (<><path d="M2 6.5A1.5 1.5 0 0 1 3.5 5H14v11H2V6.5ZM14 9h4.5L22 12.5V16h-8" /><circle cx="7" cy="17.5" r="2" /><circle cx="17.5" cy="17.5" r="2" /></>),
  invoice: (<><path d="M5 3h14v18l-3-2-2.3 2L12 19l-1.7 2L8 19l-3 2V3Z" /><path d="M9 8h6M9 12h6" /></>),
  building: (<><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M9 7.5h2M13 7.5h2M9 11.5h2M13 11.5h2M10 21v-4h4v4" /></>),
  chart: (<><path d="M3 3v18h18" /><path d="m7 15 4-5 3 3 5-7" /></>),
  shield: (<><path d="M12 3 4.5 6v6c0 4.5 3.2 8 7.5 9 4.3-1 7.5-4.5 7.5-9V6L12 3Z" /><path d="m9 12 2.2 2.2L15.5 10" /></>),
  bell: (<><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9Z" /><path d="M10 20a2.2 2.2 0 0 0 4 0" /></>),
  moon: (<path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a8.5 8.5 0 1 0 11 11Z" />),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" /></>),
  menu: (<path d="M4 7h16M4 12h16M4 17h16" />),
  plus: (<path d="M12 5v14M5 12h14" />),
  download: (<><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M4 19h16" /></>),
  alert: (<><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 10v4.5M12 17.4v.1" /></>),
  check: (<path d="m5 12.5 4.5 4.5L19 7.5" />),
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></>),
  wallet: (<><rect x="3" y="6" width="18" height="14" rx="3" /><path d="M3 10h18M16 15h2M7 6V4.5A1.5 1.5 0 0 1 8.5 3H17" /></>),
  factory: (<><path d="M3 21V10l6 3.5V10l6 3.5V5h4l2 0v16H3Z" /><path d="M8 21v-4M13 21v-4M17 9V5" /></>),
  arrow: (<path d="M5 12h14M13 6l6 6-6 6" />),
  x: (<path d="M6 6l12 12M18 6 6 18" />),
  zap: (<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />),
  users: (<><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.6 3.2-5.5 6.5-5.5s5.9 1.9 6.5 5.5" /><path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c2 .6 3.2 2.3 3.5 5.2" /></>),
  lock: (<><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  globe: (<><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" /></>)
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, strokeWidth = 1.8, style }: { name: IconName; size?: number; strokeWidth?: number; style?: React.CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, ...style }}
    >
      {PATHS[name]}
    </svg>
  );
}
