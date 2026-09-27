import { useAppStore } from '../app/store';
import { CanvasEditor } from '../editor/CanvasEditor';
import { ToolRail } from '../editor/panels/ToolRail';
import { PropertiesDock } from '../editor/panels/PropertiesDock';
import { RulesDrawer } from '../editor/panels/RulesDrawer';
import { StatusBar } from '../editor/panels/StatusBar';
import { useLintCellSet } from '../editor/panels/LinterPanel';

export function EditorScreen() {
  const projectName = useAppStore((s) => s.project.meta.name);
  const isSynthetic = useAppStore((s) => s.project.meta.isSyntheticExample);
  const lintCells = useLintCellSet();

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--color-bg)' }}>
      <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>{projectName}</span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-hover)' }}>
          Baseline
        </span>
        {isSynthetic && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: '#FDF1D8', color: '#8A5A11' }}>
            Synthetic example — not the real mandi
          </span>
        )}
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <CanvasEditor lintCells={lintCells} />
          <ToolRail />
          <RulesDrawer />
        </div>
        <PropertiesDock />
      </div>
      <StatusBar />
    </div>
  );
}
