import { describe, expect, it } from 'vitest';
import { DEMO_MARKETS } from '../../src/data/demoProjects';
import { computeLintWarnings } from '../../src/editor/layoutLinter';

describe('demo markets', () => {
  for (const demo of DEMO_MARKETS) {
    it(`${demo.name} is lint-clean`, () => {
      const project = demo.build();
      const warnings = computeLintWarnings(project.baseline, project.grid.width, project.grid.height);
      const errors = warnings.filter((w) => w.severity === 'error');
      if (errors.length > 0) {
        console.log(`${demo.name} errors:`, errors.map((e) => e.message));
      }
      expect(errors).toEqual([]);
    });
  }
});
