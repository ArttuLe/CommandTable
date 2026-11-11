// What the table is being asked to approve, in the words the log already used.
//
// The server describes a pending undo as "revert the table to revision 41" — a database concept
// on a card table. Every log entry is visible to everyone (actionApplier defaults visibility to
// all), so each client already holds the line for the action being reverted and can name it
// itself; that keeps the projection boundary out of it. What the client can't work out alone is
// which action its own Undo would take back — after a revert that isn't the newest line — so
// the server says that much with each state (`undoable`, see tableHistory.ts).

import type { LogEntry, PlayerId, UndoableAction } from '@command-table/common';
import { namedLogText } from './logText.js';

type Named = { id: PlayerId; displayName: string };

/**
 * A revision is the table *after* an action, so the action being undone is the one that produced
 * `targetRevision + 1`. Falls back to the server's own wording when that entry isn't in the log
 * — an undo can reach further back than a client that joined late can see.
 */
export function undoPromptText(
  request: { requesterId: PlayerId; targetRevision: number; describes: string },
  log: readonly Pick<LogEntry, 'revision' | 'actorId' | 'text'>[],
  players: readonly Named[],
  myId?: PlayerId,
  /** The name the undone line's card resolved to, if it has one (see logText.ts). */
  subjectName: string | null = null
): string {
  const name = (id: PlayerId) => players.find((p) => p.id === id)?.displayName ?? id;
  const entry = undoneEntry(request, log);
  const what = entry ? `${name(entry.actorId)} ${namedLogText(entry.text, subjectName)}` : request.describes;
  // The requester's own approval is already counted, so there is nothing for them to vote on.
  if (request.requesterId === myId) return `Waiting for the table to approve your undo: ${what}.`;
  return `${name(request.requesterId)} wants to undo: ${what}.`;
}

/**
 * What Undo would take back, for the button and the question before a vote: "Bob drew a card".
 * Falls back to whose action it is when this client's log doesn't hold the line.
 */
export function undoableText(
  undoable: UndoableAction,
  log: readonly Pick<LogEntry, 'revision' | 'text'>[],
  players: readonly Named[],
  myId: PlayerId,
  /** The name the undone line's card resolved to, if it has one (see logText.ts). */
  subjectName: string | null = null
): string {
  const mine = undoable.actorId === myId;
  const name = players.find((p) => p.id === undoable.actorId)?.displayName ?? undoable.actorId;
  const entry = log.find((e) => e.revision === undoable.revision);
  if (!entry) return mine ? 'your last action' : `${name}’s last action`;
  return `${mine ? 'you' : name} ${namedLogText(entry.text, subjectName)}`;
}

/** The log line a vote would undo: a revision is the table *after* an action. */
export function undoneEntry<E extends Pick<LogEntry, 'revision'>>(request: { targetRevision: number }, log: readonly E[]): E | undefined {
  return log.find((e) => e.revision === request.targetRevision + 1);
}

/** How far a vote has got, against the majority the server is waiting for. */
export function undoTallyText({ approvals, needed }: { approvals: number; needed: number }): string {
  return `${approvals} of ${needed} approval${needed === 1 ? '' : 's'}`;
}

/**
 * How a vote ended, said once to everyone. A rejection used to clear the bar silently, so nobody
 * could tell a "no" from a glitch — least of all the requester, who was never shown the vote.
 */
export function undoOutcomeText(
  outcome: 'applied' | 'rejected' | 'cancelled',
  request: { requesterId: PlayerId },
  players: readonly Named[],
  myId: PlayerId | null
): string {
  const mine = request.requesterId === myId;
  const whose = mine ? 'your' : `${players.find((p) => p.id === request.requesterId)?.displayName ?? request.requesterId}’s`;
  switch (outcome) {
    case 'applied':
      return `The table approved ${whose} undo.`;
    case 'rejected':
      return `The table turned down ${whose} undo.`;
    case 'cancelled':
      return `${mine ? 'Your' : whose} undo was called off: someone acted before the vote finished.`;
  }
}
