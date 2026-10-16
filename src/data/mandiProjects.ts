// Two markets traced from real hand-drawn site sketches ("Old Mandi" and
// "New Mandi"), not invented demo data. Measurements/constraints noted on
// the sketches are used directly (path widths, stall counts, shed
// dimensions, gate counts); everything the sketches left unlabeled is
// estimated from their drawn proportions, as instructed.
//
// Both sketches have slanted features that don't sit on the grid's N/S/E/W
// axes: Old Mandi's one long diagonal lane cutting across the plot, and New
// Mandi's herringbone (chevron) stalls branching off each shed's spine.
// Since this is a pixel-grid engine with only axis-aligned cells, both are
// approximated the way the brief asked — a Bresenham-staircase of cells
// standing in for the true diagonal, each flanking stall itself built as a
// thickened diagonal "cut" (makeDiagonalStall) rather than a straight
// rectangle, so the staircase reads as angled rows, not a jagged ladder.

import type { Label, LayoutObject, Project } from './schema';
import { TileId, assumed } from './schema';
import { createBlankProject } from './defaults';
import { idx, inBounds } from '../editor/grid';
import { rebuildObjectLayer } from '../editor/objectLayer';
import { cellsAlong, fillRect, hLine, makeDiagonalStall, makeStall, perimeterWalls, placeEntrance, placeStall, PRODUCE, staircaseCutCorner, vLine } from './layoutBuilders';

