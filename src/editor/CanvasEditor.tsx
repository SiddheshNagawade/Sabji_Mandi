import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../app/store';
import type { XY } from '../data/schema';
import { TILE_INFO } from '../data/schema';
import { PRIMARY_BLOCKS } from './blocks';
import { applyBrushSize, floodFillIndices, idx, inBounds, quantizeDirection, rasterLine, rasterRect } from './grid';
import { objectAtCell } from './objectLayer';
import { fitToScreen } from './viewport';
import type { LayerVisibility, Viewport } from '../viz/renderTiles';
import { CANVAS_PAPER_COLOR, TERRAIN_ALPHA, cellToScreen, drawArrow, drawScene, screenToCell } from '../viz/renderTiles';

// How close (in cells) to the current right/bottom edge triggers growth, and
// how many cells to grow by each time — gives the user room to keep dragging
// without hitting a hard wall (SPEC-driven UX: "the sheet gets larger as I draw").
const GROW_MARGIN = 6;
const GROW_CHUNK = 16;

function ensureCapacityFor(cell: XY): { width: number; height: number } {
  const s = useAppStore.getState();
  const w = s.project.grid.width;
  const h = s.project.grid.height;
  let newWidth = w;
  let newHeight = h;
  if (cell.x >= w - GROW_MARGIN) newWidth = cell.x + GROW_CHUNK;
  if (cell.y >= h - GROW_MARGIN) newHeight = cell.y + GROW_CHUNK;
  if (newWidth > w || newHeight > h) {
    s.growGrid(newWidth, newHeight);
    const s2 = useAppStore.getState();
    return { width: s2.project.grid.width, height: s2.project.grid.height };
  }
  return { width: w, height: h };
}

