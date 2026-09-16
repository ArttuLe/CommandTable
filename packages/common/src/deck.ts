// Decklist import, per design doc §6. Parsing is separate from resolution against the card index:
// the parser never touches network/DB, so it stays trivially unit-testable (§18).

export type DeckSection = 'commander' | 'deck' | 'sideboard' | 'maybeboard';

export interface DeckLine {
  quantity: number;
  name: string;
  set: string | null;
  collectorNumber: string | null;
  section: DeckSection;
}

export interface ParsedDecklist {
  lines: DeckLine[];
}

export type DeckWarningKind =
  | { kind: 'wrong_deck_size'; expected: number; actual: number }
  | { kind: 'duplicate_nonbasic'; name: string; count: number }
  | { kind: 'color_identity_violation'; name: string; cardIdentity: string[]; commanderIdentity: string[] };

export interface UnresolvedLine {
  line: DeckLine;
  suggestions: string[];
}

export interface ResolvedDeckLine {
  line: DeckLine;
  card: import('./card.js').Card;
}

export interface ResolvedDecklist {
  commanders: ResolvedDeckLine[];
  deck: ResolvedDeckLine[];
  sideboard: ResolvedDeckLine[];
  maybeboard: ResolvedDeckLine[];
  unresolved: UnresolvedLine[];
  warnings: DeckWarningKind[];
}
