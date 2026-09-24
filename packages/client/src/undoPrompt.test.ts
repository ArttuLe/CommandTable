import { describe, expect, it } from 'vitest';
import { undoPromptText } from './undoPrompt.js';

const players = [
  { id: 'a', displayName: 'Alice' },
  { id: 'b', displayName: 'Bob' },
];

const log = [
  { revision: 41, actorId: 'a', text: 'drew a card' },
  { revision: 42, actorId: 'b', text: 'moved Sol Ring to graveyard' },
];

const request = { requesterId: 'a', targetRevision: 41, describes: 'revert the table to revision 41' };

describe('undoPromptText', () => {
  it('names the action the target revision undoes, and who asked', () => {
    expect(undoPromptText(request, log, players)).toBe('Alice wants to undo: Bob moved Sol Ring to graveyard.');
  });

  it("falls back to the server's wording when the entry isn't in this client's log", () => {
    expect(undoPromptText({ requesterId: 'a', targetRevision: 7, describes: 'revert the table to revision 7' }, log, players)).toBe(
      'Alice wants to undo: revert the table to revision 7.'
    );
  });

  it('says it plainly when you are undoing your own action', () => {
    expect(undoPromptText({ ...request, targetRevision: 40 }, log, players)).toBe(
      'Alice wants to undo: Alice drew a card.'
    );
  });

  it('prints an unrecognised actor verbatim, as the log rail does', () => {
    const systemLog = [{ revision: 41, actorId: 'Table', text: 'shuffled every library' }];
    expect(undoPromptText({ ...request, targetRevision: 40 }, systemLog, players)).toBe('Alice wants to undo: Table shuffled every library.');
  });
});
