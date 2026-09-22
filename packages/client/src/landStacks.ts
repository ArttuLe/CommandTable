import { isRedacted, type Card, type ProjectedObject } from '@command-table/common';

// Basics pile up. A ten-land board wrapped the lands band onto a second row and pushed the rest
// of the mat down, so identical basics are drawn as one overlapping stack instead of ten tiles
// side by side: a fan showing a sliver of each card, the way they'd sit squared up on a table.
//
// Only basics stack. Two Forests are interchangeable; two copies of a utility land usually are
// not (counters, attachments), so those keep a tile each.
//
// Tapped and untapped never share a stack — a stack is also how you read off available mana.

const BASIC_LAND_NAMES = new Set(['Plains', 'Island', 'Swamp', 'Mountain', 'Forest', 'Wastes']);

export interface StackInfo {
  name: string | null;
  tapped: boolean;
}

export interface LandStack<T> {
  key: string;
  tapped: boolean;
  objects: T[];
}

export function isBasicLandName(name: string | null): boolean {
  if (!name) return false;
  return BASIC_LAND_NAMES.has(name.replace(/^Snow-Covered /, ''));
}

/** Groups identical basics, leaving everything else a stack of one. First-appearance order. */
export function stackLands<T>(lands: readonly T[], infoOf: (obj: T) => StackInfo): LandStack<T>[] {
  const stacks: LandStack<T>[] = [];
  const byKey = new Map<string, LandStack<T>>();

  lands.forEach((obj, i) => {
    const { name, tapped } = infoOf(obj);
    const key = isBasicLandName(name) ? `${name}:${tapped}` : `solo:${i}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.objects.push(obj);
      return;
    }
    const stack: LandStack<T> = { key, tapped, objects: [obj] };
    byKey.set(key, stack);
    stacks.push(stack);
  });

  return stacks;
}

/** A token carries its own name; a face-down land has none to share, so it never stacks. */
export function stackNameOf(obj: ProjectedObject, card: Card | null): string | null {
  if (isRedacted(obj)) return null;
  if (obj.source.kind === 'token' && obj.source.adhoc) return obj.source.adhoc.name;
  return card?.name ?? null;
}
