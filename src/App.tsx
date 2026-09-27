import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './app/store';
import { getCurrentProjectId, loadProjectFromLibrary } from './data/projectLibrary';
import { ProjectsScreen, EditorScreen, SimulateScreen, CompareScreen, DataScreen, HistoryScreen, PitchScreen } from './screens';
import { CommandPalette } from './app/CommandPalette';

const TABS = [
  { id: 'projects', label: 'Projects' },
  { id: 'editor', label: 'Editor' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'compare', label: 'Compare' },
  { id: 'data', label: 'Data' },
  { id: 'history', label: 'History' },
] as const;

type TabId = (typeof TABS)[number]['id'] | 'pitch';

export default function App() {
  const [tab, setTab] = useState<TabId>('projects');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const project = useAppStore((s) => s.project);
  const undo = useAppStore((s) => s.undo);
  const redo = useAppStore((s) => s.redo);
  const saveProjectFile = useAppStore((s) => s.saveProjectFile);
  const loadProjectFile = useAppStore((s) => s.loadProjectFile);
  const autosave = useAppStore((s) => s.autosave);
  const setProject = useAppStore((s) => s.setProject);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const currentId = await getCurrentProjectId();
      if (!currentId) return;
      const saved = await loadProjectFromLibrary(currentId);
      if (saved && !cancelled) setProject(saved);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      void autosave();
    }, 10_000);
    return () => clearInterval(id);
  }, [autosave]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      if (e.key === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
        return;
      }
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  if (tab === 'pitch') {
    return (
      <div className="fixed inset-0 z-50">
        <button
          className="absolute right-4 top-4 z-10 rounded bg-white/10 px-3 py-1 text-sm text-white hover:bg-white/20"
          onClick={() => setTab('simulate')}
        >
          Exit pitch mode (P)
        </button>
        <PitchScreen />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col" style={{ background: 'var(--color-bg)' }}>
      <header
        className="flex items-center gap-5 px-4 py-2.5"
        style={{ background: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)', boxShadow: 'var(--shadow-sm)' }}
      >
        <span className="text-[15px] font-semibold tracking-tight" style={{ color: 'var(--color-text)' }}>
          Mandi Flow Simulator
        </span>
        <nav className="flex gap-1 rounded-xl p-1" style={{ background: 'var(--color-bg)' }}>
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="rounded-lg px-3 py-1.5 text-[13px] font-medium transition"
              style={
                tab === t.id
                  ? { background: 'var(--color-surface)', color: 'var(--color-text)', boxShadow: 'var(--shadow-sm)' }
                  : { color: 'var(--color-text-muted)' }
              }
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
          <span className="mr-2 hidden truncate sm:inline" style={{ maxWidth: 180 }}>
            {project.meta.name}
          </span>
          <IconButton title="Undo (Ctrl+Z)" onClick={undo}>
            ↶
          </IconButton>
          <IconButton title="Redo (Ctrl+Shift+Z)" onClick={redo}>
            ↷
          </IconButton>
          <div className="mx-1 h-5 w-px" style={{ background: 'var(--color-border)' }} />
          <IconButton title="Save to a file" onClick={saveProjectFile}>
            💾
          </IconButton>
          <IconButton title="Load from a file" onClick={() => fileInputRef.current?.click()}>
            📂
          </IconButton>
          <div className="mx-1 h-5 w-px" style={{ background: 'var(--color-border)' }} />
          <button
            title="Search markets and screens (⌘K)"
            onClick={() => setPaletteOpen(true)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] transition hover:bg-[var(--color-bg)]"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <span>🔍</span>
            <span className="hidden rounded border px-1 text-[10px] sm:inline" style={{ borderColor: 'var(--color-border-strong)' }}>
              ⌘K
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.mandi.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadProjectFile(file);
              e.currentTarget.value = '';
            }}
          />
        </div>
      </header>
      <main className="min-h-0 flex-1">
        {tab === 'projects' && <ProjectsScreen onOpen={() => setTab('editor')} />}
        {tab === 'editor' && <EditorScreen />}
        {tab === 'simulate' && <SimulateScreen />}
        {tab === 'compare' && <CompareScreen />}
        {tab === 'data' && <DataScreen />}
        {tab === 'history' && <HistoryScreen />}
      </main>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} tabs={TABS} onNavigate={(id) => setTab(id as TabId)} />
    </div>
  );
}

function IconButton({ title, onClick, children }: { title: string; onClick: () => void; children: string }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px] transition hover:bg-[var(--color-bg)]"
    >
      {children}
    </button>
  );
}
