import type { CSSProperties, ReactNode } from 'react';
import { useState } from 'react';
import { useAppStore } from '../../app/store';
import type { EntranceType, VehicleType } from '../../data/schema';
import { PRODUCE_COLORS, type ProduceCategory } from '../../data/schema';
import type { BlockDef } from '../blocks';
import { PRIMARY_BLOCKS, SECONDARY_BLOCKS, findBlock } from '../blocks';

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

export function BlockHotbar() {
  const activeBlockId = useAppStore((s) => s.activeBlockId);
  const setActiveBlock = useAppStore((s) => s.setActiveBlock);
  const [showMore, setShowMore] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const active = findBlock(activeBlockId);

  function selectBlock(b: BlockDef) {
    setActiveBlock(b);
    setOptionsOpen(false);
  }

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-5 flex flex-col items-center gap-2 px-4">
      {optionsOpen && active.hasOptions && <BlockOptions block={active} />}

      {showMore && (
        <div className="pointer-events-auto flex flex-wrap justify-center gap-1.5 rounded-2xl px-3 py-2" style={cardStyle}>
          {SECONDARY_BLOCKS.map((b) => (
            <HotbarSlot key={b.id} block={b} active={b.id === activeBlockId} onClick={() => selectBlock(b)} />
          ))}
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-1.5 rounded-2xl px-2.5 py-2" style={cardStyle}>
        {PRIMARY_BLOCKS.map((b) => (
          <HotbarSlot
            key={b.id}
            block={b}
            active={b.id === activeBlockId}
            onClick={() => selectBlock(b)}
            caretOpen={b.id === activeBlockId && optionsOpen}
            onToggleCaret={b.hasOptions ? () => setOptionsOpen((v) => !v) : undefined}
          />
        ))}
        <div className="mx-1 h-9 w-px" style={{ background: 'var(--color-border)' }} />
        <button
          title="More materials"
          onClick={() => setShowMore((v) => !v)}
          className="flex h-12 min-w-12 flex-col items-center justify-center rounded-xl text-[9px] font-medium transition"
          style={showMore ? activeSlotStyle('#8B8880') : idleSlotStyle}
        >
          <span className="text-base leading-none">···</span>
          More
        </button>
      </div>

      <p className="pointer-events-none max-w-md text-center text-[11px] leading-snug" style={{ color: 'var(--color-text-muted)' }}>
        {active.hint}
      </p>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: 'rgba(255,255,255,0.92)',
  border: '1px solid var(--color-border)',
  boxShadow: 'var(--shadow-lg)',
  backdropFilter: 'blur(10px)',
};

function idleStyleFor(color: string): CSSProperties {
  return { background: `${color}26`, color: '#33312C' };
}
function activeSlotStyle(color: string): CSSProperties {
  return { background: color, color: '#fff', boxShadow: `0 0 0 2px ${color}55` };
}
const idleSlotStyle: CSSProperties = { background: '#F0EEE7', color: 'var(--color-text-muted)' };

function HotbarSlot({
  block,
  active,
  onClick,
  caretOpen,
  onToggleCaret,
}: {
  block: BlockDef;
  active: boolean;
  onClick: () => void;
  caretOpen?: boolean;
  onToggleCaret?: () => void;
}) {
  const isPicker = block.category === 'select';
  return (
    <button
      title={`${block.label}${block.hotkey ? ` (${block.hotkey})` : ''}`}
      onClick={onClick}
      className="relative flex h-12 min-w-12 flex-col items-center justify-center gap-0.5 rounded-xl px-1.5 text-[9px] font-medium leading-none transition active:scale-95"
      style={active ? activeSlotStyle(block.color) : isPicker ? idleSlotStyle : idleStyleFor(block.color)}
    >
      {block.hotkey && <span className="absolute left-1 top-0.5 text-[8px] opacity-60">{block.hotkey}</span>}
      <span className="h-3.5 w-3.5 rounded-[4px]" style={{ background: block.category === 'select' ? 'transparent' : block.color, border: block.category === 'select' ? '2px solid currentColor' : 'none' }} />
      <span className="whitespace-nowrap">{block.label.split(' ')[0]}</span>
      {active && onToggleCaret && (
        <span
          role="button"
          title="More options"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCaret();
          }}
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[9px] transition"
          style={{ background: caretOpen ? '#fff' : 'rgba(255,255,255,0.85)', color: '#33312C', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }}
        >
          {caretOpen ? '▴' : '▾'}
        </span>
      )}
    </button>
  );
}

function BlockOptions({ block }: { block: BlockDef }) {
  return (
    <div className="pointer-events-auto flex max-w-xl flex-wrap items-center justify-center gap-3 rounded-2xl px-4 py-2.5 text-xs" style={cardStyle}>
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
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-text-faint)' }}>
        {label}
      </span>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function pillStyle(active: boolean): CSSProperties {
  return active
    ? { background: 'var(--color-accent)', color: '#fff' }
    : { background: '#F0EEE7', color: 'var(--color-text)' };
}

function BrushSizeOption() {
  const brushSize = useAppStore((s) => s.brushSize);
  const setBrushSize = useAppStore((s) => s.setBrushSize);
  return (
    <OptionGroup label="Width">
      {[1, 2, 3, 5].map((n) => (
        <button key={n} onClick={() => setBrushSize(n)} className="h-6 w-6 rounded-md text-[11px] font-medium transition" style={pillStyle(brushSize === n)}>
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
            className="h-6 w-6 rounded-md transition"
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
            className="flex h-6 w-6 items-center justify-center rounded-md text-xs font-bold transition"
            style={{ gridRow: c.row + 1, gridColumn: c.col + 1, ...pillStyle(arrowDirCode === c.code) }}
          >
            {c.glyph}
          </button>
        ))}
      </div>
    </OptionGroup>
  );
}
