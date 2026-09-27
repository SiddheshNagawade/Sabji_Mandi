// Turns already-detected problems (the layout linter's warnings, plus a
// couple of structural heuristics over computeLayoutStats) into concrete,
// actionable suggestions — "why is this congested, and what would help" —
// rather than just flagging that something's wrong. Deliberately excludes
// the linter's error-level findings (no entrance, unreachable stall, etc.):
// those are hard blockers already surfaced in the Editor's Issues panel and
// the Data screen's Layout health section, so restating them here would be
// noise, not a new insight.

import type { Project } from './schema';
import type { LayoutStats } from './layoutStats';
import { computeLayoutStats } from './layoutStats';
import { computeLintWarnings } from '../editor/layoutLinter';

export interface Suggestion {
  id: string;
  severity: 'high' | 'medium';
  message: string;
  cellCount: number;
}

function fromLint(project: Project): Suggestion[] {
  const warnings = computeLintWarnings(project.baseline, project.grid.width, project.grid.height).filter((w) => w.severity !== 'error');
  const out: Suggestion[] = [];
  for (const w of warnings) {
    switch (true) {
      case w.id === 'narrow-aisle':
        out.push({ id: w.id, severity: 'medium', message: `${w.cells.length}+ path cell(s) are narrower than 2 cells wide — widen these aisles so two people (or a buyer and a handcart) can pass without stopping.`, cellCount: w.cells.length });
        break;
      case w.id.startsWith('stall-front-wall-'):
        out.push({ id: w.id, severity: 'high', message: `${w.message.replace(/^Stall "(.+)" front edge faces a wall\.$/, 'Stall "$1"')} has its front edge boxed in by a wall or another block — buyers can't queue at it. Move the stall, or clear the cell(s) directly in front of it.`, cellCount: w.cells.length });
        break;
      case w.id.startsWith('entrance-overlap-'):
        out.push({ id: w.id, severity: 'medium', message: `${w.message} Sharing cells between two gates splits arrival flow unpredictably — give each one its own.`, cellCount: w.cells.length });
        break;
      case w.id === 'arrow-into-wall':
        out.push({ id: w.id, severity: 'high', message: `${w.message} A buyer following that arrow walks straight into an obstruction — redirect or remove those arrows.`, cellCount: w.cells.length });
        break;
      case w.id === 'arrow-closed-loop':
        out.push({ id: w.id, severity: 'high', message: `${w.message} They can circulate forever without ever reaching an exit — add an arrow that leads out of the loop, or clear it so people can choose their own path.`, cellCount: w.cells.length });
        break;
      default:
        break;
    }
  }
  return out;
}

function fromStats(stats: LayoutStats): Suggestion[] {
  const out: Suggestion[] = [];

  if (stats.pedEntranceCount <= 1 && stats.stallCount >= 5) {
    out.push({
      id: 'single-entrance',
      severity: 'high',
      message: `${stats.stallCount} stalls all rely on a single pedestrian entrance — every arriving and departing buyer funnels through one gate. A second gate (even exit-only) would cut peak crowding there.`,
      cellCount: 0,
    });
  }

  if (stats.walkableFraction < 0.5 && stats.stallCount > 0) {
    out.push({
      id: 'low-walkable-fraction',
      severity: 'medium',
      message: `Only ${Math.round(stats.walkableFraction * 100)}% of the drawn area is walkable — the rest is stalls and other fixed structures. Below half, aisles tend to feel cramped even before buyers arrive; widening a few key paths usually helps more than widening all of them.`,
      cellCount: 0,
    });
  }

  if (stats.vehicleBayCount > 0 && stats.vehEntranceCount === 0) {
    out.push({
      id: 'vehicle-bays-no-gate',
      severity: 'high',
      message: `This layout has ${stats.vehicleBayCount} vehicle bay(s) but no vehicle entrance — delivery vehicles have no drawn route in. Add a "veh_in" or "veh_both" gate, or they won't be able to reach their bays.`,
      cellCount: 0,
    });
  }

  return out;
}

export function generateSuggestions(project: Project): Suggestion[] {
  const stats = computeLayoutStats(project);
  return [...fromLint(project), ...fromStats(stats)].sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1));
}
