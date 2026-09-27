// The Minecraft-style block palette: discrete, named, coloured things you
// place on the grid by selecting a block and clicking/dragging — no pencils,
// no abstract "tools". Each block maps onto the existing editor tool/layer
// machinery in app/store.ts so the underlying command/undo system is reused
// unchanged.
//
// Kept deliberately short: right-click always erases (no separate Erase
// block competing with it), and Wall/Barrier — a fixed vs. a schedulable
// block — are one "Wall" block with a Movable toggle rather than two
// look-alike hotbar slots.

import { TileId } from '../data/schema';

export type BlockCategory = 'select' | 'terrain' | 'stall' | 'entrance' | 'wall_or_barrier' | 'vehicle_bay' | 'arrow';

export interface BlockDef {
  id: string;
  label: string;
  hint: string;
  color: string;
  hotkey: string;
  category: BlockCategory;
  tileId?: number;
  hasOptions?: boolean;
}

export const PRIMARY_BLOCKS: BlockDef[] = [
  { id: 'select', label: 'Select', hint: 'Click a stall, entrance or cell to inspect and edit it.', color: '#8B8880', hotkey: 'V', category: 'select' },
  { id: 'path', label: 'Path', hint: 'Drag to lay walkable aisle. Shift-drag fills a rectangle. Right-click erases.', color: '#A9743B', hotkey: '1', category: 'terrain', tileId: TileId.Path, hasOptions: true },
  { id: 'stall', label: 'Stall', hint: 'Drag to size a stall, or click for the default size.', color: '#8A7FB0', hotkey: '2', category: 'stall', hasOptions: true },
  { id: 'entrance', label: 'Entrance', hint: 'Drag along the edge buyers use to enter or leave the market.', color: '#2BB673', hotkey: '3', category: 'entrance', hasOptions: true },
  { id: 'wall', label: 'Wall', hint: 'Drag to block movement. Shift-drag fills a rectangle. Right-click erases.', color: '#4B4B4B', hotkey: '4', category: 'wall_or_barrier', hasOptions: true },
  { id: 'arrow', label: 'Arrow', hint: 'Drag to mark a one-way walking direction — the direction follows your drag.', color: '#1D6FD8', hotkey: '5', category: 'arrow', hasOptions: true },
  { id: 'vehicle_bay', label: 'Vehicle bay', hint: 'Where handcarts, two-wheelers or tempos load and unload.', color: '#4D7CC7', hotkey: '6', category: 'vehicle_bay', hasOptions: true },
];

export const SECONDARY_BLOCKS: BlockDef[] = [
  { id: 'wet_patch', label: 'Wet patch', hint: 'Slows buyers down — puddles, drainage, wash areas.', color: '#7FB3D5', hotkey: '', category: 'terrain', tileId: TileId.WetPatch },
  { id: 'waste_pile', label: 'Waste pile', hint: 'Blocks movement — uncollected waste.', color: '#6B4F3A', hotkey: '', category: 'terrain', tileId: TileId.WastePile },
  { id: 'waste_point', label: 'Waste point', hint: 'A marked collection point. Walkable.', color: '#8B6A4F', hotkey: '', category: 'terrain', tileId: TileId.WastePoint },
  { id: 'water_point', label: 'Water point', hint: 'A tap or water source. Walkable.', color: '#5BC0EB', hotkey: '', category: 'terrain', tileId: TileId.WaterPoint },
  { id: 'two_wheeler_parking', label: 'Two-wheeler parking', hint: 'Informal parking strip for two-wheelers.', color: '#7A8CA5', hotkey: '', category: 'terrain', tileId: TileId.TwoWheelerParking },
  { id: 'goods_overflow', label: 'Goods overflow', hint: 'Blocks movement — stock spilling past a stall boundary.', color: '#C79A5B', hotkey: '', category: 'terrain', tileId: TileId.GoodsOverflow },
];

export const ALL_BLOCKS: BlockDef[] = [...PRIMARY_BLOCKS, ...SECONDARY_BLOCKS];

export function findBlock(id: string): BlockDef {
  return ALL_BLOCKS.find((b) => b.id === id) ?? PRIMARY_BLOCKS[0];
}
