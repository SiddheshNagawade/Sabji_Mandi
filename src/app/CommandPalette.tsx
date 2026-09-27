import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from './store';
import type { Project } from '../data/schema';
import type { ProjectSummary } from '../data/projectLibrary';
import { listProjectSummaries, loadProjectFromLibrary, uniqueProjectName } from '../data/projectLibrary';
import { DEMO_MARKETS } from '../data/demoProjects';

export interface PaletteTab {
  id: string;
  label: string;
}

interface PaletteItem {
  id: string;
  label: string;
  hint?: string;
  keywords?: string;
  run: () => void;
}

export function CommandPalette({ open, onClose, tabs, onNavigate }: { open: boolean; onClose: () => void; tabs: readonly PaletteTab[]; onNavigate: (tabId: string) => void }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const setProject = useAppStore((s) => s.setProject);
  const newProject = useAppStore((s) => s.newProject);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelected(0);
    void listProjectSummaries().then(setProjects);
    // A tick after mount so the input exists and the opening keystroke doesn't land in it.
    const id = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(id);
  }, [open]);

  async function openProject(id: string) {
    const project = await loadProjectFromLibrary(id);
    if (project) {
      setProject(project);
      onNavigate('editor');
    }
  }

  async function openDemo(build: () => Project) {
    const project = build();
    project.meta.name = await uniqueProjectName(project.meta.name);
    setProject(project);
    onNavigate('editor');
  }

  const items = useMemo<PaletteItem[]>(() => {
    const nav = tabs.map((t) => ({ id: `nav-${t.id}`, label: `Go to ${t.label}`, keywords: 'navigate screen tab', run: () => onNavigate(t.id) }));
    const create: PaletteItem = {
      id: 'new-market',
      label: 'New market',
      hint: 'Start a blank layout',
      keywords: 'create blank project',
      run: () => {
        void newProject().then(() => onNavigate('editor'));
      },
    };
    const openers = projects.map((p) => ({
      id: `open-${p.id}`,
      label: p.name,
      hint: `${p.width}×${p.height} m · ${p.stallCount} ${p.stallCount === 1 ? 'stall' : 'stalls'} · open in Editor`,
      keywords: 'project market open',
      run: () => void openProject(p.id),
    }));
    const demos = DEMO_MARKETS.map((d) => ({
      id: `demo-${d.id}`,
      label: d.name,
      hint: `Demo market · ${d.description}`,
      keywords: 'demo example market open',
      run: () => void openDemo(d.build),
    }));
    return [...nav, create, ...openers, ...demos];
  }, [tabs, projects, onNavigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((it) => `${it.label} ${it.hint ?? ''} ${it.keywords ?? ''}`.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => setSelected((s) => Math.min(s, Math.max(0, filtered.length - 1))), [filtered.length]);

  if (!open) return null;

  function activate(index: number) {
    const item = filtered[index];
    if (!item) return;
    item.run();
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        } else if (e.key === 'ArrowDown') {
          e.preventDefault();
          setSelected((s) => Math.min(filtered.length - 1, s + 1));
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          setSelected((s) => Math.max(0, s - 1));
        } else if (e.key === 'Enter') {
          e.preventDefault();
          activate(selected);
        }
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Jump to a screen or open a market…"
          className="w-full border-b px-4 py-3 text-sm outline-none"
          style={{ borderColor: 'var(--color-border)', color: 'var(--color-text)', background: 'transparent' }}
        />
        <div className="max-h-80 overflow-y-auto p-1.5">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm" style={{ color: 'var(--color-text-faint)' }}>
              Nothing matches “{query}”.
            </p>
          )}
          {filtered.map((it, i) => (
            <button
              key={it.id}
              onClick={() => activate(i)}
              onMouseEnter={() => setSelected(i)}
              className="flex w-full flex-col items-start rounded-xl px-3 py-2 text-left transition"
              style={{ background: i === selected ? 'var(--color-accent-soft)' : 'transparent' }}
            >
              <span className="text-sm font-medium" style={{ color: i === selected ? 'var(--color-accent-hover)' : 'var(--color-text)' }}>
                {it.label}
              </span>
              {it.hint && (
                <span className="text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  {it.hint}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
