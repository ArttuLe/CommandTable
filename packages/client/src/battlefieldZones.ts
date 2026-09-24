import { isRedacted, type Card, type ProjectedObject } from '@command-table/common';

// Where a permanent sits on its owner's mat.
//
// Three bands, running from the board's outer edge inward toward the crossroads: lands in front
// of their owner, ongoing non-creature permanents behind the line, and creatures at the front
// where combat happens. Which physical direction "inward" is depends on the quadrant — that flip
// is CSS (see `.board.lands-bottom` in styles.css), not a second ordering here.
//
// All three bands are always drawn, even empty, so a permanent never jumps bands as a board
// fills up and every mat on the table lines up with every other.

export type ZoneKey = 'lands' | 'permanents' | 'creatures';

/** DOM order: outer edge first. `.board.lands-bottom` reverses it for the near half of the table. */
export const ZONES: { key: ZoneKey; label: string }[] = [
  { key: 'lands', label: 'Lands' },
  { key: 'permanents', label: 'Permanents' },
  { key: 'creatures', label: 'Creatures' },
];

export function zoneOf(typeLine: string | null): ZoneKey {
  if (!typeLine) return 'permanents';
  // Creature wins over land, so an Artifact Creature — or a Dryad Arbor — stands with the things
  // that can attack rather than with the things that make mana.
  if (typeLine.includes('Creature')) return 'creatures';
  if (typeLine.includes('Land')) return 'lands';
  return 'permanents';
}

export function groupByZone<T>(
  objects: readonly T[],
  getTypeLine: (obj: T) => string | null
): Record<ZoneKey, T[]> {
  const zones: Record<ZoneKey, T[]> = { lands: [], permanents: [], creatures: [] };
  for (const obj of objects) zones[zoneOf(getTypeLine(obj))].push(obj);
  return zones;
}

/** A token carries its own type line; everything else gets one from its looked-up card. */
export function typeLineOf(obj: ProjectedObject, card: Card | null): string | null {
  if (!isRedacted(obj) && obj.source.kind === 'token' && obj.source.adhoc) {
    return obj.source.adhoc.typeLine;
  }
  return card?.typeLine ?? null;
}

/** A card whose data hasn't arrived yet reads as not-a-creature until it does. */
export function isCreature(typeLine: string | null): boolean {
  return zoneOf(typeLine) === 'creatures';
}

/**
 * The power/toughness to print on a token's tile, or null for anything else.
 *
 * Tokens only, deliberately. `AdhocFace.power` was collected by the create-token dialog and then
 * never shown, so a board of 1/1s and 4/4s looked identical — that is the gap this fills. A real
 * card already prints its own P/T in the corner of its art, and repeating it in a badge only
 * covers up more of the card.
 *
 * Values stay verbatim rather than being parsed: `*`, `1+*` and `∞` are all printed P/T, and none
 * of them survive a trip through Number().
 */
export function powerToughness(obj: ProjectedObject): string | null {
  if (isRedacted(obj) || obj.source.kind !== 'token' || !obj.source.adhoc) return null;
  const { power, toughness } = obj.source.adhoc;
  return power !== undefined && toughness !== undefined ? `${power}/${toughness}` : null;
}
