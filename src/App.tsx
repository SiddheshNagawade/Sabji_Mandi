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
    <div className="flex h-screen flex-col bg-[#f2efe6]">
      <header className="flex items-center gap-4 border-b border-neutral-300 bg-white px-3 py-2">
        <span className="font-semibold">Mandi Flow Simulator</span>
        <nav className="flex gap-1">
          {TABS.filter((t) => t.id !== 'pitch').map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`rounded px-3 py-1 text-sm ${tab === t.id ? 'bg-neutral-800 text-white' : 'text-neutral-700 hover:bg-neutral-100'}`}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-neutral-500">Project: {project.meta.name}</span>
          <button className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100" onClick={undo}>
            Undo
          </button>
          <button className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100" onClick={redo}>
            Redo
          </button>
          <button className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100" onClick={saveProjectFile}>
            Save
          </button>
          <button className="rounded border border-neutral-300 px-2 py-1 hover:bg-neutral-100" onClick={() => fileInputRef.current?.click()}>
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
