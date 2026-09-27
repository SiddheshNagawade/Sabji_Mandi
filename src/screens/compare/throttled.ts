/** Drops calls closer together than `ms`, so a fast stream of worker messages doesn't flood React with renders. */
export function throttled<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: Parameters<T>) => {
    const now = performance.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  }) as T;
}
