import { useEffect, useState } from 'react';
import type { Project, ProvenanceTag } from '../data/schema';
import type { ProjectSummary } from '../data/projectLibrary';
import { listProjectSummaries, loadProjectFromLibrary } from '../data/projectLibrary';
import { countProvenance } from '../data/provenance';
import type { LayoutStats } from '../data/layoutStats';
import { computeLayoutStats } from '../data/layoutStats';
import { computeLintWarnings } from '../editor/layoutLinter';
import type { WorkerMessage } from '../sim/worker/protocol';

interface RunResult {
  status: 'running' | 'done' | 'error';
  spawned: number;
  despawned: number;
  skippedQueue: number;
  skippedBlocked: number;
  vehiclesSpawned: number;
  vehiclesFailedUnloads: number;
  vehicleConflicts: number;
  meanTimeInMarketS: number | null;
  error?: string;
}

const ZERO: Omit<RunResult, 'status'> = {
  spawned: 0,
  despawned: 0,
  skippedQueue: 0,
  skippedBlocked: 0,
  vehiclesSpawned: 0,
  vehiclesFailedUnloads: 0,
  vehicleConflicts: 0,
  meanTimeInMarketS: null,
};

function runHeadless(project: Project): Promise<RunResult> {
  return new Promise((resolve) => {
    const worker = new Worker(new URL('../sim/worker/sim.worker.ts', import.meta.url), { type: 'module' });
    const timeout = setTimeout(() => {
      worker.terminate();
      resolve({ status: 'error', error: 'Timed out before the simulation finished.', ...ZERO });
    }, 30_000);
    worker.onerror = (e) => {
      clearTimeout(timeout);
      resolve({ status: 'error', error: e.message || 'The simulation worker crashed.', ...ZERO });
      worker.terminate();
    };
    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data;
      if (msg.type === 'done') {
        clearTimeout(timeout);
        const mean = msg.timesInMarket.length > 0 ? msg.timesInMarket.reduce((a, b) => a + b, 0) / msg.timesInMarket.length : null;
        resolve({
          status: 'done',
          spawned: msg.finalMetrics.spawned,
          despawned: msg.finalMetrics.despawned,
          skippedQueue: msg.finalMetrics.skippedQueue,
          skippedBlocked: msg.finalMetrics.skippedBlocked,
          vehiclesSpawned: msg.finalMetrics.vehiclesSpawned,
          vehiclesFailedUnloads: msg.finalMetrics.vehiclesFailedUnloads,
          vehicleConflicts: msg.finalMetrics.vehicleConflicts,
          meanTimeInMarketS: mean,
        });
        worker.terminate();
      } else if (msg.type === 'error') {
        clearTimeout(timeout);
        resolve({ status: 'error', error: msg.message, ...ZERO });
        worker.terminate();
      }
    };
    worker.postMessage({ type: 'init', project, scenarioId: 'baseline', seed: 1 });
    worker.postMessage({ type: 'setSpeed', multiplier: 100_000 });
    worker.postMessage({ type: 'run' });
  });
}

