import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// A component `Foo.tsx` beside its pure module `foo.ts` is an easy pair to name, and macOS's
// filesystem ignores case: `./Foo.js` then opens `foo.ts`, and the table never loads. Linux sees
// two files and never notices, so this checks it everywhere.
describe('client source file names', () => {
  it('never differ from each other only in casing', () => {
    const stems = readdirSync(new URL('.', import.meta.url))
      .filter((file) => /\.tsx?$/.test(file))
      .map((file) => file.replace(/\.tsx?$/, ''));
    const clashes = stems.filter((stem, i) => stems.findIndex((other) => other.toLowerCase() === stem.toLowerCase()) !== i);
    expect(clashes).toEqual([]);
  });
});
