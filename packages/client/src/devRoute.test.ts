import { describe, expect, it } from 'vitest';
import { parseDevRoute } from './devRoute.js';

describe('parseDevRoute', () => {
  it('reads the seat count and the name out of the path', () => {
    expect(parseDevRoute('/devtest/4/Alice')).toEqual({ playerAmount: 4, playerName: 'Alice' });
    expect(parseDevRoute('/devtest/2/Bob/')).toEqual({ playerAmount: 2, playerName: 'Bob' });
  });

  it('decodes a name that had to be escaped', () => {
    expect(parseDevRoute('/devtest/3/Carol%20J')).toEqual({ playerAmount: 3, playerName: 'Carol J' });
  });

  it('ignores every other path', () => {
    expect(parseDevRoute('/')).toBeNull();
    expect(parseDevRoute('/devtest')).toBeNull();
    expect(parseDevRoute('/devtest/4')).toBeNull();
    expect(parseDevRoute('/devtest/4/')).toBeNull();
    expect(parseDevRoute('/devtest/4/Alice/extra')).toBeNull();
  });

  it('refuses a seat count no dev table comes in', () => {
    expect(parseDevRoute('/devtest/1/Alice')).toBeNull();
    expect(parseDevRoute('/devtest/5/Alice')).toBeNull();
  });
});
