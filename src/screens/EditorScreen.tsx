import { useAppStore } from '../app/store';
import { CanvasEditor } from '../editor/CanvasEditor';
import { BlockHotbar } from '../editor/panels/BlockHotbar';
import { InspectorFloating } from '../editor/panels/InspectorFloating';
import { UtilityRail } from '../editor/panels/UtilityRail';
import { RulesDrawer } from '../editor/panels/RulesDrawer';
import { useLintCellSet } from '../editor/panels/LinterPanel';
import { createSyntheticExampleProject } from '../data/sampleProject';

export function EditorScreen() {
  const projectName = useAppStore((s) => s.project.meta.name);
  const isSynthetic = useAppStore((s) => s.project.meta.isSyntheticExample);
  const gridWidth = useAppStore((s) => s.project.grid.width);
  const gridHeight = useAppStore((s) => s.project.grid.height);
  const setProject = useAppStore((s) => s.setProject);
  const newProject = useAppStore((s) => s.newProject);
  const lintCells = useLintCellSet();

  return (
    <div className="flex h-full flex-col" style={{ background: 'var(--color-bg)' }}>
      <div className="flex items-center gap-2 border-b px-3 py-1.5 text-xs" style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
        <span style={{ color: 'var(--color-text-muted)' }}>{projectName}</span>
        <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-hover)' }}>
          Baseline
        </span>
        <span className="text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
          {gridWidth} × {gridHeight} cells
        </span>
        {isSynthetic && (
          <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: '#FDF1D8', color: '#8A5A11' }}>
            Synthetic example — not the real mandi
          </span>
        )}
        <div className="ml-auto flex gap-2">
          <button
            className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition hover:brightness-95"
            style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
            onClick={() => newProject()}
          >
            New blank project
          </button>
          <button
            className="rounded-lg px-2.5 py-1 text-[11px] font-medium transition hover:brightness-95"
            style={{ border: '1px solid var(--color-border-strong)', color: 'var(--color-text)' }}
            onClick={() => setProject(createSyntheticExampleProject())}
          >
            Load synthetic example
          </button>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <CanvasEditor lintCells={lintCells} />
        <UtilityRail />
        <RulesDrawer />
        <InspectorFloating />
        <BlockHotbar />
      </div>
    </div>
  );
}
