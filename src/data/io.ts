// Save/load: the whole Project serialized to *.mandi.json.
// Typed arrays are stored as base64 to keep files reasonably small and JSON-safe.

import type { Layout, Project } from './schema';
import { migrateProjectData } from './migrations';

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

interface SerializedLayout extends Omit<Layout, 'terrain' | 'object' | 'flow' | 'flowGroup' | 'zone' | 'shade' | 'locked'> {
  terrain: string;
  object: string; // base64 of the Uint16Array's underlying bytes
  flow: string;
  flowGroup: string;
  zone: string;
  shade: string;
  locked: string;
}

export function serializeLayout(layout: Layout): SerializedLayout {
  return {
    ...layout,
    terrain: bytesToBase64(layout.terrain),
    object: bytesToBase64(new Uint8Array(layout.object.buffer, layout.object.byteOffset, layout.object.byteLength)),
    flow: bytesToBase64(layout.flow),
    flowGroup: bytesToBase64(layout.flowGroup),
    zone: bytesToBase64(layout.zone),
    shade: bytesToBase64(layout.shade),
    locked: bytesToBase64(layout.locked),
  };
}

function deserializeLayout(s: SerializedLayout): Layout {
  return {
    ...s,
    terrain: base64ToBytes(s.terrain),
    object: new Uint16Array(base64ToBytes(s.object).buffer),
    flow: base64ToBytes(s.flow),
    flowGroup: base64ToBytes(s.flowGroup),
    zone: base64ToBytes(s.zone),
    shade: base64ToBytes(s.shade),
    locked: base64ToBytes(s.locked),
  };
}

type SerializedProject = Omit<Project, 'baseline'> & { baseline: SerializedLayout };

export function serializeProject(project: Project): string {
  const out: SerializedProject = { ...project, baseline: serializeLayout(project.baseline) };
  return JSON.stringify(out);
}

export function deserializeProject(json: string): Project {
  const raw = JSON.parse(json);
  const migrated = migrateProjectData(raw) as unknown as SerializedProject;
  return { ...migrated, baseline: deserializeLayout(migrated.baseline) };
}

export function downloadProjectFile(project: Project, filename?: string) {
  const json = serializeProject(project);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename ?? `${project.meta.name.replace(/[^a-z0-9-_]+/gi, '_')}.mandi.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function readProjectFile(file: File): Promise<Project> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(deserializeProject(reader.result as string));
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

