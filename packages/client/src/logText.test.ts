import { describe, expect, it } from 'vitest';
import { namedLogText } from './logText.js';

describe('namedLogText', () => {
  it('puts the card’s name where the line says which kind of thing it was', () => {
    expect(namedLogText('tapped a permanent', 'Sol Ring')).toBe('tapped Sol Ring');
    expect(namedLogText('moved a card to a graveyard', 'Sol Ring')).toBe('moved Sol Ring to a graveyard');
    expect(namedLogText("changed the '+1/+1' counter on a card", 'Zombie')).toBe("changed the '+1/+1' counter on Zombie");
  });

  // Only the subject: "a hand" and "a library" are the destination, and come after it.
  it('replaces only the first mention, and leaves a line with no name alone', () => {
    expect(namedLogText('moved a card to the top of a library', 'Ponder')).toBe('moved Ponder to the top of a library');
    expect(namedLogText('drew a card', null)).toBe('drew a card');
    expect(namedLogText('shuffled their library', 'Ponder')).toBe('shuffled their library');
  });
});
