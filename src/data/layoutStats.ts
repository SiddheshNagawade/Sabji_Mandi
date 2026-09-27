// Derived, non-simulated statistics about a market's layout and demand
// assumptions — the structural composition behind a project, available
// before anyone presses "run". Distinct from a simulation run's results
// (see CompareScreen's runHeadless), and reused by both the Data screen and
// the Compare screen so their numbers always agree.

import type { Barrier, Entrance, Project, ProduceCategory, Stall, VehicleBay, VehicleType } from './schema';
import { PRODUCE_COLORS, TILE_INFO } from './schema';

export interface TileFraction {
  tileId: number;
  name: string;
  color: string;
  cells: number;
  fraction: number;
}

export interface LayoutStats {
  areaM2: number;
  totalCells: number;
  tileBreakdown: TileFraction[];
  walkableFraction: number;
  stallCount: number;
  stallAreaCells: number;
  avgStallFootprintCells: number;
  entranceCount: number;
  pedEntranceCount: number;
  vehEntranceCount: number;
  vehicleBayCount: number;
  vehicleBayCountByType: Record<VehicleType, number>;
  barrierCount: number;
  produceCounts: Record<ProduceCategory, number>;
  produceDiversity: number;
  stallsPerPedEntrance: number | null;
  areaM2PerStall: number | null;
  expectedPedArrivals: number;
  pedArrivalsPerHour: number;
}

export function computeLayoutStats(project: Project): LayoutStats {
  const { width, height } = project.grid;
  const cellSizeM = project.grid.cellSizeM.value;
  const layout = project.baseline;
  const totalCells = width * height;
  const areaM2 = totalCells * cellSizeM * cellSizeM;

  const tileCounts = new Map<number, number>();
  for (let i = 0; i < layout.terrain.length; i++) {
    const t = layout.terrain[i];
    tileCounts.set(t, (tileCounts.get(t) ?? 0) + 1);
  }
  const tileBreakdown: TileFraction[] = Array.from(tileCounts.entries())
    .map(([tileId, cells]) => ({
      tileId,
      name: TILE_INFO[tileId]?.name ?? `Tile ${tileId}`,
      color: TILE_INFO[tileId]?.color ?? '#999',
      cells,
      fraction: cells / totalCells,
    }))
    .sort((a, b) => b.cells - a.cells);
  const walkableFraction = tileBreakdown.reduce((sum, t) => sum + (TILE_INFO[t.tileId]?.walkable ? t.fraction : 0), 0);

  const stalls = layout.objects.filter((o): o is Stall => o.kind === 'stall');
  const entrances = layout.objects.filter((o): o is Entrance => o.kind === 'entrance');
  const vehicleBays = layout.objects.filter((o): o is VehicleBay => o.kind === 'vehicle_bay');
  const barriers = layout.objects.filter((o): o is Barrier => o.kind === 'barrier');

  const stallAreaCells = stalls.reduce((sum, s) => sum + s.cells.length, 0);
  const pedEntranceCount = entrances.filter((e) => e.type.startsWith('ped_')).length;
  const vehEntranceCount = entrances.filter((e) => e.type.startsWith('veh_')).length;

  const vehicleBayCountByType: Record<VehicleType, number> = { handcart: 0, two_wheeler: 0, tempo: 0 };
  for (const v of vehicleBays) vehicleBayCountByType[v.vehicleType]++;

  const produceCounts = Object.fromEntries(Object.keys(PRODUCE_COLORS).map((p) => [p, 0])) as Record<ProduceCategory, number>;
  for (const s of stalls) for (const p of s.produce) produceCounts[p]++;
  const produceDiversity = Object.values(produceCounts).filter((c) => c > 0).length;

  const pedArrivalsPerBin = project.demand.pedArrivalsPerBin.value;
  const expectedPedArrivals = pedArrivalsPerBin.reduce((a, b) => a + b, 0);
  const totalBinHours = (pedArrivalsPerBin.length * project.demand.binMinutes) / 60;

  return {
    areaM2,
    totalCells,
    tileBreakdown,
    walkableFraction,
    stallCount: stalls.length,
    stallAreaCells,
    avgStallFootprintCells: stalls.length > 0 ? stallAreaCells / stalls.length : 0,
    entranceCount: entrances.length,
    pedEntranceCount,
    vehEntranceCount,
    vehicleBayCount: vehicleBays.length,
    vehicleBayCountByType,
    barrierCount: barriers.length,
    produceCounts,
    produceDiversity,
    stallsPerPedEntrance: pedEntranceCount > 0 ? stalls.length / pedEntranceCount : null,
    areaM2PerStall: stalls.length > 0 ? areaM2 / stalls.length : null,
    expectedPedArrivals,
    pedArrivalsPerHour: totalBinHours > 0 ? expectedPedArrivals / totalBinHours : 0,
  };
}
