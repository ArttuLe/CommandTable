import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const styles = readFileSync(new URL('./styles.css', import.meta.url), 'utf8');

/** Lines of styles.css matching `pattern`, as "line: text", so a failure says where to look. */
function offending(pattern: RegExp): string[] {
  return styles
    .split('\n')
    .map((text, i) => `${i + 1}: ${text.trim()}`)
    .filter((line) => pattern.test(line));
}

// A literal in styles.css is a colour a theme can't reach and a size the scale doesn't know about.
describe('styles.css takes its values from tokens.css', () => {
  it('has no colour literals', () => {
    expect(offending(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i)).toEqual([]);
  });

  it('has no rem font sizes', () => {
    expect(offending(/font-size: [0-9.]+rem/)).toEqual([]);
  });
});
