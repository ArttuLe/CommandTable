import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

type Rgb = [number, number, number];

/** The custom properties declared in the first block whose selector is `selector`. */
function block(selector: string): Record<string, string> {
  const start = tokens.indexOf(`${selector} {`);
  const body = tokens.slice(start, tokens.indexOf('\n}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

/** A token's colour, following var() and `color-mix(in srgb, A p%, B)` the way the browser does. */
function resolve(value: string, vars: Record<string, string>): Rgb {
  const hex = value.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    const full = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as Rgb;
  }
  if (value === 'black') return [0, 0, 0];
  const ref = value.match(/^var\(--([\w-]+)\)$/);
  if (ref) return resolve(vars[ref[1]], vars);
  const mix = value.match(/^color-mix\(in srgb, (.+) (\d+)%, (.+)\)$/);
  if (mix) {
    const [a, p, b] = [resolve(mix[1], vars), Number(mix[2]) / 100, resolve(mix[3], vars)];
    return a.map((c, i) => c * p + b[i] * (1 - p)) as Rgb;
  }
  throw new Error(`can't resolve ${value}`);
}

/** WCAG 2 contrast ratio. */
function contrast(a: Rgb, b: Rgb): number {
  const luminance = (rgb: Rgb) => {
    const [r, g, b] = rgb.map((c) => (c / 255 <= 0.03928 ? c / 255 / 12.92 : ((c / 255 + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const root = block(':root');
const themes = ['C', 'W', 'U', 'B', 'R', 'G'].map((t) => [t, t === 'C' ? root : { ...root, ...block(`:root[data-theme='${t}']`) }] as const);

// Text a player must read, on the surfaces it sits on, at WCAG AA for body text.
const PAIRS = [
  ['text', 'surface'],
  ['text-dim', 'surface'],
  ['text-dim', 'surface-raised'],
  ['text-dim', 'bg'],
  ['text-strong', 'accent-strong'],
  ['text-strong', 'turn-strong'],
] as const;

describe('every theme keeps its text readable', () => {
  for (const [theme, vars] of themes) {
    it.each(PAIRS)(`${theme}: --%s on --%s`, (fg, bg) => {
      expect(contrast(resolve(`var(--${fg})`, vars), resolve(`var(--${bg})`, vars))).toBeGreaterThanOrEqual(4.5);
    });
  }
});
