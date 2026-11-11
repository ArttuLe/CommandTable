import { describe, expect, it } from 'vitest';
import { setupStatus } from './setupStatus.js';

const base = { handCount: 7, mulligans: 0, kept: false, isHost: false, deciding: ['Alice', 'Bob'] };

describe('setupStatus', () => {
  it('asks you to judge the hand before any mulligan', () => {
    expect(setupStatus(base).note).toBe('Mulligan until you like your 7 cards, then keep.');
  });

  it('the first mulligan is free: keep all seven', () => {
    expect(setupStatus({ ...base, mulligans: 1 }).note).toBe('Mulligan 1 is free: keep all 7, or mulligan again.');
  });

  it('after two mulligans, says to bottom one card and how', () => {
    expect(setupStatus({ ...base, mulligans: 2 }).note).toBe(
      'Mulligan 2: put 1 card on the bottom — right-click it and choose Bottom.'
    );
  });

  it('after three mulligans, says to bottom two cards', () => {
    expect(setupStatus({ ...base, mulligans: 3 }).note).toBe(
      'Mulligan 3: put 2 cards on the bottom — right-click each and choose Bottom.'
    );
  });

  it('says nothing about your decision until you keep', () => {
    expect(setupStatus(base).kept).toBeNull();
  });

  it('tells a non-host who kept that the host starts the game', () => {
    expect(setupStatus({ ...base, kept: true }).kept).toBe('You kept — waiting for the host to start the game.');
  });

  it('tells the host only that they kept: the start button is theirs', () => {
    expect(setupStatus({ ...base, kept: true, isHost: true }).kept).toBe('You kept.');
  });

  it('names who is still deciding, then says when everyone has kept', () => {
    expect(setupStatus(base).waiting).toBe('Still deciding: Alice, Bob');
    expect(setupStatus({ ...base, kept: true, deciding: [] }).waiting).toBe('Everyone has kept.');
  });
});
