import { useAppStore } from '../../app/store';
import { PropertiesPanel } from './PropertiesPanel';

// Only appears when something is selected — no permanent side panel eating
// canvas space when there's nothing to inspect.
export function InspectorFloating() {
  const selectedObjectId = useAppStore((s) => s.selectedObjectId);
  const setSelectedObjectId = useAppStore((s) => s.setSelectedObjectId);
  if (selectedObjectId == null) return null;

  return (
    <div
      className="pointer-events-auto absolute right-4 top-4 w-72 overflow-hidden rounded-2xl"
      style={{ background: 'rgba(255,255,255,0.96)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)', backdropFilter: 'blur(10px)' }}
    >
      <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'var(--color-border)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
          Properties
        </span>
        <button onClick={() => setSelectedObjectId(null)} className="rounded-md px-1.5 py-0.5 text-xs text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700">
          ✕
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto">
        <PropertiesPanel />
      </div>
    </div>
  );
}
