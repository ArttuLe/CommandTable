// Resolves a parsed decklist against the card index: warn, never block.

import type { Card, DeckLine, DeckWarningKind, ParsedDecklist, ResolvedDecklist, ResolvedDeckLine } from '@command-table/common';

export const EMPTY_RESOLVED_DECKLIST: ResolvedDecklist = {
  commanders: [],
  deck: [],
  sideboard: [],
  maybeboard: [],
  unresolved: [],
  warnings: [],
};

export interface CardLookup {
  findByName(name: string): Card | undefined;
  findByPrinting(name: string, set: string, collectorNumber: string): Card | undefined;
  suggestNames(query: string, limit: number): string[];
}

const EXPECTED_DECK_SIZE = 100;
const SUGGESTION_COUNT = 5;

const SECTION_TO_LIST = {
  commander: 'commanders',
  deck: 'deck',
  sideboard: 'sideboard',
  maybeboard: 'maybeboard',
} as const;

export function resolveDecklist(parsed: ParsedDecklist, lookup: CardLookup): ResolvedDecklist {
  const result: ResolvedDecklist = {
    commanders: [],
    deck: [],
    sideboard: [],
    maybeboard: [],
    unresolved: [],
    warnings: [],
  };

  for (const line of parsed.lines) {
    const card = line.set && line.collectorNumber
      ? lookup.findByPrinting(line.name, line.set, line.collectorNumber)
      : lookup.findByName(line.name);

    if (!card) {
      result.unresolved.push({ line, suggestions: lookup.suggestNames(line.name, SUGGESTION_COUNT) });
      continue;
    }

    const resolvedLine: ResolvedDeckLine = { line, card };
    result[SECTION_TO_LIST[line.section]].push(resolvedLine);
  }

  result.warnings.push(...deckSizeWarnings(parsed.lines));
  result.warnings.push(...duplicateNonbasicWarnings([...result.commanders, ...result.deck, ...result.sideboard, ...result.maybeboard]));
  result.warnings.push(...colorIdentityWarnings(result.commanders, [...result.deck, ...result.sideboard, ...result.maybeboard]));

  return result;
}

function deckSizeWarnings(lines: DeckLine[]): DeckWarningKind[] {
  const actual = lines
    .filter((l) => l.section === 'commander' || l.section === 'deck')
    .reduce((sum, l) => sum + l.quantity, 0);
  if (actual === EXPECTED_DECK_SIZE) {
    return [];
  }
  return [{ kind: 'wrong_deck_size', expected: EXPECTED_DECK_SIZE, actual }];
}

function duplicateNonbasicWarnings(resolvedLines: ResolvedDeckLine[]): DeckWarningKind[] {
  const counts = new Map<string, number>();
  for (const { line, card } of resolvedLines) {
    if (card.typeLine.includes('Basic')) {
      continue;
    }
    counts.set(card.name, (counts.get(card.name) ?? 0) + line.quantity);
  }
  const warnings: DeckWarningKind[] = [];
  for (const [name, count] of counts) {
    if (count > 1) {
      warnings.push({ kind: 'duplicate_nonbasic', name, count });
    }
  }
  return warnings;
}

function colorIdentityWarnings(commanders: ResolvedDeckLine[], others: ResolvedDeckLine[]): DeckWarningKind[] {
  if (commanders.length === 0) {
    return [];
  }
  const commanderIdentity: string[] = [];
  for (const { card } of commanders) {
    for (const color of card.colorIdentity) {
      if (!commanderIdentity.includes(color)) {
        commanderIdentity.push(color);
      }
    }
  }

  const warnings: DeckWarningKind[] = [];
  for (const { card } of others) {
    const outside = card.colorIdentity.some((c) => !commanderIdentity.includes(c));
    if (outside) {
      warnings.push({
        kind: 'color_identity_violation',
        name: card.name,
        cardIdentity: card.colorIdentity,
        commanderIdentity,
      });
    }
  }
  return warnings;
}
