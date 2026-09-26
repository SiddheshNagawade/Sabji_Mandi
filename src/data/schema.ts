// Core data model for the Mandi Flow Simulator. See SPEC.md section 5.
// Kept as plain interfaces/types (no enums) so the whole Project is a
// structurally-typed, JSON-serializable object.

export type ProvenanceTag = 'measured' | 'assumed' | 'literature';

export interface Param<T = number> {
  value: T;
  unit?: string;
  source: ProvenanceTag;
  note?: string;
}

export function assumed<T>(value: T, unit?: string, note?: string): Param<T> {
  return { value, unit, source: 'assumed', note };
}

export interface XY {
  x: number;
  y: number;
}

export type Dir4 = 'N' | 'E' | 'S' | 'W';

// Flow direction codes stored in Layout.flow: 0 = none, 1..8 = N,NE,E,SE,S,SW,W,NW
export const FLOW_DIRS: XY[] = [
  { x: 0, y: 0 }, // 0 unused
  { x: 0, y: -1 }, // 1 N
  { x: 1, y: -1 }, // 2 NE
  { x: 1, y: 0 }, // 3 E
  { x: 1, y: 1 }, // 4 SE
  { x: 0, y: 1 }, // 5 S
  { x: -1, y: 1 }, // 6 SW
  { x: -1, y: 0 }, // 7 W
  { x: -1, y: -1 }, // 8 NW
];

// TileId values for Layout.terrain
export const TileId = {
  OpenGround: 0,
  Path: 1,
  Wall: 2,
  StallBody: 3,
  GoodsOverflow: 4,
  WetPatch: 5,
  WastePile: 6,
  Entrance: 7,
  VehicleBay: 8,
  TwoWheelerParking: 9,
  WastePoint: 10,
  WaterPoint: 11,
  Barrier: 12,
} as const;
export type TileIdValue = (typeof TileId)[keyof typeof TileId];

export const TILE_INFO: Record<
  number,
  { name: string; color: string; walkable: boolean; blocksVehicle: boolean; speedFactor: number; pattern?: string }
> = {
  [TileId.OpenGround]: { name: 'Open ground', color: '#E9E2D0', walkable: true, blocksVehicle: false, speedFactor: 1.0 },
  [TileId.Path]: { name: 'Path / aisle', color: '#D8D2C0', walkable: true, blocksVehicle: false, speedFactor: 0.9 },
  [TileId.Wall]: { name: 'Wall / void', color: '#3A3A3A', walkable: false, blocksVehicle: true, speedFactor: 0 },
  [TileId.StallBody]: { name: 'Stall body', color: '#8A7FB0', walkable: false, blocksVehicle: true, speedFactor: 0 },
  [TileId.GoodsOverflow]: { name: 'Goods overflow', color: '#C79A5B', walkable: false, blocksVehicle: true, speedFactor: 0, pattern: 'diagonal' },
  [TileId.WetPatch]: { name: 'Wet patch', color: '#7FB3D5', walkable: true, blocksVehicle: false, speedFactor: 0.6 },
  [TileId.WastePile]: { name: 'Waste pile', color: '#6B4F3A', walkable: false, blocksVehicle: true, speedFactor: 0 },
  [TileId.Entrance]: { name: 'Entrance / exit', color: '#2BB673', walkable: true, blocksVehicle: false, speedFactor: 1.0 },
  [TileId.VehicleBay]: { name: 'Vehicle bay', color: '#4D7CC7', walkable: true, blocksVehicle: false, speedFactor: 1.0, pattern: 'hatch' },
  [TileId.TwoWheelerParking]: { name: 'Two-wheeler parking', color: '#7A8CA5', walkable: true, blocksVehicle: false, speedFactor: 1.0 },
  [TileId.WastePoint]: { name: 'Waste point', color: '#6B4F3A', walkable: true, blocksVehicle: false, speedFactor: 1.0 },
  [TileId.WaterPoint]: { name: 'Water point', color: '#5BC0EB', walkable: true, blocksVehicle: false, speedFactor: 1.0 },
  [TileId.Barrier]: { name: 'Barrier (movable)', color: '#B33A3A', walkable: false, blocksVehicle: true, speedFactor: 0, pattern: 'dashed' },
};

