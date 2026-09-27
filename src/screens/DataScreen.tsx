import type { ReactNode } from 'react';
import { useRef, useState } from 'react';
import { useAppStore } from '../app/store';
import { countProvenance } from '../data/provenance';
import { computeLayoutStats } from '../data/layoutStats';
import { generateSuggestions } from '../data/suggestions';
import { downloadMarketReport } from '../data/reportImage';
import { buildShareUrl } from '../data/shareLink';
import { PRODUCE_COLORS } from '../data/schema';
import { computeLintWarnings } from '../editor/layoutLinter';
import { produceLabel } from '../editor/labels';

function pct(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

export function DataScreen() {
  const project = useAppStore((s) => s.project);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareInputRef = useRef<HTMLInputElement>(null);
  const stats = computeLayoutStats(project);
  const provenance = countProvenance(project);
  const totalParams = provenance.measured + provenance.assumed + provenance.literature;
  const lint = computeLintWarnings(project.baseline, project.grid.width, project.grid.height);
  const errors = lint.filter((w) => w.severity === 'error');
  const warnings = lint.filter((w) => w.severity === 'warning');

  const topProduce = (Object.entries(stats.produceCounts) as [string, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);

  const insights = buildInsights(stats, provenance, totalParams, errors);
  const suggestions = generateSuggestions(project);

  async function handleShare() {
    setShareBusy(true);
    setCopied(false);
    try {
      const url = await buildShareUrl(project);
      setShareUrl(url);
      setTimeout(() => shareInputRef.current?.select(), 0);
    } finally {
      setShareBusy(false);
    }
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // Clipboard access can be silently blocked in some embedded/sandboxed
      // contexts — the link is still shown in a selectable input either way.
      shareInputRef.current?.select();
    }
  }

  return (
    <div className="h-full overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
              {project.meta.name} — data &amp; insights
            </h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              What this layout is actually made of, and what the demand model assumes — computed straight from your drawing, no simulation required.
            </p>
          </div>
          <div className="relative shrink-0">
            <div className="flex gap-2">
              <button
                onClick={() => downloadMarketReport(project)}
                className="rounded-lg px-3 py-2 text-sm font-medium transition hover:brightness-95"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border-strong)' }}
                title="Download a one-page PNG summary of this market"
              >
                ⬇ Export report
              </button>
              <button
                onClick={() => void handleShare()}
                disabled={shareBusy}
                className="rounded-lg px-3 py-2 text-sm font-medium transition hover:brightness-95 disabled:opacity-60"
                style={{ background: 'var(--color-bg)', color: 'var(--color-text)', border: '1px solid var(--color-border-strong)' }}
                title="Get a read-only link to this report"
              >
                {shareBusy ? 'Building link…' : '🔗 Share'}
              </button>
            </div>
            {shareUrl && (
              <div className="absolute right-0 top-full z-20 mt-1 w-96 rounded-2xl p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-lg)' }}>
                <p className="mb-1.5 text-[11px] font-medium" style={{ color: 'var(--color-text-muted)' }}>
                  Anyone with this link can view a read-only snapshot of this report — no account, no edit access.
                </p>
                <div className="flex gap-1.5">
                  <input
                    ref={shareInputRef}
                    readOnly
                    value={shareUrl}
                    onFocus={(e) => e.target.select()}
                    className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-xs"
                    style={{ borderColor: 'var(--color-border-strong)', color: 'var(--color-text)' }}
                  />
                  <button onClick={() => void handleCopy()} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-white" style={{ background: 'var(--color-accent)' }}>
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button onClick={() => setShareUrl(null)} className="mt-2 text-[11px]" style={{ color: 'var(--color-text-muted)' }}>
                  Close
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Market area" value={`${Math.round(stats.areaM2)} m²`} />
          <StatCard label="Walkable space" value={pct(stats.walkableFraction)} />
          <StatCard label="Stalls" value={String(stats.stallCount)} />
          <StatCard label="Entrances" value={`${stats.pedEntranceCount} ped · ${stats.vehEntranceCount} veh`} />
        </div>

        <Section title="Land use">
          <div className="flex h-4 overflow-hidden rounded-full" style={{ background: 'var(--color-bg)' }}>
            {stats.tileBreakdown.map((t) => (
              <div key={t.tileId} title={`${t.name}: ${pct(t.fraction)}`} style={{ width: `${t.fraction * 100}%`, background: t.color }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {stats.tileBreakdown
              .filter((t) => t.fraction > 0)
              .map((t) => (
                <div key={t.tileId} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: t.color }} />
                  <span className="truncate">{t.name}</span>
                  <span className="ml-auto tabular-nums" style={{ color: 'var(--color-text-faint)' }}>
                    {pct(t.fraction)}
                  </span>
                </div>
              ))}
          </div>
        </Section>

        <Section title="Produce mix">
          {topProduce.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-text-faint)' }}>
              No stalls have a produce category assigned yet.
            </p>
          ) : (
            <div className="space-y-1.5">
              {topProduce.map(([p, n]) => (
                <div key={p} className="flex items-center gap-2">
                  <span className="w-28 shrink-0 truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {produceLabel(p)}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-bg)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(n / stats.stallCount) * 100}%`, background: PRODUCE_COLORS[p as keyof typeof PRODUCE_COLORS] }} />
                  </div>
                  <span className="w-6 shrink-0 text-right text-xs tabular-nums" style={{ color: 'var(--color-text-faint)' }}>
                    {n}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Demand assumptions">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatCard label="Expected buyer arrivals" value={String(Math.round(stats.expectedPedArrivals))} />
            <StatCard label="Arrivals / hour" value={Math.round(stats.pedArrivalsPerHour).toString()} />
            <StatCard label="Vehicle bays" value={String(stats.vehicleBayCount)} />
          </div>
        </Section>

        <Section title="Parameter provenance">
          <div className="flex items-center gap-4">
            <ProvenanceBar provenance={provenance} total={totalParams} />
          </div>
          <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {provenance.measured} measured · {provenance.literature} from literature · {provenance.assumed} assumed
            {totalParams > 0 && ` (${pct(provenance.assumed / totalParams)} of all parameters)`}
          </p>
        </Section>

        <Section title="Layout health">
          {errors.length === 0 && warnings.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--color-success)' }}>
              No blocking issues or warnings — this layout is ready to simulate.
            </p>
          ) : (
            <ul className="space-y-1 text-sm">
              {[...errors, ...warnings].map((w) => (
                <li key={w.id} style={{ color: w.severity === 'error' ? 'var(--color-danger)' : 'var(--color-text-muted)' }}>
                  {w.severity === 'error' ? '● ' : '○ '}
                  {w.message}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {suggestions.length > 0 && (
          <Section title="Why might this be congested?">
            <ul className="space-y-2 text-sm">
              {suggestions.map((s) => (
                <li key={s.id} className="flex gap-2">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: s.severity === 'high' ? 'var(--color-danger)' : 'var(--color-accent)' }}
                  />
                  <span style={{ color: 'var(--color-text)' }}>{s.message}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Insights">
          <ul className="list-disc space-y-1.5 pl-4 text-sm" style={{ color: 'var(--color-text)' }}>
            {insights.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
        {label}
      </div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums" style={{ color: 'var(--color-text)' }}>
        {value}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <h2 className="mb-3 text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ProvenanceBar({ provenance, total }: { provenance: { measured: number; assumed: number; literature: number }; total: number }) {
  if (total === 0) return <p className="text-sm" style={{ color: 'var(--color-text-faint)' }}>No tagged parameters.</p>;
  const segments = [
    { key: 'measured', n: provenance.measured, color: 'var(--color-success)' },
    { key: 'literature', n: provenance.literature, color: 'var(--color-accent)' },
    { key: 'assumed', n: provenance.assumed, color: 'var(--color-text-faint)' },
  ];
  return (
    <div className="h-3 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-bg)' }}>
      <div className="flex h-full">
        {segments.map((s) => (
          <div key={s.key} title={`${s.key}: ${s.n}`} style={{ width: `${(s.n / total) * 100}%`, background: s.color }} />
        ))}
      </div>
    </div>
  );
}

export function buildInsights(
  stats: ReturnType<typeof computeLayoutStats>,
  provenance: { measured: number; assumed: number; literature: number },
  totalParams: number,
  errors: { message: string }[],
): string[] {
  const lines: string[] = [];

  if (stats.stallCount > 0 && stats.areaM2PerStall != null) {
    lines.push(`${stats.stallCount} stall${stats.stallCount === 1 ? '' : 's'} across ${Math.round(stats.areaM2)} m² — about ${Math.round(stats.areaM2PerStall)} m² of market per stall.`);
  } else {
    lines.push(`This layout has no stalls yet — add some to get per-stall and demand insights.`);
  }

  lines.push(`${pct(stats.walkableFraction)} of the drawn area is open for movement (paths, entrances, vehicle bays); the rest is built up by stalls and other fixed structures.`);

  if (stats.stallsPerPedEntrance != null) {
    lines.push(`${Math.round(stats.stallsPerPedEntrance * 10) / 10} stalls per pedestrian entrance — a single busy gate can become the layout's bottleneck if this is high.`);
  }

  if (stats.produceDiversity > 0) {
    lines.push(`Produce spans ${stats.produceDiversity} of ${Object.keys(stats.produceCounts).length} tracked categories.`);
  }

  if (stats.expectedPedArrivals > 0) {
    lines.push(`The demand model expects about ${Math.round(stats.expectedPedArrivals)} buyer arrivals over the simulated window — roughly ${Math.round(stats.pedArrivalsPerHour)} per hour.`);
  }

  if (totalParams > 0 && provenance.assumed > provenance.measured + provenance.literature) {
    lines.push(`Most of the numbers behind this simulation (${provenance.assumed} of ${totalParams}) are assumptions rather than measurements — treat results as directional, and prioritize measuring the parameters that drive your key decisions.`);
  }

  if (errors.length > 0) {
    lines.push(`This layout has ${errors.length} blocking issue${errors.length === 1 ? '' : 's'} (see Layout health above) — fix ${errors.length === 1 ? 'it' : 'these'} before running a simulation.`);
  }

  return lines;
}
