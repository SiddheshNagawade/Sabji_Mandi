import { create } from 'zustand';
import type { CellChange, Layout, Project } from '../data/schema';
import { createBlankProject } from '../data/defaults';
import { downloadProjectFile, readProjectFile, saveAutosave } from '../data/io';

export type LayerName = 'terrain' | 'object' | 'flow' | 'flowGroup' | 'zone' | 'shade' | 'locked';

export interface EditorCommand {
  label: string;
  /** Values to apply on redo/apply. */
  patch: CellChange[];
  /** Values to restore on undo (captured before patch was first applied). */
  inverse: CellChange[];
  /** Object-table changes bundled with this command (stalls/entrances/etc.), optional. */
  objectsBefore?: Layout['objects'];
  objectsAfter?: Layout['objects'];
}

export type EditorTool =
  | 'select'
  | 'brush'
  | 'rect'
  | 'line'
  | 'fill'
  | 'eraser'
  | 'eyedropper'
  | 'arrow'
  | 'stall'
  | 'entrance'
  | 'measure'
  | 'transect';

interface AppState {
  project: Project;
  activeScenarioId: string;
  history: EditorCommand[];
  historyIndex: number; // points just past the last applied command
  layoutVersion: number;

  // Editor UI state
  tool: EditorTool;
  brushTileId: number;
  brushSize: number;
  arrowDirDeg: number;
  layerVisible: Record<LayerName | 'background', boolean>;
  layerLocked: Record<LayerName, boolean>;
  selectedObjectId: number | null;
  showGrid: boolean;
  recordingInterventionId: number | null;

  setProject: (project: Project) => void;
  newProject: (name?: string, width?: number, height?: number) => void;
  loadProjectFile: (file: File) => Promise<void>;
  saveProjectFile: () => void;
  autosave: () => Promise<void>;

  applyCommand: (cmd: EditorCommand) => void;
  undo: () => void;
  redo: () => void;

  setTool: (tool: EditorTool) => void;
  setBrushTile: (tileId: number) => void;
  setBrushSize: (size: number) => void;
  toggleLayerVisible: (layer: LayerName | 'background') => void;
  toggleLayerLocked: (layer: LayerName) => void;
  setSelectedObjectId: (id: number | null) => void;
  toggleGrid: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  project: createBlankProject(),
  activeScenarioId: 'baseline',
  history: [],
  historyIndex: 0,
  layoutVersion: 0,

  tool: 'select',
  brushTileId: 0,
  brushSize: 1,
  arrowDirDeg: 0,
  layerVisible: { terrain: true, object: true, flow: true, flowGroup: true, zone: false, shade: true, locked: true, background: true },
  layerLocked: { terrain: false, object: false, flow: false, flowGroup: false, zone: false, shade: false, locked: false },
  selectedObjectId: null,
  showGrid: true,
  recordingInterventionId: null,

  setProject: (project) => set({ project, history: [], historyIndex: 0, layoutVersion: 0, selectedObjectId: null }),

  newProject: (name = 'Untitled Mandi', width, height) => {
    const project = createBlankProject(name, width, height);
    set({ project, history: [], historyIndex: 0, layoutVersion: 0, selectedObjectId: null, activeScenarioId: 'baseline' });
  },

  loadProjectFile: async (file: File) => {
    const project = await readProjectFile(file);
    get().setProject(project);
  },

  saveProjectFile: () => {
    downloadProjectFile(get().project);
  },

  autosave: async () => {
    await saveAutosave(get().project);
  },

  applyCommand: (cmd) => {
    const { project, history, historyIndex } = get();
    const layout = project.baseline;
    const width = project.grid.width;
    for (const c of cmd.patch) {
      writeCell(layout, width, c);
    }
    if (cmd.objectsAfter) layout.objects = cmd.objectsAfter;
    const newHistory = history.slice(0, historyIndex);
    newHistory.push(cmd);
    set({
      project: { ...project, meta: { ...project.meta, updatedAt: new Date().toISOString() } },
      history: newHistory,
      historyIndex: newHistory.length,
      layoutVersion: get().layoutVersion + 1,
    });
  },

  undo: () => {
    const { project, history, historyIndex } = get();
    if (historyIndex === 0) return;
    const cmd = history[historyIndex - 1];
    const layout = project.baseline;
    const width = project.grid.width;
    for (const c of cmd.inverse) {
      writeCell(layout, width, c);
    }
    if (cmd.objectsBefore) layout.objects = cmd.objectsBefore;
    set({ historyIndex: historyIndex - 1, layoutVersion: get().layoutVersion + 1 });
  },

  redo: () => {
    const { project, history, historyIndex } = get();
    if (historyIndex >= history.length) return;
    const cmd = history[historyIndex];
    const layout = project.baseline;
    const width = project.grid.width;
    for (const c of cmd.patch) {
      writeCell(layout, width, c);
    }
    if (cmd.objectsAfter) layout.objects = cmd.objectsAfter;
    set({ historyIndex: historyIndex + 1, layoutVersion: get().layoutVersion + 1 });
  },

  setTool: (tool) => set({ tool, selectedObjectId: null }),
  setBrushTile: (tileId) => set({ brushTileId: tileId }),
  setBrushSize: (size) => set({ brushSize: size }),
  toggleLayerVisible: (layer) => set((s) => ({ layerVisible: { ...s.layerVisible, [layer]: !s.layerVisible[layer] } })),
  toggleLayerLocked: (layer) => set((s) => ({ layerLocked: { ...s.layerLocked, [layer]: !s.layerLocked[layer] } })),
  setSelectedObjectId: (id) => set({ selectedObjectId: id }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),
}));

function writeCell(layout: Layout, width: number, c: CellChange) {
  const idx = c.y * width + c.x;
  (layout[c.layer] as Uint8Array | Uint16Array)[idx] = c.value;
}
