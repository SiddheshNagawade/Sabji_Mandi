import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useCallback, useRef } from 'react';
import { useAppStore } from '../../app/store';
import { MIN_ZOOM, MAX_ZOOM } from '../viewport';
import { PropertiesPanel } from './PropertiesPanel';
import { LinterPanel } from './LinterPanel';

// A single persistent, sectioned panel for canvas-level settings — grid,
// zoom, issues — plus the selected object's properties when there is one.
// Kept separate from the left tool rail: this is "about the canvas", not
// "about the currently selected tool". Its width is user-adjustable (drag
// the left edge) since long labels can otherwise feel cramped.
export function PropertiesDock() {
  const selectedObjectId = useAppStore((s) => s.selectedObjectId);
  const setSelectedObjectId = useAppStore((s) => s.setSelectedObjectId);
  const gridWidth = useAppStore((s) => s.project.grid.width);
  const gridHeight = useAppStore((s) => s.project.grid.height);
  const cellSizeM = useAppStore((s) => s.project.grid.cellSizeM.value);
  const showGrid = useAppStore((s) => s.showGrid);
  const toggleGrid = useAppStore((s) => s.toggleGrid);
  const zoom = useAppStore((s) => s.viewport.zoom);
  const zoomBy = useAppStore((s) => s.zoomBy);
  const resetZoom = useAppStore((s) => s.resetZoom);
  const setViewport = useAppStore((s) => s.setViewport);
  const propertiesWidth = useAppStore((s) => s.propertiesWidth);
  const setPropertiesWidth = useAppStore((s) => s.setPropertiesWidth);

  const dragStartRef = useRef<{ x: number; width: number } | null>(null);

  const onHandlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      dragStartRef.current = { x: e.clientX, width: propertiesWidth };
    },
    [propertiesWidth],
  );
  const onHandlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      setPropertiesWidth(dragStartRef.current.width - (e.clientX - dragStartRef.current.x));
    },
    [setPropertiesWidth],
  );
  const onHandlePointerUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  return (
    <div className="relative flex h-full shrink-0 flex-col overflow-y-auto border-l" style={{ width: propertiesWidth, borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
      <div
        onPointerDown={onHandlePointerDown}
        onPointerMove={onHandlePointerMove}
        onPointerUp={onHandlePointerUp}
        className="absolute -left-1 top-0 z-10 h-full w-2 cursor-col-resize"
        title="Drag to resize"
      />
      {selectedObjectId != null && (
        <Section title="Selection" action={<button onClick={() => setSelectedObjectId(null)} className="text-[11px] text-neutral-400 hover:text-neutral-700">Deselect</button>}>
          <PropertiesPanel />
        </Section>
      )}

      <Section title="Grid & view">
        <Row label="Show grid">
          <Toggle checked={showGrid} onChange={toggleGrid} />
        </Row>
        <Row label="Cell size">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {cellSizeM} m (fixed)
          </span>
        </Row>
        <Row label="Market size">
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {gridWidth} × {gridHeight} m
          </span>
        </Row>
        <div className="mt-1">
          <div className="mb-1 flex items-center justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
            <span>Zoom</span>
            <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-hover)' }}>
              {Math.round((zoom / 32) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={1}
            value={zoom}
            onChange={(e) => setViewport((v) => ({ ...v, zoom: parseFloat(e.target.value) }))}
            className="w-full"
          />
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            <SmallButton onClick={() => zoomBy(1 / 1.25)}>− Out</SmallButton>
            <SmallButton onClick={() => zoomBy(1.25)}>+ In</SmallButton>
            <SmallButton onClick={resetZoom}>Reset</SmallButton>
          </div>
        </div>
      </Section>

      <Section title="Issues">
        <LinterPanel embedded />
      </Section>
    </div>
  );
}

function Section({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="border-b px-3 py-3" style={{ borderColor: 'var(--color-border)' }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--color-text-faint)' }}>
          {title}
        </span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between text-xs last:mb-0">
      <span style={{ color: 'var(--color-text)' }}>{label}</span>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className="relative h-5 w-9 rounded-full transition"
      style={{ background: checked ? 'var(--color-accent)' : 'var(--color-border-strong)' }}
    >
      <span className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition" style={{ left: checked ? 18 : 2 }} />
    </button>
  );
}

function SmallButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className="rounded-lg px-2 py-1.5 text-[11px] font-medium transition hover:brightness-95" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      {children}
    </button>
  );
}
