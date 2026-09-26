// Shared color lookups. Tile/produce base colors live in data/schema.ts
// (they are as much "data" as visuals); this file adds the extra ramps and
// semantic colors used only by rendering code.

export const ARROW_COLOR = '#1D6FD8';
export const ENTRANCE_IN_COLOR = '#2BB673';
export const ENTRANCE_OUT_COLOR = '#E4572E';
export const ENTRANCE_BOTH_COLOR = '#2B8FB6';
export const TRANSECT_COLOR = '#7A2FB6';
export const SHADE_OVERLAY_COLOR = 'rgba(31, 58, 95, 0.25)';
export const LOCKED_OVERLAY_COLOR = 'rgba(20, 20, 20, 0.35)';
export const SELECTION_COLOR = '#FFD23F';
export const LINT_ERROR_COLOR = '#D7191C';
export const LINT_WARNING_COLOR = '#FDAE61';
export const LINT_INFO_COLOR = '#2C7BB6';

// LoS (Fruin-style) color ramp, section 10.1 / 11.2. Used from M3 onward.
export const LOS_RAMP: { max: number; color: string; grade: string }[] = [
  { max: 0.5, color: '#D7191C', grade: 'F' },
  { max: 0.9, color: '#F46D43', grade: 'E' },
  { max: 1.4, color: '#FDAE61', grade: 'D' },
  { max: 2.3, color: '#FFFFBF', grade: 'C' },
  { max: 3.3, color: '#7FBF7B', grade: 'B' },
  { max: Infinity, color: '#2C7BB6', grade: 'A' },
];
