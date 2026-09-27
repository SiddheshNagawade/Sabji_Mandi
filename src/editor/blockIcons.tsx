// Small monochrome glyphs for the block palette (ToolRail), one per block id.
// Drawn with stroke="currentColor" so they pick up the same idle/active text
// color the rail button already sets — unlike a flat color square (the
// previous glyph), which visually disappears once the button's own
// background becomes that same solid color when active.

import type { ReactNode } from 'react';

const common = {
  viewBox: '0 0 16 16',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const ICONS: Record<string, ReactNode> = {
  select: <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />,
  path: <path d="M2 8h1.6M6 8h1.6M10 8h1.6M14 8h0" strokeDasharray="2.6 2" />,
  stall: <path d="M3 13V7L8 3l5 4v6M3 13h10M6 13V9h4v4" />,
  entrance: <path d="M4 2.5v11M12 2.5v11M4 8h5M6.5 5.5 9 8l-2.5 2.5" />,
  wall: <path d="M2 4h5v3H2zM8 4h6v3H8zM5 7v3M2 10h5v3H2zM8 10h6v3H8zM11 7v3" />,
  arrow: <path d="M8 13V3M4 7l4-4 4 4" />,
  vehicle_bay: <path d="M2 11V6h6v5M8 8h3.5L13 10v1M2 11h1.4M6.6 11h2.8M13 11h1M3.7 12.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6zM9.5 12.3a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6z" />,
  wet_patch: <path d="M8 2.3c1.8 2.6 3.3 4.7 3.3 6.7a3.3 3.3 0 1 1-6.6 0c0-2 1.5-4.1 3.3-6.7Z" />,
  waste_pile: <path d="M2 12.5 4 8l2 3 2-5 2 4.5 1.5-2.5 1.5 4.5" />,
  waste_point: <path d="M4.5 5.5h7l-.7 7.5h-5.6l-.7-7.5ZM3 5.5h10M6.3 5.5V3.3h3.4v2.2" />,
  water_point: <path d="M4 4h4.5A2.5 2.5 0 0 1 11 6.5V8M8 8v1.3c1.1 0 2 .9 2 2a2 2 0 1 1-4 0c0-1.1.9-2 2-2Z" />,
  two_wheeler_parking: <path d="M4 11.3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM12 11.3a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM4 9.5 7 4h3.5M7 4l2 5.5" />,
  goods_overflow: <path d="M3 6.5h10v6H3zM3 6.5 5 3h6l2 3.5M6.3 3.2 7 4.5M9.7 3.2 9 4.5" />,
};

export function BlockIcon({ id, className = 'h-4 w-4' }: { id: string; className?: string }) {
  const child = ICONS[id];
  if (!child) return null;
  return (
    <svg className={className} {...common}>
      {child}
    </svg>
  );
}
