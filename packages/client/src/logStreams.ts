// The one place that decides which rail an entry belongs to.
//
// Chat and the record of play come off the same server-authoritative log, separated only by
// `kind`. Splitting it here rather than at each call site keeps the rails and their toast stacks
// from drifting apart — an unread badge counting entries its rail doesn't show is the bug this
// module exists to prevent.

import type { LogEntry } from '@command-table/common';

/** What people said. */
export function chatEntries(log: readonly LogEntry[]): LogEntry[] {
  return log.filter((entry) => entry.kind === 'chat');
}

/** What happened at the table: actions and random results, but not the talking. */
export function tableEntries(log: readonly LogEntry[]): LogEntry[] {
  return log.filter((entry) => entry.kind !== 'chat');
}
