// What the table is being asked to approve, in the words the log already used.
//
// The server describes a pending undo as "revert the table to revision 41" — a database concept
// on a card table. Every log entry is visible to everyone (actionApplier defaults visibility to
// all), so each client already holds the line for the action being reverted and can name it
// itself; that keeps the projection boundary out of it and needs no protocol change.

import type { LogEntry, PlayerId } from '@command-table/common';

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
  myId?: PlayerId
): string {
  const name = (id: PlayerId) => players.find((p) => p.id === id)?.displayName ?? id;
  const entry = log.find((e) => e.revision === request.targetRevision + 1);
  const what = entry ? `${name(entry.actorId)} ${entry.text}` : request.describes;
  // The requester's own approval is already counted, so there is nothing for them to vote on.
  if (request.requesterId === myId) return `Waiting for the table to approve your undo: ${what}.`;
  return `${name(request.requesterId)} wants to undo: ${what}.`;
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
