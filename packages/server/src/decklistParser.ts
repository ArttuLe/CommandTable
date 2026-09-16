// Decklist text parser, per design doc §6.1. Pure function: no network/DB access, so it's
// cheaply unit-testable and has no opinion on whether a resolved card exists.

import type { DeckLine, DeckSection, ParsedDecklist } from '@command-table/common';

const SECTION_HEADERS: Record<string, DeckSection> = {
  commander: 'commander',
  deck: 'deck',
  sideboard: 'sideboard',
  maybeboard: 'maybeboard',
};

const TRAILING_TAG = /\s*(\[[^\]]*\]|\{[^}]*\}|#\S+)\s*$/;
const SET_HINT = /^(.*\S)\s+\(([A-Za-z0-9]+)\)\s+(\S+)$/;
const LINE = /^(\d+)\s+(.+)$/;

export function parseDecklist(text: string): ParsedDecklist {
  const lines: DeckLine[] = [];
  let section: DeckSection = 'deck';

  for (const rawLine of text.split('\n')) {
    const trimmed = rawLine.trim();
    if (trimmed === '' || trimmed.startsWith('//')) {
      continue;
    }

    const headerSection = SECTION_HEADERS[trimmed.toLowerCase()];
    if (headerSection) {
      section = headerSection;
      continue;
    }

    const match = LINE.exec(trimmed);
    if (!match) {
      continue;
    }
    const quantity = Number.parseInt(match[1], 10);
    let rest = match[2];

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