export type ProduceCategory =
  | 'leafy'
  | 'root_tuber'
  | 'fruit_veg'
  | 'gourd_beans'
  | 'herbs_spices'
  | 'fruit'
  | 'mixed_other';

export const PRODUCE_COLORS: Record<ProduceCategory, string> = {
  leafy: '#4C9F50',
  root_tuber: '#A9743B',
  fruit_veg: '#D8503F',
  gourd_beans: '#8DB63C',
  herbs_spices: '#2E8B7A',
  fruit: '#E8A33D',
  mixed_other: '#8A7FB0',
};

export type VehicleType = 'handcart' | 'two_wheeler' | 'tempo';

export interface DistributionParam {
  kind: 'lognormal' | 'normal' | 'uniform' | 'constant';
  // lognormal/normal: [median|mean, sigma]; uniform: [min, max]; constant: [value]
  params: Param<[number, number] | [number]>;
}

interface LayoutObjectBase {
  id: number;
  locked?: boolean;
}

export interface Stall extends LayoutObjectBase {
  kind: 'stall';
  cells: XY[];
  frontEdge: Dir4;
  frontCells: XY[];
  produce: ProduceCategory[];
  sellerType: 'farmer' | 'reseller' | 'unknown';
  attractiveness: Param;
  maxConcurrentCustomers: number;
  supply?: {
    vehicleType: VehicleType;
    arrivalTime: Param;
    unloadDwellS: Param;
    setupS: Param;
    stockUnits: Param;
  };
  shaded: boolean;
  label?: string;
  locked: boolean;
}

export type EntranceType = 'ped_in' | 'ped_out' | 'ped_both' | 'veh_in' | 'veh_out' | 'veh_both';

export interface TimeWindow {
  startS: number;
  endS: number;
}

export interface Entrance extends LayoutObjectBase {
  kind: 'entrance';
  cells: XY[];
  type: EntranceType;
  weight: Param;
  schedule?: TimeWindow[];
  label?: string;
}

export interface VehicleBay extends LayoutObjectBase {
  kind: 'vehicle_bay';
  cells: XY[];
  vehicleType: VehicleType;
  assignedStallId?: number;
  label?: string;
}

export interface WastePoint extends LayoutObjectBase {
  kind: 'waste_point';
  cell: XY;
  label?: string;
  growthRate?: Param;
  cleanupSchedule?: TimeWindow[];
}

export interface WaterPoint extends LayoutObjectBase {
  kind: 'water_point';
  cell: XY;
  label?: string;
}

export interface Sign extends LayoutObjectBase {
  kind: 'sign';
  cell: XY;
  produce: ProduceCategory[];
  viewRangeCells: number;
  label?: string;
}

export interface Transect extends LayoutObjectBase {
  kind: 'transect';
  a: XY;
  b: XY;
  label: string;
}

export interface Barrier extends LayoutObjectBase {
  kind: 'barrier';
  cells: XY[];
  schedule?: TimeWindow[];
  label?: string;
}

export interface Label extends LayoutObjectBase {
  kind: 'label';
  cell: XY;
  text: string;
}

export type LayoutObject = Stall | Entrance | VehicleBay | WastePoint | WaterPoint | Sign | Transect | Barrier | Label;

export interface Phase {
  id: number;
  name: string;
  startS: number;
  endS: number;
  activeBarrierIds: number[];
  activeArrowGroupIds: number[];
  vehiclesAllowed: boolean;
  vehiclesBaysOnly: boolean;
  openEntranceIds: number[];
  wasteClearing: boolean;
}

export interface ArrowGroup {
  id: number;
  label?: string;
  schedule?: TimeWindow[];
}

export interface Layout {
  terrain: Uint8Array;
  object: Uint16Array;
  flow: Uint8Array;
  flowGroup: Uint8Array; // which arrow group (if any) each flow cell belongs to, 0 = ungrouped/always-on
  zone: Uint8Array;
  shade: Uint8Array;
  locked: Uint8Array;
  objects: LayoutObject[];
  phases: Phase[];
  arrowGroups: ArrowGroup[];
}

export interface BackgroundImage {
  imageDataUrl: string;
  opacity: number;
  originCell: XY;
  scaleCellsPerPixel: number;
  rotationDeg: number;
  calibration?: { pxA: XY; pxB: XY; realMetres: number };
}