// --- Old Mandi ---------------------------------------------------------
// Sketch notes used directly: paths ~2m wide, ~200 stalls/vendors total,
// only one gate in/out, a shaded storage zone ("often rented"), a
// residential block with rooms + a few small shops, and "2 stairs" where
// the long diagonal lane meets the upper boundary. The big fan/sunburst
// cluster and the rounded top-right corner are approximated as a paved
// octagon-ish plaza ringed by stalls and a staircase-cut corner wall,
// since the engine has no curved tiles.
export function buildOldMandi(): Project {
  const WIDTH = 110;
  const HEIGHT = 90;
  const project = createBlankProject('Old Mandi', WIDTH, HEIGHT);
  const layout = project.baseline;
  const terrain = layout.terrain;
  const cellSizeM = project.grid.cellSizeM.value;

  perimeterWalls(terrain, WIDTH, HEIGHT);
  staircaseCutCorner(terrain, WIDTH, HEIGHT, 'NE', 14, TileId.Wall);

  const objects: LayoutObject[] = [];
  let nextId = 1;
  const nid = () => nextId++;
  let produceI = 0;
  const nextProduce = () => PRODUCE[produceI++ % PRODUCE.length];

  // One continuous aisle ties Block A, Block B and the Plaza together (and,
  // via the vLine down to the gate below, to the only entrance) so nothing
  // further along it needs its own separate connector.
  hLine(terrain, WIDTH, HEIGHT, 9, 3, 94, TileId.Path);

  // Block A — top-left grid stall cluster.
  for (const x0 of [4, 7, 10, 13, 16, 19, 22, 25, 28, 31]) {
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), x0, 5, 2, 3, 'S', nextProduce(), cellSizeM));
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), x0, 11, 2, 3, 'N', nextProduce(), cellSizeM));
  }

  // Block B — second grid stall cluster, same pattern, further along the top.
  for (const x0 of [37, 40, 43, 46, 49, 52, 55, 58, 61, 64]) {
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), x0, 5, 2, 3, 'S', nextProduce(), cellSizeM));
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), x0, 11, 2, 3, 'N', nextProduce(), cellSizeM));
  }

  // Plaza — paved hub (the sketch's fan/sunburst cluster), ringed by stalls
  // facing inward on all four sides.
  fillRect(terrain, WIDTH, HEIGHT, 70, 5, 94, 29, TileId.Path);
  for (const x0 of [70, 73, 76, 79, 82, 85, 88]) {
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), x0, 3, 2, 2, 'S', nextProduce(), cellSizeM));
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), x0, 30, 2, 2, 'N', nextProduce(), cellSizeM));
  }
  for (const y0 of [5, 8, 11, 14, 17, 20, 23, 26]) {
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), 68, y0, 2, 2, 'E', nextProduce(), cellSizeM));
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), 95, y0, 2, 2, 'W', nextProduce(), cellSizeM));
  }

  // The long diagonal lane — the sketch's single dominant slanted feature —
  // is routed through the open band between the top blocks/plaza and the
  // storage/residential zones below, so it never physically overlaps
  // another zone's own stalls. A single spine (below) ties it back into the
  // main aisle network; everything else about it is self-contained: the
  // full swath (corridor + every flanking row's gap) is paved first so each
  // row stays reachable regardless of exactly where its stalls' front cells
  // land, and the stalls are cut into it as diagonal-staircase shapes (not
  // straight rectangles), two rows deep on each side.
  const laneX0 = 10;
  const laneY0 = 54;
  const laneX1 = 90;
  const laneY1 = 36;
  const laneDx = laneX1 - laneX0;
  const laneDy = laneY1 - laneY0;
  const laneLen = Math.hypot(laneDx, laneDy);
  const laneUx = laneDx / laneLen;
  const laneUy = laneDy / laneLen;
  const lanePx = -laneUy;
  const lanePy = laneUx;

  const segLen = 4;
  const segGap = 1;
  const segStep = segLen + segGap;
  // Odd thickness keeps the brushed body symmetric around the line (an even
  // thickness biases it toward +x/+y only), so a row's front cells — offset
  // outward from the line — can't land back inside its own body.
  const rowDepth = 3;
  const rowGap = 2;
  const rowsPerSide = 2;
  const corridorHalfWidth = 2;
  const maxReach = corridorHalfWidth + 1 + rowsPerSide * (rowDepth + rowGap) + 1;

  for (let t = 0; t <= laneLen; t += 0.5) {
    const cx = laneX0 + laneUx * t;
    const cy = laneY0 + laneUy * t;
    for (let o = -maxReach; o <= maxReach; o++) {
      const px2 = Math.round(cx + lanePx * o);
      const py2 = Math.round(cy + lanePy * o);
      if (inBounds(px2, py2, WIDTH, HEIGHT)) terrain[idx(px2, py2, WIDTH)] = TileId.Path;
    }
  }

  // Spine: a direct, unambiguous connector from the main aisle down into
  // the lane's corridor — doesn't depend on exactly where the lane's swath
  // lands, since it overshoots past the lane's y-range at this x.
  const laneSpineX = 39;
  vLine(terrain, WIDTH, HEIGHT, laneSpineX, 9, 58, TileId.Path);

  for (let t = 10; t < laneLen - segLen - 10; t += segStep) {
    const sx0 = laneX0 + laneUx * t;
    const sy0 = laneY0 + laneUy * t;
    const sx1 = laneX0 + laneUx * (t + segLen);
    const sy1 = laneY0 + laneUy * (t + segLen);
    for (const side of [1, -1] as const) {
      for (let r = 0; r < rowsPerSide; r++) {
        const offset = corridorHalfWidth + 1 + r * (rowDepth + rowGap);
        const ox0 = Math.round(sx0 + lanePx * side * offset);
        const oy0 = Math.round(sy0 + lanePy * side * offset);
        const ox1 = Math.round(sx1 + lanePx * side * offset);
        const oy1 = Math.round(sy1 + lanePy * side * offset);
        if (!inBounds(ox0, oy0, WIDTH, HEIGHT) || !inBounds(ox1, oy1, WIDTH, HEIGHT)) continue;
        // frontSide is the opposite of side: each row's front faces back
        // toward the corridor (through the paved gap behind it), not
        // further away.
        const frontSide: 1 | -1 = side === 1 ? -1 : 1;
        placeStall(objects, terrain, WIDTH, HEIGHT, makeDiagonalStall(nid(), ox0, oy0, ox1, oy1, rowDepth, frontSide, nextProduce(), cellSizeM));
      }
    }
  }

  // Storage — the sketch's shaded "often rented" zone, blocking movement
  // like real stacked goods rather than a walkable stall.
  fillRect(terrain, WIDTH, HEIGHT, 30, 55, 36, 60, TileId.GoodsOverflow);
  fillRect(terrain, WIDTH, HEIGHT, 17, 68, 21, 72, TileId.GoodsOverflow);

  // Residential block — "rooms and small shops": the rooms are a private,
  // non-walkable footprint; a handful of small shops line its market-facing
  // edge.
  fillRect(terrain, WIDTH, HEIGHT, 98, 36, 107, 76, TileId.Wall);
  for (const y0 of [37, 42, 47, 52, 57, 62, 67, 72]) {
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), 95, y0, 2, 2, 'W', nextProduce(), cellSizeM));
  }
  vLine(terrain, WIDTH, HEIGHT, 97, 32, 80, TileId.Path);

  // The sketch's single gate.
  placeEntrance(objects, terrain, WIDTH, HEIGHT, { kind: 'entrance', id: nid(), cells: cellsAlong(HEIGHT - 1, 18, 21, 'h'), type: 'ped_both', weight: assumed(1.0, 'frac'), label: 'Only gate' });
  hLine(terrain, WIDTH, HEIGHT, HEIGHT - 2, 3, 33, TileId.Path);
  vLine(terrain, WIDTH, HEIGHT, 3, 10, HEIGHT - 2, TileId.Path);

  const labels: Label[] = [
    { kind: 'label', id: nid(), cell: { x: 18, y: 66 }, text: 'Storage (rented)' },
    { kind: 'label', id: nid(), cell: { x: 100, y: 34 }, text: 'Residential — rooms & small shops' },
    { kind: 'label', id: nid(), cell: { x: 92, y: 12 }, text: '2 stairs' },
  ];
  objects.push(...labels);

  layout.objects = objects;
  rebuildObjectLayer(layout, WIDTH, HEIGHT);

  // 120+ stalls over a 6-hour window, scaled up from the small demos'
  // footfall curve for a market roughly 10x their stall count — kept
  // modest relative to that scaling so a headless/live run stays
  // responsive rather than simulating many thousands of agents.
  project.demand.pedArrivalsPerBin = assumed(
    new Array(36).fill(0).map((_, i) => {
      const peak = 12;
      const spread = 8;
      const base = 60;
      const amp = 180;
      return Math.round(base + amp * Math.exp(-((i - peak) ** 2) / (2 * spread * spread)));
    }),
    'buyers/10min',
    'scaled from the single-peak placeholder curve for this market size',
  );

  return project;
}

