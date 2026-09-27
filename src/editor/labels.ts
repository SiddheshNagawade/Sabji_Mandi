// Human-readable labels for the hover tooltip (Editor + Simulate canvases).
// Kept separate from ToolRail's own option lists to avoid touching already-working UI.

import type { EntranceType, VehicleType } from '../data/schema';

export const ENTRANCE_TYPE_LABEL: Record<EntranceType, string> = {
  ped_in: 'Entrance — buyers in',
  ped_out: 'Exit — buyers out',
  ped_both: 'Entrance/exit — buyers in & out',
  veh_in: 'Vehicle gate — in',
  veh_out: 'Vehicle gate — out',
  veh_both: 'Vehicle gate — in & out',
};

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  handcart: 'Handcart',
  two_wheeler: 'Two-wheeler',
  tempo: 'Tempo',
};

export function produceLabel(p: string): string {
  return p.replace(/_/g, ' ');
}
