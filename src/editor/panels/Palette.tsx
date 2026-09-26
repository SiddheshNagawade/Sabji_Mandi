import { useAppStore } from '../../app/store';
import type { PaintLayer } from '../../app/store';
import type { EntranceType, ProduceCategory } from '../../data/schema';
import { PRODUCE_COLORS, TILE_INFO, TileId } from '../../data/schema';

const PAINT_LAYERS: { id: PaintLayer; label: string }[] = [
  { id: 'terrain', label: 'Terrain' },
  { id: 'zone', label: 'Zone' },
  { id: 'shade', label: 'Shade' },
  { id: 'locked', label: 'Locked' },
];

const TILE_IDS: number[] = Object.values(TileId);
const PRODUCE_LIST = Object.keys(PRODUCE_COLORS) as ProduceCategory[];
const ENTRANCE_TYPES: EntranceType[] = ['ped_in', 'ped_out', 'ped_both', 'veh_in', 'veh_out', 'veh_both'];
const STALL_PRESETS: [number, number][] = [
  [3, 2],
  [4, 3],
  [6, 3],
];

export function Palette() {
  const tool = useAppStore((s) => s.tool);
  const paintLayer = useAppStore((s) => s.paintLayer);
  const setPaintLayer = useAppStore((s) => s.setPaintLayer);
  const brushTileId = useAppStore((s) => s.brushTileId);
  const setBrushTile = useAppStore((s) => s.setBrushTile);

  const stallSize = useAppStore((s) => s.stallSize);
  const setStallSize = useAppStore((s) => s.setStallSize);
  const stallFrontEdge = useAppStore((s) => s.stallFrontEdge);
  const rotateStallFootprint = useAppStore((s) => s.rotateStallFootprint);
  const flipStallFrontEdge = useAppStore((s) => s.flipStallFrontEdge);
  const stallProduce = useAppStore((s) => s.stallProduce);
  const setStallProduce = useAppStore((s) => s.setStallProduce);

  const entranceType = useAppStore((s) => s.entranceType);
  const setEntranceType = useAppStore((s) => s.setEntranceType);

  const showPaintPalette = tool === 'brush' || tool === 'rect' || tool === 'line' || tool === 'fill';

  return (
    <div className="w-40 shrink-0 overflow-y-auto border-r border-neutral-300 bg-white p-2 text-xs">
      {showPaintPalette && (
        <>
          <div className="mb-1 font-semibold text-neutral-500">Paint layer</div>
          <div className="mb-2 grid grid-cols-2 gap-1">
            {PAINT_LAYERS.map((l) => (
              <button key={l.id} onClick={() => setPaintLayer(l.id)} className={`rounded px-1 py-1 ${paintLayer === l.id ? 'bg-neutral-800 text-white' : 'bg-neutral-100'}`}>
                {l.label}
              </button>
            ))}
          </div>
          {paintLayer === 'terrain' && (
            <div className="grid grid-cols-2 gap-1">
              {TILE_IDS.map((id) => (
                <button
                  key={id}
                  title={TILE_INFO[id].name}
                  onClick={() => setBrushTile(id)}
                  className={`flex items-center gap-1 rounded border px-1 py-1 text-left ${brushTileId === id ? 'border-neutral-800' : 'border-transparent'}`}
                >
                  <span className="inline-block h-3 w-3 shrink-0 rounded-sm border border-black/20" style={{ background: TILE_INFO[id].color }} />
                  <span className="truncate">{TILE_INFO[id].name}</span>
                </button>
              ))}
            </div>
          )}
          {paintLayer === 'zone' && (
            <div className="grid grid-cols-2 gap-1">
              {PRODUCE_LIST.map((p, i) => (
                <button
                  key={p}
                  onClick={() => setBrushTile(i + 1)}
                  className={`flex items-center gap-1 rounded border px-1 py-1 ${brushTileId === i + 1 ? 'border-neutral-800' : 'border-transparent'}`}
                >
                  <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: PRODUCE_COLORS[p] }} />
                  <span className="truncate">{p.replace('_', ' ')}</span>
                </button>
              ))}
            </div>
          )}
          {(paintLayer === 'shade' || paintLayer === 'locked') && <p className="text-neutral-500">Brush paints this overlay on; use the Eraser to clear it.</p>}
        </>
      )}

      {tool === 'stall' && (
        <>
          <div className="mb-1 font-semibold text-neutral-500">Stall footprint</div>
          <div className="mb-2 grid grid-cols-3 gap-1">
            {STALL_PRESETS.map(([w, h]) => (
              <button
                key={`${w}x${h}`}
                onClick={() => setStallSize(w, h)}
                className={`rounded px-1 py-1 ${stallSize.w === w && stallSize.h === h ? 'bg-neutral-800 text-white' : 'bg-neutral-100'}`}
              >
                {w}×{h}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[10px] text-neutral-500">All footprints are placeholders until measured. Or drag a custom rectangle on the map.</p>
          <div className="mb-2 flex items-center justify-between">
            <span>Front edge: {stallFrontEdge}</span>
            <button onClick={flipStallFrontEdge} className="rounded bg-neutral-100 px-2 py-0.5">
              Flip (F)
            </button>
          </div>
          <button onClick={rotateStallFootprint} className="mb-2 w-full rounded bg-neutral-100 px-2 py-0.5">
            Rotate 90° (R)
          </button>
          <div className="mb-1 font-semibold text-neutral-500">Produce</div>
          <div className="grid grid-cols-2 gap-1">
            {PRODUCE_LIST.map((p) => (
              <button
                key={p}
                onClick={() => setStallProduce([p])}
                className={`flex items-center gap-1 rounded border px-1 py-1 ${stallProduce[0] === p ? 'border-neutral-800' : 'border-transparent'}`}
              >
                <span className="inline-block h-3 w-3 shrink-0 rounded-sm" style={{ background: PRODUCE_COLORS[p] }} />
                <span className="truncate">{p.replace('_', ' ')}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {tool === 'entrance' && (
        <>
          <div className="mb-1 font-semibold text-neutral-500">Entrance type</div>
          <div className="grid grid-cols-1 gap-1">
            {ENTRANCE_TYPES.map((t) => (
              <button key={t} onClick={() => setEntranceType(t)} className={`rounded px-1 py-1 text-left ${entranceType === t ? 'bg-neutral-800 text-white' : 'bg-neutral-100'}`}>
                {t}
              </button>
            ))}
          </div>
        </>
      )}

      {tool === 'arrow' && <p className="text-neutral-500">Drag to draw a one-way stroke. Hold Shift and drag a rectangle, then press an arrow key to set a uniform direction. R rotates the single-click direction.</p>}
      {tool === 'select' && <p className="text-neutral-500">Click an object to select it. Delete removes it.</p>}
      {tool === 'eraser' && <p className="text-neutral-500">Resets painted cells to open ground (or clears the current overlay layer).</p>}
      {tool === 'eyedropper' && <p className="text-neutral-500">Click a cell to pick its tile as the current brush.</p>}
      {tool === 'measure' && <p className="text-neutral-500">Drag between two points to read the distance. Not saved to the layout.</p>}
      {tool === 'transect' && <p className="text-neutral-500">Drag across an aisle to place a named measurement line.</p>}
    </div>
  );
}
