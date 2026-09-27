import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useAppStore } from '../../app/store';
import { useSimStore } from '../../app/simStore';
import { computeLintWarnings } from '../../editor/layoutLinter';

// Plain-language explanation of what's happening and what (if anything) is
// stopping the simulation from running — no jargon, no silent failure.
export function SimStatus() {
  const layout = useAppStore((s) => s.project.baseline);
  const width = useAppStore((s) => s.project.grid.width);
  const height = useAppStore((s) => s.project.grid.height);
  const layoutVersion = useAppStore((s) => s.layoutVersion);
  const status = useSimStore((s) => s.status);
  const worker = useSimStore((s) => s.worker);
  const error = useSimStore((s) => s.error);
  const t = useSimStore((s) => s.t);
  const metrics = useSimStore((s) => s.metrics);
  const simStartS = useAppStore((s) => s.project.demand.simStartS);

  const blockingIssues = useMemo(() => computeLintWarnings(layout, width, height).filter((w) => w.severity === 'error'), [layout, width, height, layoutVersion]);

  if (error) {
    return (
      <Banner tone="danger" title="The simulation hit an error and stopped.">
        {error}
      </Banner>
    );
  }

  if (blockingIssues.length > 0) {
    return (
      <Banner tone="danger" title={`This layout has ${blockingIssues.length} problem${blockingIssues.length > 1 ? 's' : ''} that will stop buyers from moving correctly.`}>
        {blockingIssues[0].message} Open the Editor tab and check the Issues panel (top-left of the canvas) to fix{blockingIssues.length > 1 ? ' these' : ' it'}.
      </Banner>
    );
  }

  if (!worker || status === 'idle') {
    return <Banner tone="neutral" title="Starting the simulation…">Setting up the market and its buyers for the first time.</Banner>;
  }

  if (status === 'paused' && t === simStartS && metrics.spawned === 0) {
    return <Banner tone="neutral" title="Ready to simulate.">Press play below to start letting buyers into the market.</Banner>;
  }

  if (status === 'running') {
    return (
      <Banner tone="ok" title="Simulating.">
        {metrics.peopleInMarket} people in the market right now · {metrics.spawned} have arrived so far.
      </Banner>
    );
  }

  if (status === 'done') {
    return (
      <Banner tone="ok" title="Finished.">
        {metrics.spawned} buyers came through in total. Scroll down for charts, or use the heatmap views to see where they got stuck.
      </Banner>
    );
  }

  return (
    <Banner tone="neutral" title="Paused.">
      {metrics.peopleInMarket} people in the market. Press play to continue.
    </Banner>
  );
}

function Banner({ tone, title, children }: { tone: 'danger' | 'ok' | 'neutral'; title: string; children?: ReactNode }) {
  const palette = {
    danger: { bg: '#FBEAE7', fg: '#8A2E22', icon: '⚠' },
    ok: { bg: '#E7F5EE', fg: '#1E6B48', icon: '●' },
    neutral: { bg: 'var(--color-accent-soft)', fg: 'var(--color-accent-hover)', icon: '○' },
  }[tone];
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-xs" style={{ background: palette.bg, color: palette.fg }}>
      <span aria-hidden>{palette.icon}</span>
      <span className="font-medium">{title}</span>
      {children && <span className="opacity-90">{children}</span>}
    </div>
  );
}
