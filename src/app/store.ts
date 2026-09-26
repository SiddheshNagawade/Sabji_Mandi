import { create } from 'zustand';
import type { CellChange, Dir4, EntranceType, Layout, LayoutObject, Project, ProduceCategory, XY } from '../data/schema';
import { createBlankProject } from '../data/defaults';
import { downloadProjectFile, readProjectFile, saveAutosave } from '../data/io';
import { rebuildObjectLayer } from '../editor/objectLayer';
import {
  buildAddEntranceCommand,
  buildAddStallCommand,
  buildAddTransectCommand,
  buildDeleteObjectCommand,
  buildMultiValuePaintCommand,
  buildPaintCommand,
  buildUpdateObjectCommand,
  nextObjectId,
} from '../editor/commands';

export type LayerName = 'terrain' | 'object' | 'flow' | 'flowGroup' | 'zone' | 'shade' | 'locked';
export type PaintLayer = 'terrain' | 'zone' | 'shade' | 'locked';

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
  paintLayer: PaintLayer;
  brushTileId: number;
  brushSize: number;
  arrowDirCode: number; // 1..8, see FLOW_DIRS
  stallSize: { w: number; h: number };
  stallFrontEdge: Dir4;
  stallProduce: ProduceCategory[];
  entranceType: EntranceType;
  layerVisible: Record<LayerName | 'background', boolean>;
  layerLocked: Record<LayerName, boolean>;
  selectedObjectId: number | null;
  showGrid: boolean;
  recordingInterventionId: number | null;
  bgMode: 'none' | 'move' | 'calibrate';
  calibrationClicks: XY[];
  focusCell: XY | null;

  setProject: (project: Project) => void;
  newProject: (name?: string, width?: number, height?: number) => void;
  loadProjectFile: (file: File) => Promise<void>;
  saveProjectFile: () => void;
  autosave: () => Promise<void>;

  applyCommand: (cmd: EditorCommand) => void;
  undo: () => void;
  redo: () => void;

  setTool: (tool: EditorTool) => void;
  setPaintLayer: (layer: PaintLayer) => void;
  setBrushTile: (tileId: number) => void;
  setBrushSize: (size: number) => void;
  rotateArrowDir: () => void;
  setArrowDirCode: (code: number) => void;
  setStallSize: (w: number, h: number) => void;
  rotateStallFootprint: () => void;
  flipStallFrontEdge: () => void;
  setStallProduce: (produce: ProduceCategory[]) => void;
  setEntranceType: (type: EntranceType) => void;
  toggleLayerVisible: (layer: LayerName | 'background') => void;
  toggleLayerLocked: (layer: LayerName) => void;
  setSelectedObjectId: (id: number | null) => void;
  toggleGrid: () => void;

  paintCells: (cells: XY[], value: number, label: string) => void;
  addArrowStroke: (cells: { x: number; y: number; value: number }[]) => void;
  addStall: (x0: number, y0: number, w: number, h: number, frontEdge: Dir4) => void;
  addEntrance: (cells: XY[], type: EntranceType) => void;
  addTransect: (a: XY, b: XY) => void;
  deleteSelectedObject: () => void;
  updateSelectedObject: (updater: (obj: LayoutObject) => LayoutObject) => void;

  setBackgroundImage: (imageDataUrl: string) => void;
  setBackgroundOpacity: (opacity: number) => void;
  setBackgroundRotation: (deg: number) => void;
  moveBackgroundBy: (dxCells: number, dyCells: number) => void;
  setBgMode: (mode: 'none' | 'move' | 'calibrate') => void;
  addCalibrationClick: (cell: XY) => void;
  clearCalibration: () => void;
  applyCalibration: (realMetres: number) => void;
  setFocusCell: (cell: XY | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  project: createBlankProject(),
  activeScenarioId: 'baseline',
  history: [],
  historyIndex: 0,
  layoutVersion: 0,

  tool: 'select',
  paintLayer: 'terrain',
  brushTileId: 0,
  brushSize: 1,
  arrowDirCode: 3, // East
  stallSize: { w: 4, h: 3 },
  stallFrontEdge: 'S',
  stallProduce: ['mixed_other'],
  entranceType: 'ped_in',
  layerVisible: { terrain: true, object: true, flow: true, flowGroup: true, zone: false, shade: true, locked: true, background: true },
  layerLocked: { terrain: false, object: false, flow: false, flowGroup: false, zone: false, shade: false, locked: false },
  selectedObjectId: null,
  showGrid: true,
  recordingInterventionId: null,
  bgMode: 'none',
  calibrationClicks: [],
  focusCell: null,

  setProject: (project) => {
    set({ project, history: [], historyIndex: 0, layoutVersion: 0, selectedObjectId: null });
    void get().autosave();
  },

  newProject: (name = 'Untitled Mandi', width, height) => {
    const project = createBlankProject(name, width, height);
    set({ project, history: [], historyIndex: 0, layoutVersion: 0, selectedObjectId: null, activeScenarioId: 'baseline' });
    void get().autosave();
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
    if (cmd.objectsAfter) {
      layout.objects = cmd.objectsAfter;
      rebuildObjectLayer(layout, width, project.grid.height);
    }
    const newHistory = history.slice(0, historyIndex);
    newHistory.push(cmd);
    set({
      project: { ...project, meta: { ...project.meta, updatedAt: new Date().toISOString() } },
      history: newHistory,
      historyIndex: newHistory.length,
      layoutVersion: get().layoutVersion + 1,
    });
    void get().autosave();
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
    if (cmd.objectsBefore) {
      layout.objects = cmd.objectsBefore;
      rebuildObjectLayer(layout, width, project.grid.height);
    }
    set({ historyIndex: historyIndex - 1, layoutVersion: get().layoutVersion + 1 });
    void get().autosave();
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
    if (cmd.objectsAfter) {
      layout.objects = cmd.objectsAfter;
      rebuildObjectLayer(layout, width, project.grid.height);
    }
    set({ historyIndex: historyIndex + 1, layoutVersion: get().layoutVersion + 1 });
    void get().autosave();
  },

  setTool: (tool) => set({ tool, selectedObjectId: null }),
  setPaintLayer: (paintLayer) => set({ paintLayer }),
  setBrushTile: (tileId) => set({ brushTileId: tileId }),
  setBrushSize: (size) => set({ brushSize: size }),
  rotateArrowDir: () => set((s) => ({ arrowDirCode: (s.arrowDirCode % 8) + 1 })),
  setArrowDirCode: (code) => set({ arrowDirCode: code }),
  setStallSize: (w, h) => set({ stallSize: { w, h } }),
  rotateStallFootprint: () => set((s) => ({ stallSize: { w: s.stallSize.h, h: s.stallSize.w } })),
  flipStallFrontEdge: () => set((s) => ({ stallFrontEdge: nextEdge(s.stallFrontEdge) })),
  setStallProduce: (produce) => set({ stallProduce: produce }),
  setEntranceType: (entranceType) => set({ entranceType }),
  toggleLayerVisible: (layer) => set((s) => ({ layerVisible: { ...s.layerVisible, [layer]: !s.layerVisible[layer] } })),
  toggleLayerLocked: (layer) => set((s) => ({ layerLocked: { ...s.layerLocked, [layer]: !s.layerLocked[layer] } })),
  setSelectedObjectId: (id) => set({ selectedObjectId: id }),
  toggleGrid: () => set((s) => ({ showGrid: !s.showGrid })),

  paintCells: (cells, value, label) => {
    const { project, paintLayer } = get();
    const cmd = buildPaintCommand(project.baseline, project.grid.width, project.grid.height, cells, paintLayer, value, label);
    if (cmd) get().applyCommand(cmd);
  },

  addArrowStroke: (cells) => {
    const { project } = get();
    const cmd = buildMultiValuePaintCommand(project.baseline, project.grid.width, project.grid.height, cells, 'flow', 'Draw arrows');
    if (cmd) get().applyCommand(cmd);
  },

  addStall: (x0, y0, w, h, frontEdge) => {
    const { project, stallProduce } = get();
    const cmd = buildAddStallCommand(project.baseline, project.grid.width, project.grid.height, x0, y0, w, h, frontEdge, stallProduce, nextObjectId(project.baseline));
    get().applyCommand(cmd);
  },

  addEntrance: (cells, type) => {
    const { project } = get();
    const cmd = buildAddEntranceCommand(project.baseline, project.grid.width, project.grid.height, cells, type, nextObjectId(project.baseline));
    get().applyCommand(cmd);
  },

  addTransect: (a, b) => {
    const { project } = get();
    get().applyCommand(buildAddTransectCommand(project.baseline, a, b, nextObjectId(project.baseline)));
  },

  deleteSelectedObject: () => {
    const { project, selectedObjectId } = get();
    if (selectedObjectId == null) return;
    const cmd = buildDeleteObjectCommand(project.baseline, project.grid.width, project.grid.height, selectedObjectId);
    if (cmd) get().applyCommand(cmd);
    set({ selectedObjectId: null });
  },

  updateSelectedObject: (updater) => {
    const { project, selectedObjectId } = get();
    if (selectedObjectId == null) return;
    const cmd = buildUpdateObjectCommand(project.baseline, selectedObjectId, updater);
    if (cmd) get().applyCommand(cmd);
  },

  setBackgroundImage: (imageDataUrl) =>
    set((s) => ({
      project: {
        ...s.project,
        background: { imageDataUrl, opacity: 0.6, originCell: { x: 0, y: 0 }, scaleCellsPerPixel: 1, rotationDeg: 0 },
      },
    })),

  setBackgroundOpacity: (opacity) =>
    set((s) => (s.project.background ? { project: { ...s.project, background: { ...s.project.background, opacity } } } : {})),

  setBackgroundRotation: (deg) =>
    set((s) => (s.project.background ? { project: { ...s.project, background: { ...s.project.background, rotationDeg: deg } } } : {})),

  moveBackgroundBy: (dxCells, dyCells) =>
    set((s) => {
      if (!s.project.background) return {};
      const { originCell } = s.project.background;
      return { project: { ...s.project, background: { ...s.project.background, originCell: { x: originCell.x + dxCells, y: originCell.y + dyCells } } } };
    }),

  setBgMode: (mode) => set({ bgMode: mode, calibrationClicks: [] }),
  addCalibrationClick: (cell) => set((s) => ({ calibrationClicks: [...s.calibrationClicks, cell].slice(-2) })),
  clearCalibration: () => set({ calibrationClicks: [] }),

  applyCalibration: (realMetres) => {
    const { project, calibrationClicks } = get();
    const bg = project.background;
    if (!bg || calibrationClicks.length < 2) return;
    const [a, b] = calibrationClicks;
    const pxA = { x: (a.x - bg.originCell.x) / bg.scaleCellsPerPixel, y: (a.y - bg.originCell.y) / bg.scaleCellsPerPixel };
    const pxB = { x: (b.x - bg.originCell.x) / bg.scaleCellsPerPixel, y: (b.y - bg.originCell.y) / bg.scaleCellsPerPixel };
    const pixelDist = Math.hypot(pxB.x - pxA.x, pxB.y - pxA.y);
    if (pixelDist === 0) return;
    const cellSizeM = project.grid.cellSizeM.value;
    const metresPerPixel = realMetres / pixelDist;
    const scaleCellsPerPixel = metresPerPixel / cellSizeM;
    set({
      project: { ...project, background: { ...bg, scaleCellsPerPixel, calibration: { pxA, pxB, realMetres } } },
      bgMode: 'none',
      calibrationClicks: [],
    });
  },
  setFocusCell: (cell) => set({ focusCell: cell }),
}));

function nextEdge(edge: Dir4): Dir4 {
  const order: Dir4[] = ['N', 'E', 'S', 'W'];
  return order[(order.indexOf(edge) + 1) % 4];
}

function writeCell(layout: Layout, width: number, c: CellChange) {
  const idx = c.y * width + c.x;
  (layout[c.layer] as Uint8Array | Uint16Array)[idx] = c.value;
}
