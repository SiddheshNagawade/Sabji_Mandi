# Mandi Flow Simulator

A 2D grid-based tool for designing and comparing Sabji Mandi (local vegetable
market) layouts: draw the market, run a crowd + vehicle simulation, and see
the effect on both shopper experience and seller footfall.

See `SPEC.md` for the full product/engineering spec this project is built
against. It is being built milestone by milestone (M0–M8); current status is
tracked in the spec's section 3 and in commit history.

## Stack

Vite + React 18 + TypeScript (strict), Zustand, Canvas 2D, Web Workers for
the simulation, Vitest for tests, Tailwind CSS for chrome. No backend —
everything runs client-side; projects save to/load from a `.mandi.json`
file, with autosave to IndexedDB.

## Development

```bash
npm install
npm run dev      # start the dev server
npm run test     # run the Vitest suite
npm run build    # typecheck + production build
```

## Honesty rules

Every parameter is tagged `measured`, `assumed`, or `literature`. Until a
baseline is validated against field data, every results screen shows an
"illustrative, not validated" banner. The tool compares layouts under
stated assumptions — it does not predict real-world percentages, spoilage,
or rupee outcomes.
