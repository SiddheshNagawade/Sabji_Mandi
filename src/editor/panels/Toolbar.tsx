import { useAppStore } from '../../app/store';
import type { EditorTool } from '../../app/store';

const TOOLS: { id: EditorTool; label: string; icon: string; key: string }[] = [
  { id: 'select', label: 'Select', icon: '⬚', key: 'V' },
  { id: 'brush', label: 'Brush', icon: '✎', key: 'B' },
  { id: 'rect', label: 'Rectangle', icon: '▭', key: 'R' },
  { id: 'line', label: 'Line', icon: '／', key: 'L' },
  { id: 'fill', label: 'Fill', icon: '▨', key: 'F' },
  { id: 'eraser', label: 'Eraser', icon: '⌫', key: 'E' },
  { id: 'eyedropper', label: 'Eyedropper', icon: '💧', key: 'I' },
  { id: 'arrow', label: 'Arrow', icon: '➤', key: 'A' },
  { id: 'stall', label: 'Stall', icon: '⌂', key: 'S' },
  { id: 'entrance', label: 'Entrance', icon: '⇥', key: 'N' },
  { id: 'measure', label: 'Measure', icon: '📏', key: 'M' },
  { id: 'transect', label: 'Transect', icon: '⟷', key: 'T' },
];

export function Toolbar() {
  const tool = useAppStore((s) => s.tool);
  const setTool = useAppStore((s) => s.setTool);
  const brushSize = useAppStore((s) => s.brushSize);
  const setBrushSize = useAppStore((s) => s.setBrushSize);
  const showGrid = useAppStore((s) => s.showGrid);
  const toggleGrid = useAppStore((s) => s.toggleGrid);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);

  return (
    <div className="flex w-16 flex-col gap-1 overflow-y-auto border-r border-neutral-300 bg-white p-1">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={`${t.label} (${t.key})`}
          onClick={() => setTool(t.id)}
          className={`flex flex-col items-center rounded py-1.5 text-[10px] ${tool === t.id ? 'bg-neutral-800 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
        >
          <span className="text-lg leading-none">{t.icon}</span>
          {t.label}
        </button>
      ))}
      {(tool === 'brush' || tool === 'line' || tool === 'eraser' || tool === 'arrow' || tool === 'entrance') && (
        <div className="mt-1 border-t border-neutral-200 pt-1 text-center text-[10px] text-neutral-500">
          <div>Size</div>
          <div className="flex justify-center gap-0.5">
            {[1, 2, 3, 5].map((n) => (
              <button key={n} onClick={() => setBrushSize(n)} className={`h-5 w-5 rounded text-[10px] ${brushSize === n ? 'bg-neutral-800 text-white' : 'bg-neutral-100'}`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-auto flex flex-col gap-1 border-t border-neutral-200 pt-1">
        <button title="Undo (Ctrl+Z)" onClick={undo} className="rounded py-1 text-xs hover:bg-neutral-100">
          ↶ Undo
        </button>
        <button title="Redo (Ctrl+Y)" onClick={redo} className="rounded py-1 text-xs hover:bg-neutral-100">
          ↷ Redo
        </button>
        <button title="Toggle grid (G)" onClick={toggleGrid} className={`rounded py-1 text-xs ${showGrid ? 'bg-neutral-800 text-white' : 'hover:bg-neutral-100'}`}>
          Grid
        </button>
      </div>
    </div>
  );
}