// --- New Mandi -----------------------------------------------------------
// Sketch notes used directly: a main gate, pillars 10m apart, two
// herringbone-stall sheds ~30x20m each, 13m roads "half covered with
// stalls to sell", and a small secondary outlet with no gate structure.
export function buildNewMandi(): Project {
  const WIDTH = 66;
  const HEIGHT = 52;
  const project = createBlankProject('New Mandi', WIDTH, HEIGHT);
  const layout = project.baseline;
  const terrain = layout.terrain;
  const cellSizeM = project.grid.cellSizeM.value;

  perimeterWalls(terrain, WIDTH, HEIGHT);

  const objects: LayoutObject[] = [];
  let nextId = 1;
  const nid = () => nextId++;
  let produceI = 0;
  const nextProduce = () => PRODUCE[produceI++ % PRODUCE.length];

  // Main gate and the road it feeds.
  vLine(terrain, WIDTH, HEIGHT, 4, 0, 9, TileId.Path);
  vLine(terrain, WIDTH, HEIGHT, 5, 0, 9, TileId.Path);
  vLine(terrain, WIDTH, HEIGHT, 6, 0, 9, TileId.Path);
  vLine(terrain, WIDTH, HEIGHT, 7, 0, 9, TileId.Path);
  placeEntrance(objects, terrain, WIDTH, HEIGHT, { kind: 'entrance', id: nid(), cells: cellsAlong(0, 4, 7, 'h'), type: 'ped_both', weight: assumed(1.0, 'frac'), label: 'Main gate' });
  hLine(terrain, WIDTH, HEIGHT, 9, 2, WIDTH - 2, TileId.Path);

  function herringboneShed(x0: number, y0: number, w: number, h: number) {
    // The central spine the chevron stalls branch off, 10m-pillar-bay
    // proportioned the way the sketch's two pillars were marked.
    const spineY = y0 + Math.floor(h / 2);
    hLine(terrain, WIDTH, HEIGHT, spineY, x0, x0 + w - 1, TileId.Path);
    const segLen = 4;
    for (let sx = x0 + 2; sx < x0 + w - segLen - 1; sx += segLen + 2) {
      for (const side of [1, -1] as const) {
        const oy0 = spineY + side * 2;
        const oy1 = spineY + side * (2 + segLen);
        placeStall(objects, terrain, WIDTH, HEIGHT, makeDiagonalStall(nid(), sx, oy0, sx + segLen, oy1, 2, side, nextProduce(), cellSizeM));
      }
    }
    // connector down from the main road into the shed's spine
    const midX = x0 + Math.floor(w / 2);
    vLine(terrain, WIDTH, HEIGHT, midX, 9, spineY, TileId.Path);
  }

  herringboneShed(4, 12, 28, 18);
  herringboneShed(34, 12, 28, 18);

  // Three additional grid-stall rows (the sketch's extra hatched blocks).
  for (const [x0, cols] of [
    [6, 9],
    [6, 8],
    [40, 7],
  ] as const) {
    for (let i = 0; i < cols; i++) placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), x0 + i * 3, 33, 2, 3, 'N', nextProduce(), cellSizeM));
  }
  hLine(terrain, WIDTH, HEIGHT, 32, 2, WIDTH - 2, TileId.Path);

  // Roadside stalls — "13 meter roads also covered half with stalls".
  for (let i = 0; i < 13; i++) {
    const x0 = 10 + i * 4;
    if (x0 + 2 > WIDTH - 3) break;
    placeStall(objects, terrain, WIDTH, HEIGHT, makeStall(nid(), x0, 6, 2, 2, 'S', nextProduce(), cellSizeM));
  }

  // Small secondary outlet — no distinct gate structure, just an opening.
  placeEntrance(objects, terrain, WIDTH, HEIGHT, { kind: 'entrance', id: nid(), cells: cellsAlong(WIDTH - 1, 20, 21, 'v'), type: 'ped_both', weight: assumed(0.5, 'frac'), label: 'Small secondary outlet' });
  hLine(terrain, WIDTH, HEIGHT, 20, 62, WIDTH - 2, TileId.Path);
  vLine(terrain, WIDTH, HEIGHT, 62, 9, 21, TileId.Path);

  const labels: Label[] = [{ kind: 'label', id: nid(), cell: { x: 18, y: 10 }, text: 'Distance between 2 pillars ~10m' }];
  objects.push(...labels);

  layout.objects = objects;
  rebuildObjectLayer(layout, WIDTH, HEIGHT);

  project.demand.pedArrivalsPerBin = assumed(
    new Array(36).fill(0).map((_, i) => {
      const peak = 12;
      const spread = 8;
      const base = 25;
      const amp = 70;
      return Math.round(base + amp * Math.exp(-((i - peak) ** 2) / (2 * spread * spread)));
    }),
    'buyers/10min',
    'scaled from the single-peak placeholder curve for this market size',
  );

  return project;
}
