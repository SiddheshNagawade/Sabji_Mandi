// Counts parameters by provenance tag (SPEC.md section 1.4 rule 1: "Results
// panels show how many of the parameters behind a run are assumed").

import type { Param, Project, ProvenanceTag } from './schema';

function isParam(v: unknown): v is Param<unknown> {
  return typeof v === 'object' && v !== null && 'value' in v && 'source' in v;
}

export function countProvenance(project: Project): Record<ProvenanceTag, number> {
  const counts: Record<ProvenanceTag, number> = { measured: 0, assumed: 0, literature: 0 };
  const seen = new Set<unknown>();

  function visit(v: unknown, depth: number) {
    if (v == null || depth > 6 || typeof v !== 'object') return;
    if (seen.has(v)) return;
    if (ArrayBuffer.isView(v)) return; // typed arrays: not parameters
    seen.add(v);
    if (isParam(v)) {
      counts[v.source]++;
      return; // a Param's own internal fields (value/unit/note) aren't sub-params
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item, depth + 1);
      return;
    }
    for (const key of Object.keys(v)) {
      visit((v as Record<string, unknown>)[key], depth + 1);
    }
  }

  visit(project.grid, 0);
  visit(project.demand, 0);
  visit(project.params, 0);
  visit(project.baseline.objects, 0);
  visit(project.calibration.toleranceFrac, 0);

  return counts;
}
