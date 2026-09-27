import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../../app/store';
import type { EntranceType, VehicleType } from '../../data/schema';
import { PRODUCE_COLORS, type ProduceCategory } from '../../data/schema';
import type { BlockDef } from '../blocks';
import { PRIMARY_BLOCKS, SECONDARY_BLOCKS } from '../blocks';
import { BlockIcon } from '../blockIcons';
import { computeLintWarnings } from '../layoutLinter';
import { LayersPanel } from './LayersPanel';

const PRODUCE_LIST = Object.keys(PRODUCE_COLORS) as ProduceCategory[];
const STALL_PRESETS: [number, number][] = [
  [3, 2],
  [4, 3],
  [6, 3],
];
const ENTRANCE_OPTIONS: { id: EntranceType; label: string }[] = [
  { id: 'ped_in', label: 'Buyers in' },
  { id: 'ped_out', label: 'Buyers out' },
  { id: 'ped_both', label: 'Buyers in & out' },
  { id: 'veh_in', label: 'Vehicles in' },
  { id: 'veh_out', label: 'Vehicles out' },
  { id: 'veh_both', label: 'Vehicles in & out' },
];
const VEHICLE_OPTIONS: { id: VehicleType; label: string }[] = [
  { id: 'handcart', label: 'Handcart' },
  { id: 'two_wheeler', label: 'Two-wheeler' },
  { id: 'tempo', label: 'Tempo' },
];
// index matches quantizeDirection's FLOW_DIRS codes (1..8)
const COMPASS: { code: number; glyph: string; row: number; col: number }[] = [
  { code: 1, glyph: '↑', row: 0, col: 1 },
  { code: 2, glyph: '↗', row: 0, col: 2 },
  { code: 3, glyph: '→', row: 1, col: 2 },
  { code: 4, glyph: '↘', row: 2, col: 2 },
  { code: 5, glyph: '↓', row: 2, col: 1 },
  { code: 6, glyph: '↙', row: 2, col: 0 },
  { code: 7, glyph: '←', row: 1, col: 0 },
  { code: 8, glyph: '↖', row: 0, col: 0 },
];

const cardStyle: CSSProperties = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-lg)',
};
function idleStyleFor(color: string): CSSProperties {
  return { background: `${color}26`, color: '#33312C' };
}
function activeSlotStyle(color: string): CSSProperties {
  return { background: color, color: '#fff' };
}
const idleSlotStyle: CSSProperties = { background: 'var(--color-bg)', color: 'var(--color-text-muted)' };
function pillStyle(active: boolean): CSSProperties {
  return active ? { background: 'var(--color-accent)', color: '#fff' } : { background: 'var(--color-bg)', color: 'var(--color-text)' };
}

