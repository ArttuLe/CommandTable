import { describe, expect, it } from 'vitest';
import { blockMarker, targetMarker, type ProjectedObject } from '@command-table/common';
import {
  ATTACKING_MARKER,
  blocksOf,
  combatRelations,
  isAttacking,
  isLabelMarker,
  isSummoningSick,
} from './combat.js';

const ME = 'me';
const obj = (id: string, markers: string[], controllerId = ME) =>
  ({ id, markers, controllerId }) as unknown as ProjectedObject;
const table = (...objects: ProjectedObject[]) => Object.fromEntries(objects.map((o) => [o.id, o]));

describe('isAttacking', () => {
  it('reads the marker the attack toggle writes', () => {
    expect(isAttacking({ markers: [ATTACKING_MARKER] })).toBe(true);
  });

  it('is false for a creature carrying other markers only', () => {
    expect(isAttacking({ markers: ['goaded'] })).toBe(false);
    expect(isAttacking({ markers: [] })).toBe(false);
  });
});

describe('isSummoningSick', () => {
  it('reads the marker the server sets on arrival', () => {
    expect(isSummoningSick({ markers: ['summoning-sick'] })).toBe(true);
    expect(isSummoningSick({ markers: ['flying'] })).toBe(false);
  });
});

describe('blocksOf', () => {
  it('reads every attacker a creature has been declared against', () => {
    expect(blocksOf(obj('b', [blockMarker('a1'), 'flying', blockMarker('a2')]))).toEqual(['a1', 'a2']);
  });

  it('is empty for a creature that is not blocking', () => {
    expect(blocksOf(obj('b', ['flying']))).toEqual([]);
  });
});

describe('combatRelations', () => {
  it('turns block and target markers into directed arrows', () => {
    const state = table(
      obj('a1', [ATTACKING_MARKER]),
      obj('b1', [blockMarker('a1')]),
      obj('spell', [targetMarker('a1')])
    );

    expect(combatRelations(state, ME)).toEqual([
      { kind: 'block', fromId: 'b1', toId: 'a1', mine: true },
      { kind: 'target', fromId: 'spell', toId: 'a1', mine: true },
    ]);
  });

  it("marks an arrow starting on someone else's board, which is what colours it", () => {
    const state = table(obj('a1', [ATTACKING_MARKER]), obj('b1', [blockMarker('a1')], 'them'));
    expect(combatRelations(state, ME)).toEqual([{ kind: 'block', fromId: 'b1', toId: 'a1', mine: false }]);
  });

  it('drops an arrow whose other end has left the table', () => {
    // The blocked creature died; the arrow has nowhere to point.
    expect(combatRelations(table(obj('b1', [blockMarker('gone')])), ME)).toEqual([]);
  });

  it('finds nothing in a table with no combat', () => {
    expect(combatRelations(table(obj('c', ['flying'])), ME)).toEqual([]);
  });
});

describe('isLabelMarker', () => {
  it('keeps the labels a player typed', () => {
    expect(isLabelMarker('flying')).toBe(true);
    expect(isLabelMarker('monarch')).toBe(true);
  });

  it('hides everything that is drawn some other way', () => {
    expect(isLabelMarker(ATTACKING_MARKER)).toBe(false);
    expect(isLabelMarker('summoning-sick')).toBe(false);
    expect(isLabelMarker(blockMarker('a'))).toBe(false);
    expect(isLabelMarker(targetMarker('a'))).toBe(false);
  });
});
