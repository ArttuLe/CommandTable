// Fisher-Yates shuffle. `randomInt` is injected so callers supply
// crypto.randomInt in production and a deterministic stub in tests.

export function fisherYatesShuffle<T>(items: T[], randomInt: (exclusiveMax: number) => number): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
