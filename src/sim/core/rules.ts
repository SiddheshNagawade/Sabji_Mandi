// Time-of-day rules: phases, barriers and arrow groups (SPEC.md sections
// 6.3, 7.7, 9.2 "invalidateFlowFields(w)"). A project with no phases behaves
// exactly as it did before M4: barriers always block, every arrow group is
// always enforced — phases only start restricting things once the user
// actually draws a timeline.

import type { Barrier, Entrance, Layout, Phase } from '../../data/schema';
import { TileId } from '../../data/schema';
import { idx, inBounds } from './walkable';

export function getActivePhase(layout: Layout, tSimSeconds: number): Phase | null {
  if (layout.phases.length === 0) return null;
  return layout.phases.find((p) => tSimSeconds >= p.startS && tSimSeconds < p.endS) ?? null;
}

export function isBarrierActive(barrierId: number, layout: Layout, activePhase: Phase | null): boolean {
  if (layout.phases.length === 0) return true; // no timeline configured: static obstacle
  return activePhase != null && activePhase.activeBarrierIds.includes(barrierId);
}

export function isArrowGroupActive(groupId: number, layout: Layout, activePhase: Phase | null): boolean {
  if (groupId === 0) return true; // ungrouped arrows are always enforced
  if (layout.phases.length === 0) return true;
  return activePhase != null && activePhase.activeArrowGroupIds.includes(groupId);
}

/** No schedule means always open (backward compatible with pre-M4 projects). */
export function isEntranceOpenNow(entrance: Entrance, tSimSeconds: number): boolean {
  if (!entrance.schedule || entrance.schedule.length === 0) return true;
  return entrance.schedule.some((w) => tSimSeconds >= w.startS && tSimSeconds < w.endS);
}

export function vehiclesAllowedNow(layout: Layout, activePhase: Phase | null): boolean {
  if (layout.phases.length === 0) return true;
  return activePhase?.vehiclesAllowed ?? false;
}

export interface ResolvedPhaseState {
  terrain: Uint8Array;
  flow: Uint8Array;
  /** true when this differs from the layout's static arrays and needed a fresh copy. */
  changed: boolean;
}

/**
 * Builds the terrain/flow arrays movement should actually see for the given
 * phase: inactive barriers open back up to open ground, and flow cells whose
 * arrow group isn't active this phase stop being enforced. Cheap early exit
 * (returns the layout's own arrays, no copy) when there is nothing dynamic
 * to resolve — which is every project until it uses barriers or arrow
 * groups, keeping M1-M3 projects at their original performance.
 */
export function resolvePhaseState(layout: Layout, width: number, height: number, activePhase: Phase | null): ResolvedPhaseState {
  const barriers = layout.objects.filter((o): o is Barrier => o.kind === 'barrier');
  const hasArrowGroups = layout.arrowGroups.length > 0 && layout.flowGroup.some((g) => g !== 0);

  if (barriers.length === 0 && !hasArrowGroups) {
    return { terrain: layout.terrain, flow: layout.flow, changed: false };
  }

  let terrain = layout.terrain;
  if (barriers.length > 0) {
    terrain = layout.terrain.slice();
    for (const b of barriers) {
      if (isBarrierActive(b.id, layout, activePhase)) continue;
      for (const c of b.cells) {
        if (!inBounds(c.x, c.y, width, height)) continue;
        const i = idx(c.x, c.y, width);
        if (terrain[i] === TileId.Barrier) terrain[i] = TileId.OpenGround;
      }
    }
  }

  let flow = layout.flow;
  if (hasArrowGroups) {
    flow = layout.flow.slice();
    for (let i = 0; i < flow.length; i++) {
      const group = layout.flowGroup[i];
      if (group !== 0 && !isArrowGroupActive(group, layout, activePhase)) flow[i] = 0;
    }
  }

  return { terrain, flow, changed: true };
}
