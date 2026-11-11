// The WebSocket boundary: a frame becomes a ClientMessage only if it has the shape one.
//
// JSON.parse only proves a frame is JSON. Everything after it trusted the shape, so `null`, a
// numeric passphrase or a fractional seat threw inside a handler — and an uncaught throw takes the
// whole process down, with it every game on the server, before or after the passphrase check.
// This checks the fields the handlers read as primitives; an action's own payload is the action
// applier's to judge, and it answers bad ones with `rejected`.

import type { ClientMessage } from '@command-table/common';

type Json = Record<string, unknown>;

const isString = (v: unknown): v is string => typeof v === 'string';
const isOptional = (v: unknown, check: (v: unknown) => boolean) => v === undefined || check(v);
const isSeat = (v: unknown) => Number.isInteger(v) && (v as number) >= 0;

function valid(m: Json): boolean {
  switch (m.t) {
    case 'join':
      return isString(m.roomId) && isString(m.displayName) && isString(m.secret) && isOptional(m.seat, isSeat) && isOptional(m.rejoinToken, isString);
    case 'deck':
      return isString(m.list);
    case 'ready':
      return typeof m.ready === 'boolean';
    case 'action':
      return typeof m.action === 'object' && m.action !== null && isString((m.action as Json).t) && Number.isInteger(m.clientSeq);
    case 'undo':
      return Number.isInteger(m.revision);
    case 'undoVote':
      return Number.isInteger(m.targetRevision) && typeof m.approve === 'boolean';
    case 'freeSeat':
      return isSeat(m.seat);
    case 'start':
    case 'endGame':
    case 'ping':
      return true;
    default:
      return false;
  }
}

export function parseClientMessage(text: string): ClientMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return null;
  return valid(parsed as Json) ? (parsed as ClientMessage) : null;
}
