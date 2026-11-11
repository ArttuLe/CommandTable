import { describe, expect, it } from 'vitest';
import { undoableText, undoOutcomeText, undoPromptText, undoTallyText } from './undoPrompt.js';

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

  // The requester used to see nothing at all while the table voted on their request.
  it('tells the requester the table is deciding, rather than asking them to vote', () => {
    expect(undoPromptText(request, log, players, 'a')).toBe(
      'Waiting for the table to approve your undo: Bob moved Sol Ring to graveyard.'
    );
  });

  it('prints an unrecognised actor verbatim, as the log rail does', () => {
    const systemLog = [{ revision: 41, actorId: 'Table', text: 'shuffled every library' }];
    expect(undoPromptText({ ...request, targetRevision: 40 }, systemLog, players)).toBe('Alice wants to undo: Table shuffled every library.');
  });
});

describe('undoPromptText with a named card', () => {
  // "Bob wants to undo: Alice tapped a permanent" couldn't be voted on in good conscience.
  it('names the card the undone line is about', () => {
    const tapLog = [{ revision: 42, actorId: 'b', text: 'tapped a permanent' }];
    expect(undoPromptText(request, tapLog, players, 'b', 'Sol Ring')).toBe('Alice wants to undo: Bob tapped Sol Ring.');
  });
});

describe('undoTallyText', () => {
  it('counts approvals against the majority the server needs', () => {
    expect(undoTallyText({ approvals: 1, needed: 2 })).toBe('1 of 2 approvals');
    expect(undoTallyText({ approvals: 1, needed: 1 })).toBe('1 of 1 approval');
  });
});

// A rejection used to clear the bar and say nothing, so nobody could tell a "no" from a glitch.
describe('undoOutcomeText', () => {
  it('announces every way a vote can end, to the requester and to everyone else', () => {
    expect(undoOutcomeText('rejected', request, players, 'b')).toBe('The table turned down Alice’s undo.');
    expect(undoOutcomeText('rejected', request, players, 'a')).toBe('The table turned down your undo.');
    expect(undoOutcomeText('applied', request, players, 'b')).toBe('The table approved Alice’s undo.');
    expect(undoOutcomeText('cancelled', request, players, 'a')).toBe(
      'Your undo was called off: someone acted before the vote finished.'
    );
    expect(undoOutcomeText('cancelled', request, players, 'b')).toBe(
      'Alice’s undo was called off: someone acted before the vote finished.'
    );
  });
});

// Undo used to be a bare button, so a misclick followed by anyone else's action turned it into a
// vote on *their* action without a word.
describe('undoableText', () => {
  it('names the action Undo would take back, and whose it is', () => {
    expect(undoableText({ revision: 42, actorId: 'b' }, log, players, 'a')).toBe('Bob moved Sol Ring to graveyard');
  });

  it('calls your own action yours', () => {
    expect(undoableText({ revision: 41, actorId: 'a' }, log, players, 'a')).toBe('you drew a card');
  });

  it('names the card the line is about', () => {
    const tapLog = [{ revision: 42, actorId: 'b', text: 'tapped a permanent' }];
    expect(undoableText({ revision: 42, actorId: 'b' }, tapLog, players, 'a', 'Sol Ring')).toBe('Bob tapped Sol Ring');
  });

  // A client that joined late may not hold the line; it still knows whose action it is.
  it("falls back to whose action it is when the line isn't in this client's log", () => {
    expect(undoableText({ revision: 7, actorId: 'b' }, log, players, 'a')).toBe('Bob’s last action');
    expect(undoableText({ revision: 7, actorId: 'a' }, log, players, 'a')).toBe('your last action');
  });
});
