import { useEffect, useRef, useState } from 'react';
import { useAppStore } from './app/store';
import { loadAutosave } from './data/io';
import { EditorScreen, SimulateScreen, CompareScreen, DataScreen, HistoryScreen, PitchScreen } from './screens';

const TABS = [
  { id: 'editor', label: 'Editor' },
  { id: 'simulate', label: 'Simulate' },
  { id: 'compare', label: 'Compare' },
  { id: 'data', label: 'Data' },
  { id: 'history', label: 'History' },
  { id: 'pitch', label: 'Pitch' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function App() {
  const [tab, setTab] = useState<TabId>('editor');
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
    void loadAutosave().then((saved) => {
      if (saved && !cancelled) setProject(saved);
    });
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
          {TABS.filter((t) => t.id !== 'pitch').map((t) => (
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
        <div className="ml-auto flex items-center gap-2 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
          <span className="mr-1 hidden sm:inline">{project.meta.name}</span>
          <button className="rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-[var(--color-bg)]" onClick={undo} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button className="rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-[var(--color-bg)]" onClick={redo} title="Redo (Ctrl+Shift+Z)">
            ↷ Redo
          </button>
          <div className="mx-0.5 h-5 w-px" style={{ background: 'var(--color-border)' }} />
          <button className="rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-[var(--color-bg)]" onClick={saveProjectFile}>
            Save
          </button>
          <button className="rounded-lg px-2.5 py-1.5 font-medium transition hover:bg-[var(--color-bg)]" onClick={() => fileInputRef.current?.click()}>
            Load
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
        {tab === 'editor' && <EditorScreen />}
        {tab === 'simulate' && <SimulateScreen />}
        {tab === 'compare' && <CompareScreen />}
        {tab === 'data' && <DataScreen />}
        {tab === 'history' && <HistoryScreen />}
      </main>
    </div>
  );
}
