import { describe, expect, it } from 'vitest';
import { parseDecklist } from './decklistParser.js';

describe('parseDecklist', () => {
  it('parses a commander section and a deck section', () => {
    const result = parseDecklist(`
Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring
1 Command Tower
`);

    expect(result.lines).toEqual([
      { quantity: 1, name: "Atraxa, Praetors' Voice", set: null, collectorNumber: null, section: 'commander' },
      { quantity: 1, name: 'Sol Ring', set: null, collectorNumber: null, section: 'deck' },
      { quantity: 1, name: 'Command Tower', set: null, collectorNumber: null, section: 'deck' },
    ]);
  });

  it('recognizes section headers case-insensitively', () => {
    const result = parseDecklist(`
commander
1 Atraxa, Praetors' Voice

DECK
1 Sol Ring

SideBoard
1 Swords to Plowshares

maybeboard
1 Rhystic Study
`);

    expect(result.lines.map((l) => l.section)).toEqual(['commander', 'deck', 'sideboard', 'maybeboard']);
  });

  it('parses set/collector-number hints when present', () => {
    const result = parseDecklist(`Deck\n1 Sol Ring (LTC) 284`);
    expect(result.lines[0]).toEqual({
      quantity: 1,
      name: 'Sol Ring',
      set: 'LTC',
      collectorNumber: '284',
      section: 'deck',
    });
  });

  it('falls back to no set hint when absent', () => {
    const result = parseDecklist(`Deck\n1 Sol Ring`);
    expect(result.lines[0].set).toBeNull();
    expect(result.lines[0].collectorNumber).toBeNull();
  });

  it('ignores blank lines and // comments', () => {
    const result = parseDecklist(`
Deck
// this is a comment
1 Sol Ring

1 Command Tower
`);
    expect(result.lines).toHaveLength(2);
  });

  it('ignores category tags emitted by some exporters', () => {
    const result = parseDecklist(`Deck\n1 Sol Ring [ART] {tag}`);
    expect(result.lines[0].name).toBe('Sol Ring');
  });

  it('handles multi-digit quantities', () => {
    const result = parseDecklist(`Deck\n12 Plains`);
    expect(result.lines[0].quantity).toBe(12);
  });

  it('treats lines before any section header as belonging to the deck section', () => {
    const result = parseDecklist(`1 Sol Ring`);
    expect(result.lines[0].section).toBe('deck');
  });

  it('handles card names containing slashes and quotes', () => {
    const result = parseDecklist(`Deck\n1 Fire // Ice\n1 Kongming, "Sleeping Dragon"`);
    expect(result.lines.map((l) => l.name)).toEqual(['Fire // Ice', 'Kongming, "Sleeping Dragon"']);
  });

  it('returns an empty line list for empty input', () => {
    expect(parseDecklist('').lines).toEqual([]);
  });
});

describe('parseDecklist: export forms that used to vanish', () => {
  // "1x Sol Ring" didn't match the line pattern and was skipped without a word — not even as an
  // unresolved line — so a whole "1x" export imported as an empty deck.
  it('reads an "x" after the count', () => {
    expect(parseDecklist('1x Sol Ring\n2X Island').lines.map((l) => [l.quantity, l.name])).toEqual([
      [1, 'Sol Ring'],
      [2, 'Island'],
    ]);
  });

  // A foil or etched marker after the set hint made the whole tail part of the name.
  it('drops a foil or etched marker, keeping the set hint before it', () => {
    expect(parseDecklist('1 Sol Ring (LTC) 284 *F*').lines[0]).toMatchObject({ name: 'Sol Ring', set: 'LTC', collectorNumber: '284' });
  });

  // A line with no count at all is still a card someone meant to list: one of it, and if the name
  // is wrong it surfaces as unresolved instead of disappearing.
  it('reads a line without a count as one copy', () => {
    expect(parseDecklist('Sol Ring').lines[0]).toMatchObject({ quantity: 1, name: 'Sol Ring' });
  });
});

describe('parseDecklist: section headers as exporters write them', () => {
  it('reads a header with a trailing colon or a count', () => {
    const lines = parseDecklist('Commander (1)\n1 Korvold\nDeck (99)\n1 Sol Ring\nSIDEBOARD:\n1 Swords').lines;
    expect(lines.map((l) => [l.section, l.name])).toEqual([
      ['commander', 'Korvold'],
      ['deck', 'Sol Ring'],
      ['sideboard', 'Swords'],
    ]);
  });
});
