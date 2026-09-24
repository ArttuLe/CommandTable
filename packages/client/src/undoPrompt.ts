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
  players: readonly Named[]
): string {
  const name = (id: PlayerId) => players.find((p) => p.id === id)?.displayName ?? id;
  const entry = log.find((e) => e.revision === request.targetRevision + 1);
  const what = entry ? `${name(entry.actorId)} ${entry.text}` : request.describes;
  return `${name(request.requesterId)} wants to undo: ${what}.`;
}
