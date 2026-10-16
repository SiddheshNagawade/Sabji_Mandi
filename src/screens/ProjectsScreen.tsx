import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../app/store';
import type { Project } from '../data/schema';
import type { ProjectSummary } from '../data/projectLibrary';
import { deleteProjectFromLibrary, duplicateProjectInLibrary, ensureDemoMarketsSeeded, listProjectSummaries, loadProjectFromLibrary, renameProjectInLibrary, saveProjectToLibrary, uniqueProjectName } from '../data/projectLibrary';
import { downloadProjectFile, readProjectFile } from '../data/io';

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

export function ProjectsScreen({ onOpen }: { onOpen: () => void }) {
  const currentProjectId = useAppStore((s) => s.project.id);
  const setProject = useAppStore((s) => s.setProject);
  const newProject = useAppStore((s) => s.newProject);
  const [projects, setProjects] = useState<ProjectSummary[] | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setProjects(await listProjectSummaries());
  }

  useEffect(() => {
    void (async () => {
      const seeded = await ensureDemoMarketsSeeded();
      if (seeded) await refresh();
    })();
  }, []);

  useEffect(() => {
    void refresh();
  }, [currentProjectId]);

  async function openProject(id: string) {
    const project = await loadProjectFromLibrary(id);
    if (project) {
      setProject(project);
      onOpen();
    }
  }

  async function createBlank() {
    await newProject();
    onOpen();
  }

  async function duplicate(id: string, name: string) {
    const copy = await duplicateProjectInLibrary(id, `${name} copy`);
    if (copy) await refresh();
  }

  async function exportSaved(id: string) {
    const project = await loadProjectFromLibrary(id);
    if (project) downloadProjectFile(project);
  }

  async function importFromFile(file: File) {
    setImportError(null);
    try {
      const project = await readProjectFile(file);
      const now = new Date().toISOString();
      const imported: Project = {
        ...project,
        id: crypto.randomUUID(),
        meta: { ...project.meta, name: await uniqueProjectName(project.meta.name), createdAt: now, updatedAt: now, isSyntheticExample: undefined },
      };
      await saveProjectToLibrary(imported);
      await refresh();
    } catch {
      setImportError('Could not read that file — is it a .mandi.json export?');
    }
  }

  async function remove(id: string) {
    setConfirmDeleteId(null);
    await deleteProjectFromLibrary(id);
    if (currentProjectId === id) void newProject();
    await refresh();
  }

  async function commitRename(id: string) {
    const name = nameDraft.trim();
    setRenamingId(null);
    if (name.length === 0) return;
    await renameProjectInLibrary(id, name);
    await refresh();
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              Your markets
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Each project is its own vegetable market. Open one to draw or simulate it, or compare any two.
            </p>
          </div>
          <div className="flex gap-2">
            <input
              ref={importInputRef}
              type="file"
              accept=".json,.mandi.json,application/json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void importFromFile(file);
              }}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              title="Import a .mandi.json file someone shared with you"
              className="rounded-lg px-3 py-2 text-sm font-medium transition hover:brightness-95"
              style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-hover)', border: '1px solid var(--color-border)' }}
            >
              ⬆ Import
            </button>
            <button
              onClick={() => void createBlank()}
              className="rounded-lg px-3 py-2 text-sm font-medium text-white transition"
              style={{ background: 'var(--color-accent)' }}
            >
              + New market
            </button>
          </div>
        </div>

        {importError && (
          <div className="mb-4 rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}>
            {importError}
          </div>
        )}

        {projects == null && <p className="text-sm" style={{ color: 'var(--color-text-faint)' }}>Loading…</p>}

        {projects != null && projects.length === 0 && (
          <div className="rounded-2xl border border-dashed px-6 py-16 text-center" style={{ borderColor: 'var(--color-border-strong)' }}>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No markets yet. Start with a blank grid, or import one a teammate shared with you.
            </p>
          </div>
        )}

        {projects != null && projects.length > 0 && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {projects.map((p) => (
              <div
                key={p.id}
                className="group overflow-hidden rounded-2xl transition"
                style={{ background: 'var(--color-surface)', border: `1px solid ${p.id === currentProjectId ? 'var(--color-accent)' : 'var(--color-border)'}`, boxShadow: 'var(--shadow-sm)' }}
              >
                <button className="block w-full" onClick={() => void openProject(p.id)} title={`Open ${p.name}`}>
                  <div className="flex h-28 w-full items-center justify-center" style={{ background: '#F5F3EC' }}>
                    {p.thumbnail ? (
                      <img src={p.thumbnail} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="text-2xl" style={{ color: 'var(--color-text-faint)' }}>
                        ▦
                      </span>
                    )}
                  </div>
                </button>
                <div className="p-3">
                  {renamingId === p.id ? (
                    <input
                      autoFocus
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={() => void commitRename(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void commitRename(p.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="w-full rounded-md border px-1.5 py-0.5 text-sm"
                      style={{ borderColor: 'var(--color-border-strong)' }}
                    />
                  ) : (
                    <button
                      className="block w-full truncate text-left text-sm font-medium"
                      style={{ color: 'var(--color-text)' }}
                      title="Click to rename"
                      onClick={() => {
                        setRenamingId(p.id);
                        setNameDraft(p.name);
                      }}
                    >
                      {p.name}
                      {p.isSyntheticExample && <span className="ml-1 text-[10px] font-normal" style={{ color: 'var(--color-text-faint)' }}>(example)</span>}
                    </button>
                  )}
                  <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
                    <span>
                      {p.width}×{p.height} m · {p.stallCount} {p.stallCount === 1 ? 'stall' : 'stalls'}
                    </span>
                    <span>{relativeTime(p.updatedAt)}</span>
                  </div>
                  {confirmDeleteId === p.id ? (
                    <div className="mt-2 flex items-center gap-1.5">
                      <span className="text-[11px]" style={{ color: 'var(--color-danger)' }}>
                        Delete?
                      </span>
                      <button onClick={() => void remove(p.id)} className="rounded-md px-2 py-0.5 text-[11px] font-medium text-white" style={{ background: 'var(--color-danger)' }}>
                        Yes
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="rounded-md px-2 py-0.5 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                      <button title="Export as .mandi.json to share" onClick={() => void exportSaved(p.id)} className="rounded-md px-1.5 py-1 text-xs transition hover:bg-[var(--color-bg)]">
                        ⬇
                      </button>
                      <button title="Duplicate" onClick={() => void duplicate(p.id, p.name)} className="rounded-md px-1.5 py-1 text-xs transition hover:bg-[var(--color-bg)]">
                        ⧉
                      </button>
                      <button title="Delete" onClick={() => setConfirmDeleteId(p.id)} className="rounded-md px-1.5 py-1 text-xs transition hover:bg-[var(--color-bg)]" style={{ color: 'var(--color-danger)' }}>
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