// One vertical rail — like a minimal Procreate/LineAccurate-style tool strip:
// icon-only, and picking anything with settings opens exactly one flyout,
// anchored beside that icon, showing only that thing's controls.
export function ToolRail() {
  const activeBlockId = useAppStore((s) => s.activeBlockId);
  const setActiveBlock = useAppStore((s) => s.setActiveBlock);
  const layout = useAppStore((s) => s.project.baseline);
  const width = useAppStore((s) => s.project.grid.width);
  const height = useAppStore((s) => s.project.grid.height);
  const layoutVersion = useAppStore((s) => s.layoutVersion);

  // Which single slot's flyout is showing, keyed by block id / 'more' / 'layers'.
  // Hovering a slot (or its flyout) opens it; leaving both closes it after a
  // short grace period, so a flyout no longer needs an explicit X click to
  // dismiss — it behaves like a normal hover menu, not a modal.
  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  function openSlot(id: string) {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    setOpenSlotId(id);
  }
  function scheduleCloseSlot() {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => setOpenSlotId(null), 200);
  }

  const warnings = useMemo(() => computeLintWarnings(layout, width, height), [layout, width, height, layoutVersion]);
  const errorCount = warnings.filter((w) => w.severity === 'error').length;

  function selectBlock(b: BlockDef) {
    setActiveBlock(b);
    setOpenSlotId(b.hasOptions ? b.id : null);
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-4 flex flex-col gap-1.5 rounded-2xl p-1.5" style={cardStyle}>
      {PRIMARY_BLOCKS.map((b) => (
        <RailSlot
          key={b.id}
          title={`${b.label}${b.hotkey ? ` (${b.hotkey})` : ''}`}
          active={b.id === activeBlockId}
          style={b.id === activeBlockId ? activeSlotStyle(b.color) : idleStyleFor(b.color)}
          onClick={() => selectBlock(b)}
          onMouseEnter={() => openSlot(b.id)}
          onMouseLeave={scheduleCloseSlot}
          flyout={
            b.id === activeBlockId && b.hasOptions && openSlotId === b.id ? (
              <Flyout title={b.label} onClose={() => setOpenSlotId(null)}>
                <BlockOptions block={b} />
              </Flyout>
            ) : null
          }
        >
          <BlockGlyph block={b} />
        </RailSlot>
      ))}

      <Divider />

      <RailSlot
        title="More materials"
        active={openSlotId === 'more'}
        onClick={() => setOpenSlotId((v) => (v === 'more' ? null : 'more'))}
        onMouseEnter={() => openSlot('more')}
        onMouseLeave={scheduleCloseSlot}
        flyout={
          openSlotId === 'more' ? (
            <Flyout title="More materials" onClose={() => setOpenSlotId(null)}>
              <div className="grid grid-cols-3 gap-1.5">
                {SECONDARY_BLOCKS.map((b) => (
                  <button
                    key={b.id}
                    title={b.label}
                    onClick={() => selectBlock(b)}
                    className="flex h-11 w-11 flex-col items-center justify-center gap-0.5 rounded-xl text-[8px] font-medium transition"
                    style={b.id === activeBlockId ? activeSlotStyle(b.color) : idleStyleFor(b.color)}
                  >
                    <BlockIcon id={b.id} className="h-3.5 w-3.5" />
                    <span className="max-w-[38px] truncate">{b.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </Flyout>
          ) : null
        }
      >
        <span className="text-base leading-none">···</span>
      </RailSlot>

      <Divider />

      <RailSlot
        title="Layers & backdrop"
        active={openSlotId === 'layers'}
        onClick={() => setOpenSlotId((v) => (v === 'layers' ? null : 'layers'))}
        onMouseEnter={() => openSlot('layers')}
        onMouseLeave={scheduleCloseSlot}
        flyout={
          openSlotId === 'layers' ? (
            <Flyout title="Layers & backdrop" onClose={() => setOpenSlotId(null)} width={224}>
              <LayersPanel />
            </Flyout>
          ) : null
        }
      >
        <span>☰</span>
      </RailSlot>

      {errorCount > 0 && (
        <div
          className="mt-0.5 flex h-6 w-6 items-center justify-center self-center rounded-full text-[10px] font-semibold text-white"
          style={{ background: 'var(--color-danger)' }}
          title={`${errorCount} problem${errorCount > 1 ? 's' : ''} — see Issues in the status bar`}
        >
          {errorCount}
        </div>
      )}
    </div>
  );
}

function Divider() {
  return <div className="mx-auto my-0.5 h-px w-8" style={{ background: 'var(--color-border)' }} />;
}

function RailSlot({
  title,
  active,
  onClick,
  children,
  style,
  flyout,
  onMouseEnter,
  onMouseLeave,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  style?: CSSProperties;
  flyout?: ReactNode;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  return (
    <div className="relative" onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <button
        title={title}
        onClick={onClick}
        className="flex h-11 w-11 items-center justify-center rounded-xl text-base transition active:scale-95"
        style={style ?? (active ? { background: 'var(--color-accent)', color: '#fff' } : idleSlotStyle)}
      >
        {children}
      </button>
      {flyout}
    </div>
  );
}

function BlockGlyph({ block }: { block: BlockDef }) {
  return <BlockIcon id={block.id} />;
}

function Flyout({ title, onClose, children, width = 260 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  return (
    <div className="absolute left-full top-0 z-10 ml-2 overflow-hidden rounded-2xl" style={{ ...cardStyle, width }}>
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>
          {title}
        </span>
        <button onClick={onClose} className="rounded-md px-1 text-xs text-neutral-400 transition hover:bg-[var(--color-bg)] hover:text-neutral-700">
          ✕
        </button>
      </div>
      <div className="max-h-[70vh] overflow-y-auto p-3 text-xs">{children}</div>
    </div>
  );
}

function BlockOptions({ block }: { block: BlockDef }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
        {block.hint}
      </p>
      {block.category === 'terrain' && <BrushSizeOption />}
      {block.category === 'stall' && <StallOptions />}
      {block.category === 'entrance' && (
        <>
          <EntranceOptions />
          <BrushSizeOption />
        </>
      )}
      {block.category === 'wall_or_barrier' && (
        <>
          <WallMovableOption />
          <BrushSizeOption />
        </>
      )}
      {block.category === 'vehicle_bay' && <VehicleBayOptions />}
      {block.category === 'arrow' && (
        <>
          <ArrowCompass />
          <BrushSizeOption />
        </>
      )}
    </div>
  );
}

function WallMovableOption() {
  const wallMovable = useAppStore((s) => s.wallMovable);
  const setWallMovable = useAppStore((s) => s.setWallMovable);
  return (
    <OptionGroup label="Kind">
      <button onClick={() => setWallMovable(false)} className="rounded-md px-2 py-1 text-[11px] font-medium transition" style={pillStyle(!wallMovable)}>
        Fixed
      </button>
      <button onClick={() => setWallMovable(true)} className="rounded-md px-2 py-1 text-[11px] font-medium transition" style={pillStyle(wallMovable)} title="Can be opened or closed on a schedule from Rules">
        Movable
      </button>
    </OptionGroup>
  );
}

function OptionGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-faint)' }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function BrushSizeOption() {
  const brushSize = useAppStore((s) => s.brushSize);
  const setBrushSize = useAppStore((s) => s.setBrushSize);
  return (
    <OptionGroup label="Width">
      {[1, 2, 3, 5].map((n) => (
        <button key={n} onClick={() => setBrushSize(n)} className="h-7 w-7 rounded-md text-[11px] font-medium transition" style={pillStyle(brushSize === n)}>
          {n}
        </button>
      ))}
    </OptionGroup>
  );
}

function StallOptions() {
  const stallSize = useAppStore((s) => s.stallSize);
  const setStallSize = useAppStore((s) => s.setStallSize);
  const stallFrontEdge = useAppStore((s) => s.stallFrontEdge);
  const flipStallFrontEdge = useAppStore((s) => s.flipStallFrontEdge);
  const rotateStallFootprint = useAppStore((s) => s.rotateStallFootprint);
  const stallProduce = useAppStore((s) => s.stallProduce);
  const setStallProduce = useAppStore((s) => s.setStallProduce);

  return (
    <>
      <OptionGroup label="Size">
        {STALL_PRESETS.map(([w, h]) => (
          <button key={`${w}x${h}`} onClick={() => setStallSize(w, h)} className="rounded-md px-2 py-1 text-[11px] font-medium transition" style={pillStyle(stallSize.w === w && stallSize.h === h)}>
            {w}×{h}
          </button>
        ))}
        <button onClick={rotateStallFootprint} className="rounded-md px-2 py-1 text-[11px] font-medium transition" style={pillStyle(false)} title="Rotate (R)">
          ⟳
        </button>
      </OptionGroup>
      <OptionGroup label="Front">
        <button onClick={flipStallFrontEdge} className="rounded-md px-2 py-1 text-[11px] font-medium transition" style={pillStyle(false)} title="Flip front edge (F)">
          {stallFrontEdge}
        </button>
      </OptionGroup>
      <OptionGroup label="Sells">
        {PRODUCE_LIST.map((p) => (
          <button
            key={p}
            onClick={() => setStallProduce([p])}
            title={p.replace('_', ' ')}
            className="h-7 w-7 rounded-md transition"
            style={{ background: PRODUCE_COLORS[p], boxShadow: stallProduce[0] === p ? '0 0 0 2px var(--color-accent)' : 'none' }}
          />
        ))}
      </OptionGroup>
    </>
  );
}

function EntranceOptions() {
  const entranceType = useAppStore((s) => s.entranceType);
  const setEntranceType = useAppStore((s) => s.setEntranceType);
  return (
    <OptionGroup label="Kind">
      {ENTRANCE_OPTIONS.map((t) => (
        <button key={t.id} onClick={() => setEntranceType(t.id)} className="rounded-md px-2 py-1 text-[11px] font-medium transition" style={pillStyle(entranceType === t.id)}>
          {t.label}
        </button>
      ))}
    </OptionGroup>
  );
}

function VehicleBayOptions() {
  const vehicleBayType = useAppStore((s) => s.vehicleBayType);
  const setVehicleBayType = useAppStore((s) => s.setVehicleBayType);
  return (
    <OptionGroup label="Sized for">
      {VEHICLE_OPTIONS.map((t) => (
        <button key={t.id} onClick={() => setVehicleBayType(t.id)} className="rounded-md px-2 py-1 text-[11px] font-medium transition" style={pillStyle(vehicleBayType === t.id)}>
          {t.label}
        </button>
      ))}
    </OptionGroup>
  );
}

function ArrowCompass() {
  const arrowDirCode = useAppStore((s) => s.arrowDirCode);
  const setArrowDirCode = useAppStore((s) => s.setArrowDirCode);
  return (
    <OptionGroup label="Direction">
      <div className="grid grid-cols-3 grid-rows-3 gap-0.5">
        {COMPASS.map((c) => (
          <button
            key={c.code}
            onClick={() => setArrowDirCode(c.code)}
            className="flex h-7 w-7 items-center justify-center rounded-md text-xs font-bold transition"
            style={{ gridRow: c.row + 1, gridColumn: c.col + 1, ...pillStyle(arrowDirCode === c.code) }}
          >
            {c.glyph}
          </button>
        ))}
      </div>
    </OptionGroup>
  );
}
