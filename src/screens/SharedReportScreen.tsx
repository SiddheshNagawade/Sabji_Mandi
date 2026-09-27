import type { ReactNode } from 'react';
import type { ShareableReport } from '../data/shareLink';

function pct(frac: number): string {
  return `${Math.round(frac * 100)}%`;
}

export function SharedReportScreen({ report, onClose }: { report: ShareableReport; onClose: () => void }) {
  const totalParams = report.provenance.measured + report.provenance.assumed + report.provenance.literature;

  return (
    <div className="h-screen overflow-y-auto" style={{ background: 'var(--color-bg)' }}>
      <div className="mx-auto max-w-4xl space-y-5 px-6 py-8">
        <div className="rounded-2xl px-4 py-2.5 text-xs" style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-hover)' }}>
          You're viewing a read-only, shared snapshot from Mandi Flow Simulator — generated {new Date(report.generatedAt).toLocaleString()}.{' '}
          <button onClick={onClose} className="underline">
            Open the app
          </button>
        </div>

        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
            {report.name} — market report
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            A shared summary of this market's layout and demand assumptions.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl" style={{ border: '1px solid var(--color-border)' }}>
          <img src={report.thumbnail} alt={`${report.name} layout`} className="w-full" style={{ background: '#F5F3EC' }} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Market area" value={`${Math.round(report.areaM2)} m²`} />
          <StatCard label="Walkable space" value={pct(report.walkableFraction)} />
          <StatCard label="Stalls" value={String(report.stallCount)} />
          <StatCard label="Entrances" value={`${report.pedEntranceCount} ped · ${report.vehEntranceCount} veh`} />
        </div>

        <Section title="Land use">
          <div className="flex h-4 overflow-hidden rounded-full" style={{ background: 'var(--color-bg)' }}>
            {report.tileBreakdown.map((t) => (
              <div key={t.name} title={`${t.name}: ${pct(t.fraction)}`} style={{ width: `${t.fraction * 100}%`, background: t.color }} />
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {report.tileBreakdown.map((t) => (
              <div key={t.name} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: t.color }} />
                <span className="truncate">{t.name}</span>
                <span className="ml-auto tabular-nums" style={{ color: 'var(--color-text-faint)' }}>
                  {pct(t.fraction)}
                </span>
              </div>
            ))}
          </div>
        </Section>

        {report.produceMix.length > 0 && (
          <Section title="Produce mix">
            <div className="space-y-1.5">
              {report.produceMix.map((p) => (
                <div key={p.label} className="flex items-center gap-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="w-28 shrink-0 truncate">{p.label}</span>
                  <span className="tabular-nums" style={{ color: 'var(--color-text-faint)' }}>
                    {p.count}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Section title="Parameter provenance">
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {report.provenance.measured} measured · {report.provenance.literature} from literature · {report.provenance.assumed} assumed
            {totalParams > 0 && ` (${pct(report.provenance.assumed / totalParams)} of all parameters)`}
          </p>
        </Section>

        {report.suggestions.length > 0 && (
          <Section title="Things worth looking at">
            <ul className="space-y-2 text-sm">
              {report.suggestions.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.severity === 'high' ? 'var(--color-danger)' : 'var(--color-accent)' }} />
                  <span style={{ color: 'var(--color-text)' }}>{s.message}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Insights">
          <ul className="list-disc space-y-1.5 pl-4 text-sm" style={{ color: 'var(--color-text)' }}>
            {report.insights.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </Section>

        <p className="pb-4 text-center text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
          This is a static snapshot — it won't update if the original market changes.
        </p>
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
