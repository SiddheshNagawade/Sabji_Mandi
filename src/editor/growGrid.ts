// Grows a Layout's typed arrays to a larger width/height, preserving all
// existing content at its original (x, y) coordinates. Only grows to the
// right/down (callers never pass a smaller width/height) — growing to the
// left/up would require shifting every object's coordinates, which we
// deliberately avoid.

import type { Layout } from '../data/schema';

function growTypedArray<T extends Uint8Array | Uint16Array>(
  arr: T,
  oldWidth: number,
  oldHeight: number,
  newWidth: number,
  newHeight: number,
  Ctor: { new (n: number): T },
): T {
  const out = new Ctor(newWidth * newHeight);
  for (let y = 0; y < oldHeight; y++) {
    out.set(arr.subarray(y * oldWidth, y * oldWidth + oldWidth), y * newWidth);
  }
  return out;
}

export function growLayout(layout: Layout, oldWidth: number, oldHeight: number, newWidth: number, newHeight: number): Layout {
  if (newWidth === oldWidth && newHeight === oldHeight) return layout;
  return {
    ...layout,
    terrain: growTypedArray(layout.terrain, oldWidth, oldHeight, newWidth, newHeight, Uint8Array),
    object: growTypedArray(layout.object, oldWidth, oldHeight, newWidth, newHeight, Uint16Array),
    flow: growTypedArray(layout.flow, oldWidth, oldHeight, newWidth, newHeight, Uint8Array),
    flowGroup: growTypedArray(layout.flowGroup, oldWidth, oldHeight, newWidth, newHeight, Uint8Array),
    zone: growTypedArray(layout.zone, oldWidth, oldHeight, newWidth, newHeight, Uint8Array),
    shade: growTypedArray(layout.shade, oldWidth, oldHeight, newWidth, newHeight, Uint8Array),
    locked: growTypedArray(layout.locked, oldWidth, oldHeight, newWidth, newHeight, Uint8Array),
  };
}
