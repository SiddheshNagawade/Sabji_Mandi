// Multi-project storage: a small library of named vegetable-market projects
// (Figma-style "files"), stored in IndexedDB alongside each project's own
// serialized body. Kept separate from data/io.ts (which handles *.mandi.json
// file export/import) even though it reuses its (de)serialization.

import type { Project } from './schema';
import { PRODUCE_COLORS, TILE_INFO, TileId } from './schema';
import { deserializeProject, serializeProject } from './io';

export interface ProjectSummary {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  width: number;
  height: number;
  cellSizeM: number;
  stallCount: number;
  entranceCount: number;
  isSyntheticExample?: boolean;
  thumbnail?: string;
}

const INDEX_KEY = 'mandi-projects-index';
const CURRENT_KEY = 'mandi-current-project-id';
const projectKey = (id: string) => `mandi-project:${id}`;

/** A small flat-colour PNG preview of the layout, cheap enough to regenerate on every save. */
function renderThumbnail(project: Project): string | undefined {
  if (typeof document === 'undefined') return undefined;
  const { width, height } = project.grid;
  const scale = Math.max(1, Math.min(220 / width, 160 / height, 10));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return undefined;

  ctx.fillStyle = '#F5F3EC';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const layout = project.baseline;
  ctx.globalAlpha = 0.65;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const tileId = layout.terrain[y * width + x];
      if (tileId === TileId.OpenGround) continue;
      ctx.fillStyle = TILE_INFO[tileId]?.color ?? '#C9C4B8';
      ctx.fillRect(x * scale, y * scale, scale, scale);
    }
  }
  ctx.globalAlpha = 0.75;
  for (const obj of layout.objects) {
    if (obj.kind === 'stall') {
      const xs = obj.cells.map((c) => c.x);
      const ys = obj.cells.map((c) => c.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const w = Math.max(...xs) + 1 - minX;
      const h = Math.max(...ys) + 1 - minY;
      ctx.fillStyle = PRODUCE_COLORS[obj.produce[0] ?? 'mixed_other'];
      ctx.fillRect(minX * scale, minY * scale, w * scale, h * scale);
    } else if (obj.kind === 'entrance') {
      ctx.fillStyle = '#2BB673';
      for (const c of obj.cells) ctx.fillRect(c.x * scale, c.y * scale, scale, scale);
    }
  }
  ctx.globalAlpha = 1;
  return canvas.toDataURL('image/png');
}

function summarize(project: Project): ProjectSummary {
  return {
    id: project.id,
    name: project.meta.name,
    createdAt: project.meta.createdAt,
    updatedAt: project.meta.updatedAt,
    width: project.grid.width,
    height: project.grid.height,
    cellSizeM: project.grid.cellSizeM.value,
    stallCount: project.baseline.objects.filter((o) => o.kind === 'stall').length,
    entranceCount: project.baseline.objects.filter((o) => o.kind === 'entrance').length,
    isSyntheticExample: project.meta.isSyntheticExample,
    thumbnail: renderThumbnail(project),
  };
}

async function readIndex(): Promise<ProjectSummary[]> {
  const { get } = await import('idb-keyval');
  return (await get<ProjectSummary[]>(INDEX_KEY)) ?? [];
}

async function writeIndex(entries: ProjectSummary[]): Promise<void> {
  const { set } = await import('idb-keyval');
  await set(INDEX_KEY, entries);
}

export async function listProjectSummaries(): Promise<ProjectSummary[]> {
  const index = await readIndex();
  return [...index].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveProjectToLibrary(project: Project): Promise<void> {
  const { set } = await import('idb-keyval');
  await set(projectKey(project.id), serializeProject(project));
  const index = await readIndex();
  await writeIndex([...index.filter((p) => p.id !== project.id), summarize(project)]);
}

export async function loadProjectFromLibrary(id: string): Promise<Project | undefined> {
  const { get } = await import('idb-keyval');
  const json = await get<string>(projectKey(id));
  return json ? deserializeProject(json) : undefined;
}

export async function deleteProjectFromLibrary(id: string): Promise<void> {
  const { del } = await import('idb-keyval');
  await del(projectKey(id));
  await writeIndex((await readIndex()).filter((p) => p.id !== id));
}

export async function renameProjectInLibrary(id: string, name: string): Promise<void> {
  const project = await loadProjectFromLibrary(id);
  if (!project) return;
  project.meta.name = name;
  project.meta.updatedAt = new Date().toISOString();
  await saveProjectToLibrary(project);
}

export async function duplicateProjectInLibrary(id: string, newName?: string): Promise<Project | undefined> {
  const original = await loadProjectFromLibrary(id);
  if (!original) return undefined;
  const now = new Date().toISOString();
  const copy: Project = {
    ...original,
    id: crypto.randomUUID(),
    meta: { ...original.meta, name: newName ?? `${original.meta.name} copy`, createdAt: now, updatedAt: now, isSyntheticExample: undefined },
  };
  await saveProjectToLibrary(copy);
  return copy;
}

export async function getCurrentProjectId(): Promise<string | undefined> {
  const { get } = await import('idb-keyval');
  return get<string>(CURRENT_KEY);
}

export async function setCurrentProjectId(id: string): Promise<void> {
  const { set } = await import('idb-keyval');
  await set(CURRENT_KEY, id);
}