export function CanvasEditor({ lintCells }: { lintCells: Set<string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [renderTick, forceRender] = useState(0);

  const project = useAppStore((s) => s.project);
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const tool = useAppStore((s) => s.tool);
  const paintLayer = useAppStore((s) => s.paintLayer);
  const brushTileId = useAppStore((s) => s.brushTileId);
  const brushSize = useAppStore((s) => s.brushSize);
  const arrowDirCode = useAppStore((s) => s.arrowDirCode);
  const stallSize = useAppStore((s) => s.stallSize);
  const stallFrontEdge = useAppStore((s) => s.stallFrontEdge);
  const entranceType = useAppStore((s) => s.entranceType);
  const vehicleBayType = useAppStore((s) => s.vehicleBayType);
  const layerVisible = useAppStore((s) => s.layerVisible);
  const selectedObjectId = useAppStore((s) => s.selectedObjectId);
  const showGrid = useAppStore((s) => s.showGrid);
  const bgMode = useAppStore((s) => s.bgMode);
  const calibrationClicks = useAppStore((s) => s.calibrationClicks);
  const focusCell = useAppStore((s) => s.focusCell);
  const setFocusCell = useAppStore((s) => s.setFocusCell);

  const setTool = useAppStore((s) => s.setTool);
  const setBrushTile = useAppStore((s) => s.setBrushTile);
  const setBrushSize = useAppStore((s) => s.setBrushSize);
  const rotateArrowDir = useAppStore((s) => s.rotateArrowDir);
  const rotateStallFootprint = useAppStore((s) => s.rotateStallFootprint);
  const flipStallFrontEdge = useAppStore((s) => s.flipStallFrontEdge);
  const setSelectedObjectId = useAppStore((s) => s.setSelectedObjectId);
  const toggleGrid = useAppStore((s) => s.toggleGrid);
  const setActiveBlock = useAppStore((s) => s.setActiveBlock);
  const paintCells = useAppStore((s) => s.paintCells);
  const addArrowStroke = useAppStore((s) => s.addArrowStroke);
  const addStall = useAppStore((s) => s.addStall);
  const addEntrance = useAppStore((s) => s.addEntrance);
  const addTransect = useAppStore((s) => s.addTransect);
  const addBarrier = useAppStore((s) => s.addBarrier);
  const addVehicleBay = useAppStore((s) => s.addVehicleBay);
  const deleteSelectedObject = useAppStore((s) => s.deleteSelectedObject);
  const addCalibrationClick = useAppStore((s) => s.addCalibrationClick);
  const applyCalibration = useAppStore((s) => s.applyCalibration);
  const moveBackgroundBy = useAppStore((s) => s.moveBackgroundBy);
  const viewport = useAppStore((s) => s.viewport);
  const setViewport = useAppStore((s) => s.setViewport);
  const setViewportSize = useAppStore((s) => s.setViewportSize);
  const hoverCell = useAppStore((s) => s.hoverCell);
  const setHoverCell = useAppStore((s) => s.setHoverCell);

  const width = project.grid.width;
  const height = project.grid.height;
  const layout = project.baseline;
  const vehicleTypeFootprints = project.demand.vehicleTypes;

  const [measureEnd, setMeasureEnd] = useState<XY | null>(null);
  const [measureStart, setMeasureStart] = useState<XY | null>(null);
  const [previewRect, setPreviewRect] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [calibPromptOpen, setCalibPromptOpen] = useState(false);
  const [calibMetres, setCalibMetres] = useState('1');

  const dragRef = useRef<{ active: boolean; button: number; shift: boolean; alt: boolean; start: XY; last: XY }>({
    active: false,
    button: 0,
    shift: false,
    alt: false,
    start: { x: 0, y: 0 },
    last: { x: 0, y: 0 },
  });
  const paintMapRef = useRef<Map<string, XY>>(new Map());
  const arrowMapRef = useRef<Map<string, { x: number; y: number; value: number }>>(new Map());
  const panRef = useRef<{ active: boolean; lastScreen: XY }>({ active: false, lastScreen: { x: 0, y: 0 } });
  const spaceHeldRef = useRef(false);

  // Load background image whenever the data URL changes.
  useEffect(() => {
    const url = project.background?.imageDataUrl;
    if (!url) {
      bgImageRef.current = null;
      forceRender((n) => n + 1);
      return;
    }
    const img = new Image();
    img.onload = () => {
      bgImageRef.current = img;
      forceRender((n) => n + 1);
    };
    img.src = url;
  }, [project.background?.imageDataUrl]);

  // Fit canvas to container size.
  useEffect(() => {
    const el = containerRef.current;
    const canvas = canvasRef.current;
    if (!el || !canvas) return;
    const ro = new ResizeObserver(() => {
      canvas.width = el.clientWidth;
      canvas.height = el.clientHeight;
      setViewportSize({ width: el.clientWidth, height: el.clientHeight });
      forceRender((n) => n + 1);
    });
    ro.observe(el);
    canvas.width = el.clientWidth;
    canvas.height = el.clientHeight;
    setViewportSize({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lintCellSet = lintCells;

  // Redraw.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const lv: LayerVisibility = {
      terrain: layerVisible.terrain,
      object: layerVisible.object,
      flow: layerVisible.flow,
      zone: layerVisible.zone,
      shade: layerVisible.shade,
      locked: layerVisible.locked,
      background: layerVisible.background,
    };
    drawScene(ctx, layout, width, height, viewport, {
      showGrid,
      layerVisible: lv,
      selectedObjectId,
      lintCells: lintCellSet,
      backgroundImageEl: bgImageRef.current,
      backgroundOpacity: project.background?.opacity,
    });

    // Live stroke-in-progress preview: paintMapRef/arrowMapRef are refs (mutated
    // per pointer move without a state update of their own), so without this the
    // canvas would only show a stroke once it's committed on pointer-up. renderTick
    // is bumped alongside those mutations to force this effect to re-run mid-drag.
    if (paintMapRef.current.size > 0) {
      const z = viewport.zoom;
      const isEraser = tool === 'eraser';
      ctx.globalAlpha = TERRAIN_ALPHA;
      ctx.fillStyle = isEraser ? CANVAS_PAPER_COLOR : (TILE_INFO[brushTileId]?.color ?? '#999');
      for (const c of paintMapRef.current.values()) {
        const p = cellToScreen(viewport, c.x, c.y);
        ctx.fillRect(p.x, p.y, z, z);
      }
      ctx.globalAlpha = 1;
    }
    if (arrowMapRef.current.size > 0) {
      for (const a of arrowMapRef.current.values()) {
        drawArrow(ctx, viewport, a.x, a.y, a.value);
      }
    }

    // Ephemeral overlays: preview rect, measure line, calibration points, pending arrow rect.
    if (previewRect) {
      const a = cellToScreen(viewport, previewRect.x0, previewRect.y0);
      const b = cellToScreen(viewport, previewRect.x1 + 1, previewRect.y1 + 1);
      ctx.strokeStyle = '#FFD23F';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    }
    if (measureStart && measureEnd) {
      const a = cellToScreen(viewport, measureStart.x + 0.5, measureStart.y + 0.5);
      const b = cellToScreen(viewport, measureEnd.x + 0.5, measureEnd.y + 0.5);
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const distCells = Math.hypot(measureEnd.x - measureStart.x, measureEnd.y - measureStart.y);
      const metres = distCells * project.grid.cellSizeM.value;
      ctx.fillStyle = '#111';
      ctx.font = '12px sans-serif';
      ctx.fillText(`${metres.toFixed(2)} m (${distCells.toFixed(1)} cells)`, (a.x + b.x) / 2 + 6, (a.y + b.y) / 2 - 6);
    }
    for (const c of calibrationClicks) {
      const p = cellToScreen(viewport, c.x + 0.5, c.y + 0.5);
      ctx.fillStyle = '#E4572E';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (hoverHighlightTool(tool) && hoverCell) {
      const cells = ghostCells(tool, hoverCell, brushSize, stallSize);
      ctx.fillStyle = 'rgba(255,210,63,0.35)';
      for (const c of cells) {
        const p = cellToScreen(viewport, c.x, c.y);
        ctx.fillRect(p.x, p.y, viewport.zoom, viewport.zoom);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutVersion, viewport, layerVisible, showGrid, selectedObjectId, lintCellSet, previewRect, measureStart, measureEnd, calibrationClicks, hoverCell, tool, brushTileId, brushSize, stallSize, project.background, renderTick]);

  const getCellFromEvent = useCallback(
    (e: { clientX: number; clientY: number }): XY => {
      const canvas = canvasRef.current;
      const rect = canvas!.getBoundingClientRect();
      return screenToCell(viewport, e.clientX - rect.left, e.clientY - rect.top);
    },
    [viewport],
  );

  const paintTileValue = tool === 'eraser' ? 0 : brushTileId;

  const commitPaintMap = useCallback(
    (label: string) => {
      const cells = Array.from(paintMapRef.current.values());
      paintMapRef.current.clear();
      if (cells.length > 0) paintCells(cells, paintTileValue, label);
    },
    [paintCells, paintTileValue],
  );

  const addBrushStrokeCells = useCallback(
    (from: XY, to: XY) => {
      const line = rasterLine(from.x, from.y, to.x, to.y);
      const expanded = applyBrushSize(line, brushSize);
      for (const c of expanded) {
        if (inBounds(c.x, c.y, width, height)) paintMapRef.current.set(`${c.x},${c.y}`, c);
      }
      forceRender((n) => n + 1);
    },
    [brushSize, width, height],
  );

  const addArrowStrokeCells = useCallback(
    (from: XY, to: XY) => {
      const line = rasterLine(from.x, from.y, to.x, to.y);
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1];
        const b = line[i];
        const dirCode = quantizeDirection(b.x - a.x, b.y - a.y);
        if (dirCode === 0) continue;
        const expanded = applyBrushSize([b], brushSize);
        for (const c of expanded) {
          if (inBounds(c.x, c.y, width, height)) arrowMapRef.current.set(`${c.x},${c.y}`, { x: c.x, y: c.y, value: dirCode });
        }
      }
      if (line.length === 1) {
        const expanded = applyBrushSize([line[0]], brushSize);
        for (const c of expanded) {
          if (inBounds(c.x, c.y, width, height)) arrowMapRef.current.set(`${c.x},${c.y}`, { x: c.x, y: c.y, value: arrowDirCode });
        }
      }
      forceRender((n) => n + 1);
    },
    [brushSize, width, height, arrowDirCode],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      const cell = getCellFromEvent(e);

      if (panRef.current.active || spaceHeldRef.current || e.button === 1) {
        panRef.current = { active: true, lastScreen: { x: e.clientX, y: e.clientY } };
        return;
      }

      if (bgMode === 'calibrate') {
        if (!inBounds(cell.x, cell.y, width, height)) return;
        addCalibrationClick(cell);
        if (calibrationClicks.length === 1) setCalibPromptOpen(true);
        return;
      }
      if (bgMode === 'move') {
        panRef.current = { active: true, lastScreen: { x: e.clientX, y: e.clientY } };
        return;
      }

      const effectiveTool = e.button === 2 ? 'eraser' : tool;
      // Placing/painting near the current right/bottom edge grows the grid first,
      // so a drag never hits a hard wall mid-stroke.
      const bounds = effectiveTool === 'select' ? { width, height } : ensureCapacityFor(cell);
      if (!inBounds(cell.x, cell.y, bounds.width, bounds.height)) return;

      dragRef.current = { active: true, button: e.button, shift: e.shiftKey, alt: e.altKey, start: cell, last: cell };

      if (effectiveTool === 'select') {
        const obj = objectAtCell(layout, width, height, cell.x, cell.y);
        setSelectedObjectId(obj?.id ?? null);
        dragRef.current.active = false;
        return;
      }
      if (effectiveTool === 'eyedropper') {
        const arr = layout[paintLayer] as Uint8Array;
        setBrushTile(arr[idx(cell.x, cell.y, width)]);
        setTool('brush');
        dragRef.current.active = false;
        return;
      }
      if (effectiveTool === 'fill') {
        const arr = layout[paintLayer] as Uint8Array;
        const target = arr[idx(cell.x, cell.y, width)];
        const indices = floodFillIndices(cell.x, cell.y, width, height, (i) => arr[i] === target);
        const cells = indices.map((i) => ({ x: i % width, y: Math.floor(i / width) }));
        paintCells(cells, brushTileId, 'Fill');
        dragRef.current.active = false;
        return;
      }
      if (effectiveTool === 'brush' || effectiveTool === 'eraser') {
        if (e.shiftKey) return; // shift-drag fills a rectangle instead; handled on move/up
        paintMapRef.current.clear();
        addBrushStrokeCells(cell, cell);
        return;
      }
      if (effectiveTool === 'arrow') {
        arrowMapRef.current.clear();
        addArrowStrokeCells(cell, cell);
        return;
      }
      if (effectiveTool === 'measure') {
        setMeasureStart(cell);
        setMeasureEnd(cell);
        return;
      }
      // rect, line, stall, entrance, transect: just record start; handled on move/up
    },
    [
      addBrushStrokeCells,
      addArrowStrokeCells,
      addCalibrationClick,
      bgMode,
      brushTileId,
      calibrationClicks.length,
      getCellFromEvent,
      height,
      layout,
      paintCells,
      paintLayer,
      setBrushTile,
      setSelectedObjectId,
      setTool,
      tool,
      width,
    ],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const cell = getCellFromEvent(e);
      setHoverCell(inBounds(cell.x, cell.y, width, height) ? cell : null);

      if (panRef.current.active) {
        const dx = e.clientX - panRef.current.lastScreen.x;
        const dy = e.clientY - panRef.current.lastScreen.y;
        panRef.current.lastScreen = { x: e.clientX, y: e.clientY };
        if (bgMode === 'move') {
          moveBackgroundBy(dx / viewport.zoom, dy / viewport.zoom);
        } else {
          setViewport((v) => ({ ...v, originX: v.originX + dx, originY: v.originY + dy }));
        }
        return;
      }
      if (!dragRef.current.active) return;
      const effectiveTool = dragRef.current.button === 2 ? 'eraser' : tool;
      const bounds = effectiveTool === 'select' ? { width, height } : ensureCapacityFor(cell);
      if (!inBounds(cell.x, cell.y, bounds.width, bounds.height)) return;
      const prevLast = dragRef.current.last;
      dragRef.current.last = cell;

      if ((effectiveTool === 'brush' || effectiveTool === 'eraser') && dragRef.current.shift) {
        setPreviewRect(rectFromDrag(dragRef.current.start, cell, false));
        return;
      }
      if (effectiveTool === 'brush' || effectiveTool === 'eraser') {
        addBrushStrokeCells(prevLast, cell);
        return;
      }
      if (effectiveTool === 'arrow') {
        addArrowStrokeCells(prevLast, cell);
        return;
      }
      if (effectiveTool === 'measure') {
        setMeasureEnd(cell);
        return;
      }
      if (effectiveTool === 'rect' || effectiveTool === 'stall' || effectiveTool === 'vehicle_bay') {
        setPreviewRect(rectFromDrag(dragRef.current.start, cell, dragRef.current.shift));
        return;
      }
      if (effectiveTool === 'line' || effectiveTool === 'entrance' || effectiveTool === 'transect' || effectiveTool === 'barrier') {
        setPreviewRect({ x0: dragRef.current.start.x, y0: dragRef.current.start.y, x1: cell.x, y1: cell.y });
      }
    },
    [addArrowStrokeCells, addBrushStrokeCells, bgMode, getCellFromEvent, height, moveBackgroundBy, tool, viewport.zoom, width],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (panRef.current.active) {
        panRef.current.active = false;
        return;
      }
      if (!dragRef.current.active) return;
      dragRef.current.active = false;
      const cell = getCellFromEvent(e);
      const clamped = { x: Math.max(0, Math.min(width - 1, cell.x)), y: Math.max(0, Math.min(height - 1, cell.y)) };
      const effectiveTool = dragRef.current.button === 2 ? 'eraser' : tool;
      const start = dragRef.current.start;

      if ((effectiveTool === 'brush' || effectiveTool === 'eraser') && dragRef.current.shift) {
        const r = rectFromDrag(start, clamped, false);
        const cells = rasterRect(r.x0, r.y0, r.x1, r.y1, false);
        paintCells(cells, paintTileValue, effectiveTool === 'eraser' ? 'Erase rectangle' : 'Fill rectangle');
        setPreviewRect(null);
        return;
      }
      if (effectiveTool === 'brush' || effectiveTool === 'eraser') {
        commitPaintMap(effectiveTool === 'eraser' ? 'Erase' : 'Paint');
        return;
      }
      if (effectiveTool === 'arrow') {
        const cells = Array.from(arrowMapRef.current.values());
        arrowMapRef.current.clear();
        if (cells.length > 0) addArrowStroke(cells);
        return;
      }
      if (effectiveTool === 'measure') {
        setMeasureStart(null);
        setMeasureEnd(null);
        return;
      }
      if (effectiveTool === 'rect') {
        const r = rectFromDrag(start, clamped, dragRef.current.shift);
        const cells = rasterRect(r.x0, r.y0, r.x1, r.y1, dragRef.current.alt);
        paintCells(cells, paintTileValue, 'Rectangle');
        setPreviewRect(null);
        return;
      }
      if (effectiveTool === 'line') {
        let end = clamped;
        if (dragRef.current.shift) {
          const dirCode = quantizeDirection(clamped.x - start.x, clamped.y - start.y);
          const dist = Math.max(Math.abs(clamped.x - start.x), Math.abs(clamped.y - start.y));
          const dirs = [
            { x: 0, y: 0 },
            { x: 0, y: -1 },
            { x: 1, y: -1 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
            { x: 0, y: 1 },
            { x: -1, y: 1 },
            { x: -1, y: 0 },
            { x: -1, y: -1 },
          ];
          const d = dirs[dirCode];
          end = { x: start.x + d.x * dist, y: start.y + d.y * dist };
        }
        const line = rasterLine(start.x, start.y, end.x, end.y);
        const cells = applyBrushSize(line, brushSize).filter((c) => inBounds(c.x, c.y, width, height));
        paintCells(cells, paintTileValue, 'Line');
        setPreviewRect(null);
        return;
      }
      if (effectiveTool === 'stall') {
        const r = rectFromDrag(start, clamped, dragRef.current.shift);
        const isClick = r.x1 - r.x0 < 1 && r.y1 - r.y0 < 1;
        const w = isClick ? stallSize.w : r.x1 - r.x0 + 1;
        const h = isClick ? stallSize.h : r.y1 - r.y0 + 1;
        addStall(r.x0, r.y0, w, h, stallFrontEdge);
        setPreviewRect(null);
        return;
      }
      if (effectiveTool === 'entrance') {
        const line = rasterLine(start.x, start.y, clamped.x, clamped.y);
        const cells = applyBrushSize(line, brushSize);
        addEntrance(cells, entranceType);
        setPreviewRect(null);
        return;
      }
      if (effectiveTool === 'transect') {
        addTransect(start, clamped);
        setPreviewRect(null);
        return;
      }
      if (effectiveTool === 'barrier') {
        const line = rasterLine(start.x, start.y, clamped.x, clamped.y);
        const cells = applyBrushSize(line, brushSize);
        addBarrier(cells);
        setPreviewRect(null);
        return;
      }
      if (effectiveTool === 'vehicle_bay') {
        const r = rectFromDrag(start, clamped, dragRef.current.shift);
        const isClick = r.x1 - r.x0 < 1 && r.y1 - r.y0 < 1;
        const [defaultW, defaultH] = vehicleTypeFootprints[vehicleBayType].footprintCells;
        const w = isClick ? defaultW : r.x1 - r.x0 + 1;
        const h = isClick ? defaultH : r.y1 - r.y0 + 1;
        addVehicleBay(r.x0, r.y0, w, h);
        setPreviewRect(null);
      }
    },
    [addArrowStroke, addBarrier, addEntrance, addStall, addTransect, addVehicleBay, brushSize, commitPaintMap, entranceType, getCellFromEvent, height, paintCells, paintTileValue, stallFrontEdge, stallSize, tool, vehicleBayType, vehicleTypeFootprints, width],
  );

  // Keyboard: number keys 1-8 pick a hotbar block (V = select), delete, grid
  // toggle, brush size, and contextual R/F while placing an arrow or stall.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        spaceHeldRef.current = true;
        return;
      }
      if (e.key.toLowerCase() === 'r') {
        if (tool === 'arrow') {
          rotateArrowDir();
          return;
        }
        if (tool === 'stall') {
          rotateStallFootprint();
          return;
        }
      }
      if (e.key.toLowerCase() === 'f' && tool === 'stall') {
        flipStallFrontEdge();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedObjectId != null) {
          e.preventDefault();
          deleteSelectedObject();
        }
        return;
      }
      if (e.key.toLowerCase() === 'g') {
        toggleGrid();
        return;
      }
      if (e.key === '[') setBrushSize(Math.max(1, brushSize - 1));
      if (e.key === ']') setBrushSize(Math.min(5, brushSize + 1));
      if (e.key === '0') setViewport(fitToScreenEl(width, height, containerRef.current));
      if (e.key.toLowerCase() === 'v') {
        setActiveBlock(PRIMARY_BLOCKS[0]);
        return;
      }
      const block = PRIMARY_BLOCKS.find((b) => b.hotkey === e.key);
      if (block) setActiveBlock(block);
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space') spaceHeldRef.current = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [tool, brushSize, selectedObjectId, width, height, deleteSelectedObject, flipStallFrontEdge, rotateArrowDir, rotateStallFootprint, setActiveBlock, setBrushSize, toggleGrid]);

  // Fit to screen once on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewport(fitToScreenEl(width, height, el));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.meta.name]);

  // Pan to a cell requested from elsewhere (e.g. the linter panel).
  useEffect(() => {
    if (!focusCell) return;
    const el = containerRef.current;
    const cw = el?.clientWidth ?? 800;
    const ch = el?.clientHeight ?? 600;
    setViewport((v) => ({ ...v, originX: cw / 2 - focusCell.x * v.zoom, originY: ch / 2 - focusCell.y * v.zoom }));
    setFocusCell(null);
  }, [focusCell, setFocusCell]);

  // Native (non-passive) wheel listener so preventDefault actually stops page scroll/zoom.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = canvas!.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      setViewport((v) => {
        const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.max(2, Math.min(48, v.zoom * factor));
        const cellX = (sx - v.originX) / v.zoom;
        const cellY = (sy - v.originY) / v.zoom;
        return { zoom: newZoom, originX: sx - cellX * newZoom, originY: sy - cellY * newZoom };
      });
    }
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, []);

  const calibDialog = calibPromptOpen && (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
      <div className="w-72 rounded bg-white p-4 shadow-lg">
        <p className="mb-2 text-sm">Real-world distance between the two points (metres):</p>
        <input autoFocus type="number" step="0.1" value={calibMetres} onChange={(e) => setCalibMetres(e.target.value)} className="mb-3 w-full rounded border border-neutral-300 px-2 py-1" />
        <div className="flex justify-end gap-2">
          <button
            className="rounded px-3 py-1 text-sm text-neutral-600 hover:bg-neutral-100"
            onClick={() => {
              setCalibPromptOpen(false);
              useAppStore.getState().clearCalibration();
            }}
          >
            Cancel
          </button>
          <button
            className="rounded bg-neutral-800 px-3 py-1 text-sm text-white"
            onClick={() => {
              const m = parseFloat(calibMetres);
              if (!Number.isNaN(m) && m > 0) applyCalibration(m);
              setCalibPromptOpen(false);
            }}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div ref={containerRef} className="relative h-full w-full overflow-hidden" style={{ background: '#F5F3EC' }}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      {calibDialog}
    </div>
  );
}

function rectFromDrag(start: XY, end: XY, square: boolean): { x0: number; y0: number; x1: number; y1: number } {
  let ex = end.x;
  let ey = end.y;
  if (square) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const d = Math.max(Math.abs(dx), Math.abs(dy));
    ex = start.x + Math.sign(dx || 1) * d;
    ey = start.y + Math.sign(dy || 1) * d;
  }
  return { x0: Math.min(start.x, ex), y0: Math.min(start.y, ey), x1: Math.max(start.x, ex), y1: Math.max(start.y, ey) };
}

function hoverHighlightTool(tool: string): boolean {
  return tool === 'brush' || tool === 'eraser';
}

function ghostCells(_tool: string, hover: XY, brushSize: number, _stallSize: { w: number; h: number }): XY[] {
  return applyBrushSize([hover], brushSize);
}

function fitToScreenEl(width: number, height: number, el: HTMLDivElement | null): Viewport {
  return fitToScreen(width, height, el?.clientWidth ?? 900, el?.clientHeight ?? 700);
}
