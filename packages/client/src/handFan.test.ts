import { describe, expect, it } from 'vitest';
import { fanOverlap } from './handFan.js';

const CARD_W = 156;
const GAP = 4.8;
/** The width the HUD's middle column actually gives the hand at a 1440px window. */
const HUD_COLUMN = 1094;

/** What the hand measures, given the overlap the fan settled on. */
function totalWidth(count: number, overlap: number): number {
  return count * CARD_W + (count - 1) * GAP - (count - 1) * overlap * CARD_W;
}

/** The widest a hand of `count` can be asked to sit in before it has to overlap. */
function exactFit(count: number): number {
  return count * CARD_W + (count - 1) * GAP;
}

describe('fanOverlap', () => {
  it('leaves a hand that fits alone', () => {
    expect(fanOverlap(7, CARD_W, GAP, 2000)).toBe(0);
  });

  it('has nothing to overlap with at one card or none', () => {
    expect(fanOverlap(1, CARD_W, GAP, 100)).toBe(0);
    expect(fanOverlap(0, CARD_W, GAP, 100)).toBe(0);
  });

  it('fans an opening hand of seven, which the HUD is a shade too narrow for', () => {
    const overlap = fanOverlap(7, CARD_W, GAP, HUD_COLUMN);
    expect(overlap).toBeGreaterThan(0);
    expect(totalWidth(7, overlap)).toBeCloseTo(HUD_COLUMN);
  });

  // The boundary is the whole point of measuring: a hand one card past fitting should overlap by
  // a hair, not jump to some fixed fraction.
  it('crosses the boundary a hair at a time', () => {
    const room = exactFit(8);
    expect(fanOverlap(8, CARD_W, GAP, room)).toBe(0);
    const ninth = fanOverlap(9, CARD_W, GAP, room);
    expect(ninth).toBeGreaterThan(0);
    expect(ninth).toBeLessThan(0.2);
    expect(totalWidth(9, ninth)).toBeCloseTo(room);
  });

  it('treats a sub-pixel overflow as fitting, so the layout settles instead of hunting', () => {
    expect(fanOverlap(8, CARD_W, GAP, exactFit(8) - 0.5)).toBe(0);
  });

  it('tightens a big hand until it fits the space it was given', () => {
    const overlap = fanOverlap(20, CARD_W, GAP, 900);
    expect(overlap).toBeGreaterThan(0);
    expect(totalWidth(20, overlap)).toBeLessThanOrEqual(900);
  });

  it('stops at a readable sliver and overflows rather than vanishing', () => {
    expect(fanOverlap(60, CARD_W, GAP, 900)).toBe(0.88);
  });
});
