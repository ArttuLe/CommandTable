// Decklist text parser, per design doc §6.1. Pure function: no network/DB access, so it's
// cheaply unit-testable and has no opinion on whether a resolved card exists.

import type { DeckLine, DeckSection, ParsedDecklist } from '@command-table/common';

const SECTION_HEADERS: Record<string, DeckSection> = {
  commander: 'commander',
  deck: 'deck',
  sideboard: 'sideboard',
  maybeboard: 'maybeboard',
};

// Bracketed tags, {tags}, #hashtags, and foil/etched markers like *F* and *E*.
const TRAILING_TAG = /\s*(\[[^\]]*\]|\{[^}]*\}|#\S+|\*[A-Za-z]+\*)\s*$/;
const SET_HINT = /^(.*\S)\s+\(([A-Za-z0-9]+)\)\s+(\S+)$/;
// "1 Sol Ring" or "1x Sol Ring"; a line with no count at all is read as one copy (below).
const LINE = /^(\d+)x?\s+(.+)$/i;

export function parseDecklist(text: string): ParsedDecklist {
  const lines: DeckLine[] = [];
  let section: DeckSection = 'deck';

  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('//')) {
      continue;
    }

    // "Sideboard", "SIDEBOARD:" and "Deck (99)" are all the same header in different exporters'
    // hands — and now that a line without a count is read as a card, an unrecognised header would be one.
    const headerSection = SECTION_HEADERS[trimmed.toLowerCase().replace(/\s*\(\d+\)$/, '').replace(/:$/, '')];
    if (headerSection) {
      section = headerSection;
      continue;
    }

    // Without a count, one copy: dropping the line silently hid it from the unresolved list too,
    // so a typo or an unfamiliar export form just made cards vanish from the deck.
    const match = LINE.exec(trimmed);
    const quantity = match ? Number.parseInt(match[1], 10) : 1;
    let rest = match ? match[2] : trimmed;

    while (TRAILING_TAG.test(rest)) {
      rest = rest.replace(TRAILING_TAG, '');
    }

    let name = rest;
    let set: string | null = null;
    let collectorNumber: string | null = null;
    const setMatch = SET_HINT.exec(rest);
    if (setMatch) {
      name = setMatch[1];
      set = setMatch[2];
      collectorNumber = setMatch[3];
    }

    lines.push({ quantity, name, set, collectorNumber, section });
  }

  return { lines };
}
