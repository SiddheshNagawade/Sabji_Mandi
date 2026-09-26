import { useAppStore } from '../app/store';
import { CanvasEditor } from '../editor/CanvasEditor';
import { Toolbar } from '../editor/panels/Toolbar';
import { Palette } from '../editor/panels/Palette';
import { LayersPanel } from '../editor/panels/LayersPanel';
import { PropertiesPanel } from '../editor/panels/PropertiesPanel';
import { LinterPanel, useLintCellSet } from '../editor/panels/LinterPanel';
import { createSyntheticExampleProject } from '../data/sampleProject';

export function EditorScreen() {
  const projectName = useAppStore((s) => s.project.meta.name);
  const isSynthetic = useAppStore((s) => s.project.meta.isSyntheticExample);
  const setProject = useAppStore((s) => s.setProject);
  const newProject = useAppStore((s) => s.newProject);
  const lintCells = useLintCellSet();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-neutral-200 bg-white px-2 py-1 text-xs">
        <span className="text-neutral-500">Scenario:</span>
        <span className="rounded bg-neutral-100 px-2 py-0.5 font-medium">Baseline</span>
        {isSynthetic && <span className="rounded bg-amber-100 px-2 py-0.5 font-medium text-amber-800">SYNTHETIC EXAMPLE, NOT THE REAL MANDI</span>}
        <div className="ml-auto flex gap-2">
          <button className="rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-50" onClick={() => newProject()}>
            New blank project
          </button>
          <button className="rounded border border-neutral-300 px-2 py-0.5 hover:bg-neutral-50" onClick={() => setProject(createSyntheticExampleProject())}>
            Load synthetic example
          </button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <Toolbar />
        <Palette />
        <div className="min-w-0 flex-1">
          <CanvasEditor lintCells={lintCells} />
        </div>
        <div className="flex w-64 shrink-0 flex-col overflow-y-auto border-l border-neutral-300 bg-white">
          <div className="border-b border-neutral-200 px-2 py-1 text-xs font-semibold text-neutral-500">Properties</div>
          <PropertiesPanel />
          <LayersPanel />
          <LinterPanel />
        </div>
      </div>
      <div className="border-t border-neutral-200 bg-white px-3 py-1 text-[11px] text-neutral-400">
        Project: {projectName} — time-rule timeline (phases, barriers, vehicle windows) arrives in Milestone M4.
      </div>
    </div>
  );
}
