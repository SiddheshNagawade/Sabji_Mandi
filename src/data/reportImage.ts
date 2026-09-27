// Renders a one-page PNG "fact sheet" for a market: layout thumbnail, key
// stats, land-use and produce-mix breakdowns, and top suggestions — the
// kind of thing you can hand to a market committee who isn't going to open
// a web app. Built with the plain Canvas 2D API (no new dependency): first
// a dry pass that measures wrapped text to compute the exact page height,
// then a real pass that paints it, both driven by the same draw functions
// (an unattached `draw: boolean` flag skips the actual paint calls).

import type { Project } from './schema';
import { computeLayoutStats } from './layoutStats';
import { generateSuggestions } from './suggestions';
import { PRODUCE_COLORS } from './schema';
import { produceLabel } from '../editor/labels';
import { fitToScreen } from '../editor/viewport';
import { drawScene } from '../viz/renderTiles';

const W = 1600;
const MARGIN = 72;
const CONTENT_W = W - MARGIN * 2;
const INK = '#1d1b17';
const MUTED = '#6f6b62';
const FAINT = '#a4a096';
const BORDER = '#e7e4dc';
const ACCENT = '#3a5fe0';

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function renderLayoutThumbnailDataUrl(project: Project, w: number, h: number): string {
  return renderLayoutThumbnail(project, w, h).toDataURL('image/png');
}

function renderLayoutThumbnail(project: Project, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const viewport = fitToScreen(project.grid.width, project.grid.height, w, h);
  drawScene(ctx, project.baseline, project.grid.width, project.grid.height, viewport, {
    showGrid: false,
    layerVisible: { terrain: true, object: true, flow: false, zone: false, shade: false, locked: false, background: false },
    selectedObjectId: null,
  });
  return canvas;
}

