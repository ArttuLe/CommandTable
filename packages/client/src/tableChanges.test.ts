import { describe, expect, it } from 'vitest';
import type { ObjectId, ProjectedObject } from '@command-table/common';
import { changedObjectIds } from './tableChanges.js';

function obj(id: ObjectId, over: Partial<ProjectedObject> = {}): ProjectedObject {
  return {
    id,
    ownerId: 'p1',
    controllerId: 'p1',
    source: { kind: 'card', scryfallId: 's', oracleId: 'o' },
    zone: { playerId: 'p1', zone: 'battlefield' },
    position: 0,
    faceVisibility: { kind: 'all' },
    faceDown: false,
    currentFace: 0,
    tapped: false,
    flipped: false,
    counters: {},
    attachedTo: null,
    annotation: null,
    markers: [],
    ...over,
  } as ProjectedObject;
}

const mapOf = (objects: ProjectedObject[]) => Object.fromEntries(objects.map((o) => [o.id, o]));

describe('changedObjectIds', () => {
  it('finds nothing in identical projections', () => {
    const before = mapOf([obj('a'), obj('b')]);
    expect(changedObjectIds(before, mapOf([obj('a'), obj('b')]))).toEqual(new Set());
  });

  it('reports the one card that moved zone', () => {
    const before = mapOf([obj('a'), obj('b')]);
    const after = mapOf([obj('a', { zone: { playerId: 'p1', zone: 'graveyard' } }), obj('b')]);

    expect(changedObjectIds(before, after)).toEqual(new Set(['a']));
  });

  it('reports a tap', () => {
    expect(changedObjectIds(mapOf([obj('a')]), mapOf([obj('a', { tapped: true })]))).toEqual(new Set(['a']));
  });

  it('reports added and removed objects alike', () => {
    expect(changedObjectIds(mapOf([obj('gone')]), mapOf([obj('new')]))).toEqual(new Set(['gone', 'new']));
  });

  it('gives up once the whole board moved, rather than flashing all of it', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `c${i}`);
    const before = mapOf(ids.map((id) => obj(id)));
    const after = mapOf(ids.map((id) => obj(id, { tapped: true })));

    expect(changedObjectIds(before, after)).toEqual(new Set());
  });
});