export function CompareScreen() {
  const [summaries, setSummaries] = useState<ProjectSummary[]>([]);
  const [idA, setIdA] = useState('');
  const [idB, setIdB] = useState('');
  const [projectA, setProjectA] = useState<Project | null>(null);
  const [projectB, setProjectB] = useState<Project | null>(null);
  const [resultA, setResultA] = useState<RunResult | null>(null);
  const [resultB, setResultB] = useState<RunResult | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    void listProjectSummaries().then((list) => {
      setSummaries(list);
      setIdA((cur) => cur || list[0]?.id || '');
      setIdB((cur) => cur || list.find((p) => p.id !== list[0]?.id)?.id || '');
    });
  }, []);

  useEffect(() => {
    setResultA(null);
    setResultB(null);
    if (idA) void loadProjectFromLibrary(idA).then((p) => setProjectA(p ?? null));
    else setProjectA(null);
  }, [idA]);

  useEffect(() => {
    setResultA(null);
    setResultB(null);
    if (idB) void loadProjectFromLibrary(idB).then((p) => setProjectB(p ?? null));
    else setProjectB(null);
  }, [idB]);

  async function runBoth() {
    if (!projectA || !projectB) return;
    setRunning(true);
    setResultA({ status: 'running', ...ZERO });
    setResultB({ status: 'running', ...ZERO });
    const [ra, rb] = await Promise.all([runHeadless(projectA), runHeadless(projectB)]);
    setResultA(ra);
    setResultB(rb);
    setRunning(false);
  }

  const summaryA = summaries.find((s) => s.id === idA);
  const summaryB = summaries.find((s) => s.id === idB);
  const provA = projectA ? countProvenance(projectA) : null;
  const provB = projectB ? countProvenance(projectB) : null;
  const statsA = projectA ? computeLayoutStats(projectA) : null;
  const statsB = projectB ? computeLayoutStats(projectB) : null;
  const issuesA = projectA ? computeLintWarnings(projectA.baseline, projectA.grid.width, projectA.grid.height).filter((w) => w.severity === 'error') : [];
  const issuesB = projectB ? computeLintWarnings(projectB.baseline, projectB.grid.width, projectB.grid.height).filter((w) => w.severity === 'error') : [];
  const canRun = issuesA.length === 0 && issuesB.length === 0;
  const insights = summaryA && summaryB && statsA && statsB ? buildComparisonInsights(summaryA.name, summaryB.name, statsA, statsB, resultA, resultB) : [];

  if (summaries.length < 2) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm" style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg)' }}>
        You need at least two markets to compare. Create another one from the Projects tab.
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            Compare markets
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Pick any two of your saved markets to compare their layout, then optionally run both simulations to compare results.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <PickerCard label="Market A" summaries={summaries} value={idA} onChange={setIdA} exclude={idB} />
          <PickerCard label="Market B" summaries={summaries} value={idB} onChange={setIdB} exclude={idA} />
        </div>

        {summaryA && summaryB && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <Thumb summary={summaryA} />
              <Thumb summary={summaryB} />
            </div>

            <StatTable summaryA={summaryA} summaryB={summaryB} provA={provA} provB={provB} />

            {insights.length > 0 && (
              <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <h2 className="mb-2 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
                  Insights
                </h2>
                <ul className="list-disc space-y-1.5 pl-4 text-sm" style={{ color: 'var(--color-text)' }}>
                  {insights.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              {canRun ? (
                <button
                  onClick={() => void runBoth()}
                  disabled={running}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:opacity-60"
                  style={{ background: 'var(--color-accent)' }}
                >
                  {running ? 'Simulating both…' : 'Run both and compare results'}
                </button>
              ) : (
                <p className="text-xs" style={{ color: 'var(--color-danger)' }}>
                  Fix layout problems before running a comparison: {issuesA.length > 0 && `${summaryA.name} — ${issuesA[0].message}`}
                  {issuesA.length > 0 && issuesB.length > 0 && ' · '}
                  {issuesB.length > 0 && `${summaryB.name} — ${issuesB[0].message}`}
                </p>
              )}
              {(resultA || resultB) && <ResultTable a={resultA} b={resultB} nameA={summaryA.name} nameB={summaryB.name} />}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PickerCard({ label, summaries, value, onChange, exclude }: { label: string; summaries: ProjectSummary[]; value: string; onChange: (id: string) => void; exclude: string }) {
  return (
    <label className="flex flex-col gap-1 rounded-2xl p-3 text-xs" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <span className="font-medium" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm" style={{ borderColor: 'var(--color-border-strong)' }}>
        {summaries
          .filter((s) => s.id === value || s.id !== exclude)
          .map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function Thumb({ summary }: { summary: ProjectSummary }) {
  return (
    <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex h-36 items-center justify-center" style={{ background: '#F5F3EC' }}>
        {summary.thumbnail ? <img src={summary.thumbnail} alt="" className="h-full w-full object-contain" /> : <span style={{ color: 'var(--color-text-faint)' }}>▦</span>}
      </div>
      <div className="p-2 text-center text-xs font-medium" style={{ color: 'var(--color-text)' }}>
        {summary.name}
      </div>
    </div>
  );
}

function StatRow({ label, a, b }: { label: string; a: string; b: string }) {
  return (
    <tr>
      <td className="py-1.5 pr-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </td>
      <td className="py-1.5 pr-3 text-right text-sm tabular-nums" style={{ color: 'var(--color-text)' }}>
        {a}
      </td>
      <td className="py-1.5 text-right text-sm tabular-nums" style={{ color: 'var(--color-text)' }}>
        {b}
      </td>
    </tr>
  );
}

function provenanceStr(p: Record<ProvenanceTag, number> | null): string {
  if (!p) return '—';
  return `${p.measured} measured, ${p.assumed} assumed`;
}

function StatTable({
  summaryA,
  summaryB,
  provA,
  provB,
}: {
  summaryA: ProjectSummary;
  summaryB: ProjectSummary;
  provA: Record<ProvenanceTag, number> | null;
  provB: Record<ProvenanceTag, number> | null;
}) {
  return (
    <div className="overflow-hidden rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <table className="w-full">
        <thead>
          <tr>
            <th />
            <th className="pb-2 text-right text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
              {summaryA.name}
            </th>
            <th className="pb-2 text-right text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
              {summaryB.name}
            </th>
          </tr>
        </thead>
        <tbody>
          <StatRow label="Size" a={`${summaryA.width}×${summaryA.height} m`} b={`${summaryB.width}×${summaryB.height} m`} />
          <StatRow label="Cell size" a={`${summaryA.cellSizeM} m`} b={`${summaryB.cellSizeM} m`} />
          <StatRow label="Stalls" a={String(summaryA.stallCount)} b={String(summaryB.stallCount)} />
          <StatRow label="Entrances" a={String(summaryA.entranceCount)} b={String(summaryB.entranceCount)} />
          <StatRow label="Parameters" a={provenanceStr(provA)} b={provenanceStr(provB)} />
        </tbody>
      </table>
    </div>
  );
}

function ResultRow({ label, a, b }: { label: string; a: RunResult | null; b: RunResult | null }) {
  return (
    <tr>
      <td className="py-1.5 pr-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {label}
      </td>
      <td className="py-1.5 pr-3 text-right text-sm tabular-nums" style={{ color: 'var(--color-text)' }}>
        {a?.status === 'done' ? a[label as keyof RunResult] : a?.status === 'running' ? '…' : '—'}
      </td>
      <td className="py-1.5 text-right text-sm tabular-nums" style={{ color: 'var(--color-text)' }}>
        {b?.status === 'done' ? b[label as keyof RunResult] : b?.status === 'running' ? '…' : '—'}
      </td>
    </tr>
  );
}

function ResultTable({ a, b, nameA, nameB }: { a: RunResult | null; b: RunResult | null; nameA: string; nameB: string }) {
  if (a?.status === 'error' || b?.status === 'error') {
    return (
      <p className="mt-3 text-xs" style={{ color: 'var(--color-danger)' }}>
        {a?.status === 'error' ? `${nameA}: ${a.error} ` : ''}
        {b?.status === 'error' ? `${nameB}: ${b.error}` : ''}
      </p>
    );
  }
  return (
    <table className="mt-3 w-full">
      <thead>
        <tr>
          <th />
          <th className="pb-1 text-right text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
            {nameA}
          </th>
          <th className="pb-1 text-right text-xs font-semibold" style={{ color: 'var(--color-text)' }}>
            {nameB}
          </th>
        </tr>
      </thead>
      <tbody>
        <ResultRow label="spawned" a={a} b={b} />
        <ResultRow label="despawned" a={a} b={b} />
        <ResultRow label="skippedQueue" a={a} b={b} />
        <ResultRow label="skippedBlocked" a={a} b={b} />
        <ResultRow label="vehiclesSpawned" a={a} b={b} />
        <ResultRow label="vehiclesFailedUnloads" a={a} b={b} />
        <ResultRow label="vehicleConflicts" a={a} b={b} />
        <tr>
          <td className="py-1.5 pr-3 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            Mean time in market
          </td>
          <td className="py-1.5 pr-3 text-right text-sm tabular-nums" style={{ color: 'var(--color-text)' }}>
            {a?.status === 'done' && a.meanTimeInMarketS != null ? `${Math.round(a.meanTimeInMarketS / 60)} min` : a?.status === 'running' ? '…' : '—'}
          </td>
          <td className="py-1.5 text-right text-sm tabular-nums" style={{ color: 'var(--color-text)' }}>
            {b?.status === 'done' && b.meanTimeInMarketS != null ? `${Math.round(b.meanTimeInMarketS / 60)} min` : b?.status === 'running' ? '…' : '—'}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function compareCount(label: string, nameA: string, nameB: string, a: number, b: number): string | null {
  if (a === b) return null;
  const [more, moreVal, less, lessVal] = a > b ? [nameA, a, nameB, b] : [nameB, b, nameA, a];
  return `${more} had ${moreVal} ${label} vs ${lessVal} in ${less}.`;
}

function buildComparisonInsights(nameA: string, nameB: string, statsA: LayoutStats, statsB: LayoutStats, resultA: RunResult | null, resultB: RunResult | null): string[] {
  const lines: string[] = [];

  if (statsA.stallCount !== statsB.stallCount) {
    const [more, moreN, less, lessN] = statsA.stallCount > statsB.stallCount ? [nameA, statsA.stallCount, nameB, statsB.stallCount] : [nameB, statsB.stallCount, nameA, statsA.stallCount];
    lines.push(`${more} has more stalls than ${less} (${moreN} vs ${lessN}).`);
  }

  if (statsA.areaM2PerStall != null && statsB.areaM2PerStall != null && Math.round(statsA.areaM2PerStall) !== Math.round(statsB.areaM2PerStall)) {
    const [tighter, tighterVal, looser, looserVal] =
      statsA.areaM2PerStall < statsB.areaM2PerStall ? [nameA, statsA.areaM2PerStall, nameB, statsB.areaM2PerStall] : [nameB, statsB.areaM2PerStall, nameA, statsA.areaM2PerStall];
    lines.push(`${tighter} packs stalls tighter — about ${Math.round(tighterVal as number)} m² per stall, vs ${Math.round(looserVal as number)} m² in ${looser}.`);
  }

  const walkDiffPts = Math.round((statsA.walkableFraction - statsB.walkableFraction) * 100);
  if (Math.abs(walkDiffPts) >= 2) {
    const [more, moreFrac, less, lessFrac] = walkDiffPts > 0 ? [nameA, statsA.walkableFraction, nameB, statsB.walkableFraction] : [nameB, statsB.walkableFraction, nameA, statsA.walkableFraction];
    lines.push(`${more} dedicates more space to movement — ${Math.round((moreFrac as number) * 100)}% walkable vs ${Math.round((lessFrac as number) * 100)}% in ${less}.`);
  }

  if (statsA.stallsPerPedEntrance != null && statsB.stallsPerPedEntrance != null && Math.round(statsA.stallsPerPedEntrance * 10) !== Math.round(statsB.stallsPerPedEntrance * 10)) {
    const [more, moreVal, less] =
      statsA.stallsPerPedEntrance > statsB.stallsPerPedEntrance ? [nameA, statsA.stallsPerPedEntrance, nameB] : [nameB, statsB.stallsPerPedEntrance, nameA];
    lines.push(`${more} has more stalls riding on each pedestrian entrance (${Math.round((moreVal as number) * 10) / 10} per gate) than ${less} — a single busy gate is more likely to bottleneck it.`);
  }

  if (resultA?.status === 'done' && resultB?.status === 'done') {
    if (resultA.meanTimeInMarketS != null && resultB.meanTimeInMarketS != null && resultA.meanTimeInMarketS !== resultB.meanTimeInMarketS) {
      const [slower, slowerVal, faster, fasterVal] =
        resultA.meanTimeInMarketS > resultB.meanTimeInMarketS
          ? [nameA, resultA.meanTimeInMarketS, nameB, resultB.meanTimeInMarketS]
          : [nameB, resultB.meanTimeInMarketS, nameA, resultA.meanTimeInMarketS];
      const pctLonger = (fasterVal as number) > 0 ? Math.round((((slowerVal as number) - (fasterVal as number)) / (fasterVal as number)) * 100) : null;
      lines.push(
        `Buyers spend longer in ${slower} — about ${Math.round((slowerVal as number) / 60)} min vs ${Math.round((fasterVal as number) / 60)} min in ${faster}${pctLonger ? ` (${pctLonger}% longer)` : ''}.`,
      );
    }
    const blocked = compareCount('trip(s) turned away by a blocked stall', nameA, nameB, resultA.skippedBlocked, resultB.skippedBlocked);
    if (blocked) lines.push(blocked);
    const queued = compareCount('buyer(s) who gave up waiting in a queue', nameA, nameB, resultA.skippedQueue, resultB.skippedQueue);
    if (queued) lines.push(queued);
    const conflicts = compareCount('vehicle conflict(s)', nameA, nameB, resultA.vehicleConflicts, resultB.vehicleConflicts);
    if (conflicts) lines.push(conflicts);
  }

  return lines;
}