export interface BuyerType {
  id: string;
  label: string;
  share: Param;
  listSize: Param<[number, number]>;
  walkSpeedMps: Param;
  serviceScale: Param;
  patienceS: Param;
}

export interface VehicleArrival {
  arrivalTimeS: number;
  type: VehicleType;
  entranceId?: number;
  stallId?: number;
  dwellMinOverride?: number;
}

export interface Demand {
  simStartS: number;
  simEndSpawnS: number;
  hardStopS: number;
  pedArrivalsPerBin: Param<number[]>; // per 10-min bin, total across entrances
  binMinutes: number;
  buyerTypes: BuyerType[];
  serviceTimeByProduce: Partial<Record<ProduceCategory, DistributionParam>>;
  vehicleSchedule: VehicleArrival[];
  vehicleTypes: Record<VehicleType, { footprintCells: [number, number]; speedMps: Param; dwellS: DistributionParam }>;
  temperatureByHour?: Param<number[]>;
}

export interface SimParams {
  tickS: Param;
  cellSizeM: Param; // duplicated ref for convenience at sim time
  arrowComplianceFrac: Param; // 0..1, default 1.0 unless overridden by scenario
  arrivalRateMultiplier: Param;
  wetPatchSpeedFactor: Param;
  deadlockThresholdS: Param;
  swapProbability: Param;
  sidestepThreshold: number;
  sidestepProbability: Param;
  crowdSlowdownKappa: Param;
  crowdSlowdownMinFactor: Param;
  occupancyPenaltyWeight: Param;
  densityPenaltyWeight: Param;
  wallProximityPenalty: Param;
  choiceWeights: { pathCost: Param; queueAhead: Param; localCrowd: Param; attractiveness: Param; noiseTemp: Param };
  vehicleConflictDistCells: Param;
  vehicleConflictDurationS: Param;
  vehicleMaxWaitS: Param;
  seed: number;
}

export interface Scenario {
  id: string;
  name: string;
  interventionIds: number[];
  paramOverrides?: Partial<{ arrowComplianceFrac: number; arrivalRateMultiplier: number }>;
  isBaseline: boolean;
  locked?: boolean;
}

export type CellChange = { x: number; y: number; layer: 'terrain' | 'object' | 'flow' | 'flowGroup' | 'zone' | 'shade' | 'locked'; value: number };

export interface Intervention {
  id: number;
  name: string;
  rationale?: string;
  beneficiary: 'consumer' | 'seller' | 'both';
  cellPatch: CellChange[];
  addedObjects: LayoutObject[];
  removedObjectIds: number[];
  paramOverrides?: Partial<{ arrowComplianceFrac: number; arrivalRateMultiplier: number }>;
  createdAt: string;
}

export interface Snapshot {
  id: string;
  timestamp: string; // system-set, not editable
  note: string; // "I believed X, I saw Y, so I changed to Z."
  thumbnailDataUrl?: string;
  layoutSerialized: string; // JSON snapshot of baseline layout at time of save
  paramsSerialized: string;
}

export interface ObservedValue {
  id: string;
  quantity:
    | 'entrance_counts_10min'
    | 'peak_density_zone'
    | 'time_in_market'
    | 'effective_aisle_width'
    | 'vehicle_counts_dwell'
    | 'skipped_stall_share';
  label: string;
  value: number;
  unit: string;
  note: string;
  transectId?: number;
  zoneId?: number;
}

export interface CalibrationSet {
  observed: ObservedValue[];
  toleranceFrac: Param; // default 0.25
  lastRunStatus: 'not_validated' | 'failing' | 'passing';
  lastRunDetail?: { quantity: string; observed: number; simulatedMean: number; simulatedP10: number; simulatedP90: number; relError: number }[];
}

export interface Project {
  schemaVersion: number;
  meta: { name: string; createdAt: string; updatedAt: string; isSyntheticExample?: boolean };
  grid: { width: number; height: number; cellSizeM: Param };
  background?: BackgroundImage;
  baseline: Layout;
  interventions: Intervention[];
  scenarios: Scenario[];
  demand: Demand;
  params: SimParams;
  snapshots: Snapshot[];
  calibration: CalibrationSet;
}

export const SCHEMA_VERSION = 1;
