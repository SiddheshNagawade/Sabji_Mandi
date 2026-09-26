// Deterministic RNG and sampling helpers. SPEC.md section 9.10: a single
// seeded RNG per run, so the same project+scenario+seed reproduces exactly.

export type Rng = () => number;

/** mulberry32 — small, fast, good-enough statistical quality for a sim. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

export function randInt(rng: Rng, min: number, maxInclusive: number): number {
  return Math.floor(randRange(rng, min, maxInclusive + 1));
}

/** Knuth's algorithm; fine for the small lambda values arrival rates use. */
export function poissonSample(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}

export function normalSample(rng: Rng, mean: number, sigma: number): number {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + sigma * z0;
}

/** median = exp(mu), so mu = ln(median). sigma is the log-space spread. */
export function lognormalSample(rng: Rng, median: number, sigma: number): number {
  const mu = Math.log(Math.max(median, 1e-6));
  return Math.exp(normalSample(rng, mu, sigma));
}

export function shuffledIndices(n: number, rng: Rng): number[] {
  const arr = new Array<number>(n);
  for (let i = 0; i < n; i++) arr[i] = i;
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function softmaxPick<T>(rng: Rng, items: T[], utilities: number[], temperature: number): T {
  const t = Math.max(temperature, 1e-3);
  const max = Math.max(...utilities);
  const weights = utilities.map((u) => Math.exp((u - max) / t));
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = rng() * sum;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}
