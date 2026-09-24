import { describe, expect, it } from 'vitest';
import type { LogEntry } from '@command-table/common';
import { chatEntries, tableEntries } from './logStreams.js';

function entry(text: string, kind?: LogEntry['kind']): LogEntry {
  return {
    revision: 1,
    timestamp: 0,
    actorId: 'alice',
    text,
    visibility: { kind: 'all' },
    undoable: false,
    ...(kind ? { kind } : {}),
  };
}

const log = [entry('tapped a land'), entry('hello', 'chat'), entry('rolled a 4', 'random'), entry('hi back', 'chat')];

describe('log streams', () => {
  it('gives chat only the chat entries, in order', () => {
    expect(chatEntries(log).map((e) => e.text)).toEqual(['hello', 'hi back']);
  });

  it('keeps actions and random results out of chat and in the table stream', () => {
    expect(tableEntries(log).map((e) => e.text)).toEqual(['tapped a land', 'rolled a 4']);
  });

  it('partitions the log with nothing lost or duplicated', () => {
    expect(chatEntries(log).length + tableEntries(log).length).toBe(log.length);
  });
});
