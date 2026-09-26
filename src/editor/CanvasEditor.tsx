import type { PointerEvent as ReactPointerEvent } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../app/store';
import type { XY } from '../data/schema';
import { TILE_INFO } from '../data/schema';
import { applyBrushSize, floodFillIndices, idx, inBounds, quantizeDirection, rasterLine, rasterRect } from './grid';
import { objectAtCell } from './objectLayer';
import type { LayerVisibility, Viewport } from '../viz/renderTiles';
import { cellToScreen, drawScene, screenToCell } from '../viz/renderTiles';

const ARROW_KEY_DIR: Record<string, number> = { ArrowUp: 1, ArrowRight: 3, ArrowDown: 5, ArrowLeft: 7 };

interface PendingArrowRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function CanvasEditor({ lintCells }: { lintCells: Set<string> }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  const [, forceRender] = useState(0);

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
  const toggleLayerVisible = useAppStore((s) => s.toggleLayerVisible);
  const paintCells = useAppStore((s) => s.paintCells);
  const addArrowStroke = useAppStore((s) => s.addArrowStroke);
  const addStall = useAppStore((s) => s.addStall);
  const addEntrance = useAppStore((s) => s.addEntrance);
  const addTransect = useAppStore((s) => s.addTransect);
  const deleteSelectedObject = useAppStore((s) => s.deleteSelectedObject);
  const addCalibrationClick = useAppStore((s) => s.addCalibrationClick);
  const applyCalibration = useAppStore((s) => s.applyCalibration);
  const moveBackgroundBy = useAppStore((s) => s.moveBackgroundBy);

  const width = project.grid.width;
  const height = project.grid.height;
  const layout = project.baseline;

  const [viewport, setViewport] = useState<Viewport>({ originX: 20, originY: 20, zoom: 8 });
  const [hoverCell, setHoverCell] = useState<XY | null>(null);
  const [measureEnd, setMeasureEnd] = useState<XY | null>(null);
  const [measureStart, setMeasureStart] = useState<XY | null>(null);
  const [pendingArrowRect, setPendingArrowRect] = useState<PendingArrowRect | null>(null);
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
      forceRender((n) => n + 1);
    });
    ro.observe(el);
    canvas.width = el.clientWidth;
    canvas.height = el.clientHeight;
    return () => ro.disconnect();
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

    // Ephemeral overlays: preview rect, measure line, calibration points, pending arrow rect.
    if (previewRect) {
      const a = cellToScreen(viewport, previewRect.x0, previewRect.y0);
      const b = cellToScreen(viewport, previewRect.x1 + 1, previewRect.y1 + 1);
      ctx.strokeStyle = '#FFD23F';
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
    }
    if (pendingArrowRect) {
      const a = cellToScreen(viewport, pendingArrowRect.x0, pendingArrowRect.y0);
      const b = cellToScreen(viewport, pendingArrowRect.x1 + 1, pendingArrowRect.y1 + 1);
      ctx.strokeStyle = '#1D6FD8';
      ctx.setLineDash([5, 3]);
      ctx.lineWidth = 2;
      ctx.strokeRect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      ctx.setLineDash([]);
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
  }, [layoutVersion, viewport, layerVisible, showGrid, selectedObjectId, lintCellSet, previewRect, pendingArrowRect, measureStart, measureEnd, calibrationClicks, hoverCell, tool, brushSize, stallSize, project.background]);

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
    },
    [brushSize, width, height, arrowDirCode],
  );

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      (e.target as Element).setPointerCapture(e.pointerId);
      const cell = getCellFromEvent(e);
      if (!inBounds(cell.x, cell.y, width, height)) return;

      if (panRef.current.active || spaceHeldRef.current || e.button === 1) {
        panRef.current = { active: true, lastScreen: { x: e.clientX, y: e.clientY } };
        return;
      }

      if (bgMode === 'calibrate') {
        addCalibrationClick(cell);
        if (calibrationClicks.length === 1) setCalibPromptOpen(true);
        return;
      }
      if (bgMode === 'move') {
        panRef.current = { active: true, lastScreen: { x: e.clientX, y: e.clientY } };
        return;
      }

      const effectiveTool = e.button === 2 ? 'eraser' : tool;
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
        paintMapRef.current.clear();
        addBrushStrokeCells(cell, cell);
        return;
      }
      if (effectiveTool === 'arrow') {
        if (e.shiftKey) {
          setPendingArrowRect({ x0: cell.x, y0: cell.y, x1: cell.x, y1: cell.y });
          dragRef.current.active = false;
          return;
        }
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
      if (!dragRef.current.active || !inBounds(cell.x, cell.y, width, height)) return;
      const effectiveTool = dragRef.current.button === 2 ? 'eraser' : tool;
      const prevLast = dragRef.current.last;
      dragRef.current.last = cell;

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
      if (effectiveTool === 'rect' || effectiveTool === 'stall') {
        setPreviewRect(rectFromDrag(dragRef.current.start, cell, dragRef.current.shift));
        return;
      }
      if (effectiveTool === 'line' || effectiveTool === 'entrance' || effectiveTool === 'transect') {
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
      }
    },
    [addArrowStroke, addEntrance, addStall, addTransect, brushSize, commitPaintMap, entranceType, getCellFromEvent, height, paintCells, paintTileValue, stallFrontEdge, stallSize, tool, width],
  );

  // Keyboard: tool hotkeys (contextual override for R/F while placing), delete, grid toggle, brush size, arrow-rect commit.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        spaceHeldRef.current = true;
        return;
      }
      if (pendingArrowRect && ARROW_KEY_DIR[e.key] !== undefined) {
        e.preventDefault();
        const dirCode = ARROW_KEY_DIR[e.key];
        const r = pendingArrowRect;
        const cells = rasterRect(r.x0, r.y0, r.x1, r.y1, false).map((c) => ({ x: c.x, y: c.y, value: dirCode }));
        addArrowStroke(cells);
        setPendingArrowRect(null);
        return;
      }
      if (e.key === 'Escape') {
        setPendingArrowRect(null);
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
      if (e.key === '0') setViewport(fitToScreen(width, height, containerRef.current));
      for (let n = 1; n <= 5; n++) {
        if (e.key === String(n)) {
          const layers = ['terrain', 'object', 'flow', 'zone', 'background'] as const;
          toggleLayerVisible(layers[n - 1]);
        }
      }
      const hotkeys: Record<string, typeof tool> = {
        v: 'select',
        b: 'brush',
        r: 'rect',
        l: 'line',
        f: 'fill',
        e: 'eraser',
        i: 'eyedropper',
        a: 'arrow',
        s: 'stall',
        n: 'entrance',
        m: 'measure',
        t: 'transect',
      };
      const mapped = hotkeys[e.key.toLowerCase()];
      if (mapped) setTool(mapped);
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
  }, [tool, brushSize, selectedObjectId, pendingArrowRect, width, height, addArrowStroke, deleteSelectedObject, flipStallFrontEdge, rotateArrowDir, rotateStallFootprint, setBrushSize, setTool, toggleGrid, toggleLayerVisible]);

  // Fit to screen once on mount.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewport(fitToScreen(width, height, el));
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

  const footerTile = hoverCell && inBounds(hoverCell.x, hoverCell.y, width, height) ? TILE_INFO[layout.terrain[idx(hoverCell.x, hoverCell.y, width)]] : null;

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
    <div ref={containerRef} className="relative h-full w-full overflow-hidden bg-neutral-200">
      <canvas
        ref={canvasRef}
        className="block h-full w-full cursor-crosshair touch-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex items-center gap-3 bg-white/90 px-3 py-1 text-xs text-neutral-600">
        <span>
          {hoverCell ? `(${hoverCell.x}, ${hoverCell.y})` : '—'} {footerTile ? `· ${footerTile.name}` : ''}
        </span>
        <span className="ml-auto">Zoom {viewport.zoom.toFixed(1)}px/cell</span>
      </div>
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

function fitToScreen(width: number, height: number, el: HTMLDivElement | null): Viewport {
  const cw = el?.clientWidth ?? 800;
  const ch = el?.clientHeight ?? 600;
  const zoom = Math.max(2, Math.min(cw / width, ch / height, 16));
  const originX = (cw - width * zoom) / 2;
  const originY = (ch - height * zoom) / 2;
  return { originX, originY, zoom };
}