export function renderMarketReport(project: Project): HTMLCanvasElement {
  const stats = computeLayoutStats(project);
  const suggestions = generateSuggestions(project).slice(0, 5);
  const thumb = renderLayoutThumbnail(project, CONTENT_W, 560);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = 800; // placeholder; replaced after the measuring pass
  const ctx = canvas.getContext('2d')!;

  function paint(draw: boolean): number {
    let y = MARGIN;

    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = INK;
    ctx.font = '600 44px Inter, system-ui, sans-serif';
    if (draw) ctx.fillText(project.meta.name, MARGIN, y + 40);
    y += 56;

    ctx.font = '400 22px Inter, system-ui, sans-serif';
    ctx.fillStyle = MUTED;
    const subtitle = `Market layout report · ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;
    if (draw) ctx.fillText(subtitle, MARGIN, y + 20);
    y += 48;

    if (draw) {
      ctx.strokeStyle = BORDER;
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGIN, y, CONTENT_W, 560);
      ctx.drawImage(thumb, MARGIN, y);
    }
    y += 560 + 40;

    // Stat cards
    const cards: [string, string][] = [
      ['Market area', `${Math.round(stats.areaM2)} m²`],
      ['Walkable space', `${Math.round(stats.walkableFraction * 100)}%`],
      ['Stalls', String(stats.stallCount)],
      ['Entrances', `${stats.pedEntranceCount} ped · ${stats.vehEntranceCount} veh`],
    ];
    const cardW = (CONTENT_W - 3 * 24) / 4;
    const cardH = 120;
    cards.forEach(([label, value], i) => {
      const cx = MARGIN + i * (cardW + 24);
      if (draw) {
        ctx.strokeStyle = BORDER;
        ctx.lineWidth = 2;
        ctx.strokeRect(cx, y, cardW, cardH);
        ctx.fillStyle = FAINT;
        ctx.font = '400 20px Inter, system-ui, sans-serif';
        ctx.fillText(label, cx + 20, y + 38);
        ctx.fillStyle = INK;
        ctx.font = '600 34px Inter, system-ui, sans-serif';
        ctx.fillText(value, cx + 20, y + 84);
      }
    });
    y += cardH + 48;

    // Land use bar
    ctx.font = '600 26px Inter, system-ui, sans-serif';
    ctx.fillStyle = INK;
    if (draw) ctx.fillText('Land use', MARGIN, y + 24);
    y += 44;
    const barH = 28;
    let bx = MARGIN;
    for (const t of stats.tileBreakdown) {
      const segW = t.fraction * CONTENT_W;
      if (draw) {
        ctx.fillStyle = t.color;
        ctx.fillRect(bx, y, segW, barH);
      }
      bx += segW;
    }
    y += barH + 20;
    ctx.font = '400 19px Inter, system-ui, sans-serif';
    const legendItems = stats.tileBreakdown.filter((t) => t.fraction > 0);
    const legendColW = CONTENT_W / 3;
    legendItems.forEach((t, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const lx = MARGIN + col * legendColW;
      const ly = y + row * 32;
      if (draw) {
        ctx.fillStyle = t.color;
        ctx.fillRect(lx, ly - 16, 18, 18);
        ctx.fillStyle = MUTED;
        ctx.fillText(`${t.name} — ${Math.round(t.fraction * 100)}%`, lx + 26, ly);
      }
    });
    y += Math.ceil(legendItems.length / 3) * 32 + 40;

    // Produce mix
    const topProduce = (Object.entries(stats.produceCounts) as [string, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
    if (topProduce.length > 0) {
      ctx.font = '600 26px Inter, system-ui, sans-serif';
      ctx.fillStyle = INK;
      if (draw) ctx.fillText('Produce mix', MARGIN, y + 24);
      y += 44;
      ctx.font = '400 19px Inter, system-ui, sans-serif';
      const maxN = Math.max(...topProduce.map(([, n]) => n));
      for (const [p, n] of topProduce) {
        if (draw) {
          ctx.fillStyle = MUTED;
          ctx.fillText(produceLabel(p), MARGIN, y + 16);
          const trackX = MARGIN + 220;
          const trackW = CONTENT_W - 220 - 50;
          ctx.fillStyle = BORDER;
          ctx.fillRect(trackX, y, trackW, 18);
          ctx.fillStyle = PRODUCE_COLORS[p as keyof typeof PRODUCE_COLORS];
          ctx.fillRect(trackX, y, (n / maxN) * trackW, 18);
          ctx.fillStyle = FAINT;
          ctx.fillText(String(n), trackX + trackW + 12, y + 16);
        }
        y += 30;
      }
      y += 24;
    }

    // Suggestions
    if (suggestions.length > 0) {
      ctx.font = '600 26px Inter, system-ui, sans-serif';
      ctx.fillStyle = INK;
      if (draw) ctx.fillText('Things worth looking at', MARGIN, y + 24);
      y += 44;
      ctx.font = '400 20px Inter, system-ui, sans-serif';
      for (const s of suggestions) {
        const lines = wrapText(ctx, s.message, CONTENT_W - 36);
        if (draw) {
          ctx.fillStyle = s.severity === 'high' ? '#c9483a' : ACCENT;
          ctx.beginPath();
          ctx.arc(MARGIN + 6, y + 8, 6, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = INK;
          lines.forEach((line, i) => ctx.fillText(line, MARGIN + 28, y + 16 + i * 28));
        }
        y += lines.length * 28 + 16;
      }
      y += 16;
    }

    // Footer
    ctx.font = '400 17px Inter, system-ui, sans-serif';
    ctx.fillStyle = FAINT;
    if (draw) ctx.fillText('Generated by Mandi Flow Simulator', MARGIN, y + 16);
    y += 40;

    return y;
  }

  const totalHeight = paint(false);
  canvas.width = W; // resizing height below clears the canvas; width is already correct but reset for clarity
  canvas.height = Math.max(1200, totalHeight + MARGIN);
  paint(true);

  return canvas;
}

export function downloadMarketReport(project: Project) {
  const canvas = renderMarketReport(project);
  const url = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.meta.name.replace(/[^\w\-]+/g, '_')}-report.png`;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
