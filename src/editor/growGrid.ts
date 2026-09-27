// Grows a Layout's typed arrays to a larger width/height. Existing content
// is preserved, offset by (dx, dy) — 0 when growing right/down (the common
// case), positive when growing left/up, since making room on those sides
// means every existing cell's coordinate shifts by that amount.

import type { BackgroundImage, Layout, LayoutObject } from '../data/schema';

function growTypedArray<T extends Uint8Array | Uint16Array>(
  arr: T,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  dx: number,
  dy: number,
  Ctor: { new (n: number): T },
): T {
  const out = new Ctor(newWidth * newHeight);
  for (let y = 0; y < oldHeight; y++) {
    out.set(arr.subarray(y * oldWidth, y * oldWidth + oldWidth), (y + dy) * newWidth + dx);
  }
  return out;
}

export function growLayout(layout: Layout, oldWidth: number, oldHeight: number, newWidth: number, newHeight: number, dx: number, dy: number): Layout {
  if (newWidth === oldWidth && newHeight === oldHeight && dx === 0 && dy === 0) return layout;
  return {
    ...layout,
    terrain: growTypedArray(layout.terrain, oldWidth, oldHeight, newWidth, newHeight, dx, dy, Uint8Array),
    object: growTypedArray(layout.object, oldWidth, oldHeight, newWidth, newHeight, dx, dy, Uint16Array),
    flow: growTypedArray(layout.flow, oldWidth, oldHeight, newWidth, newHeight, dx, dy, Uint8Array),
    flowGroup: growTypedArray(layout.flowGroup, oldWidth, oldHeight, newWidth, newHeight, dx, dy, Uint8Array),
    zone: growTypedArray(layout.zone, oldWidth, oldHeight, newWidth, newHeight, dx, dy, Uint8Array),
    shade: growTypedArray(layout.shade, oldWidth, oldHeight, newWidth, newHeight, dx, dy, Uint8Array),
    locked: growTypedArray(layout.locked, oldWidth, oldHeight, newWidth, newHeight, dx, dy, Uint8Array),
    objects: layout.objects.map((o) => shiftObject(o, dx, dy)),
  };
}

function shiftObject(obj: LayoutObject, dx: number, dy: number): LayoutObject {
  if (dx === 0 && dy === 0) return obj;
  const shiftXY = (p: { x: number; y: number }) => ({ x: p.x + dx, y: p.y + dy });
  switch (obj.kind) {
    case 'stall':
      return { ...obj, cells: obj.cells.map(shiftXY), frontCells: obj.frontCells.map(shiftXY) };
    case 'entrance':
    case 'vehicle_bay':
    case 'barrier':
      return { ...obj, cells: obj.cells.map(shiftXY) };
    case 'waste_point':
    case 'water_point':
    case 'sign':
    case 'label':
      return { ...obj, cell: shiftXY(obj.cell) };
    case 'transect':
      return { ...obj, a: shiftXY(obj.a), b: shiftXY(obj.b) };
  }
}

export function shiftBackground(bg: BackgroundImage | undefined, dx: number, dy: number): BackgroundImage | undefined {
  if (!bg || (dx === 0 && dy === 0)) return bg;
  return { ...bg, originCell: { x: bg.originCell.x + dx, y: bg.originCell.y + dy } };
}
