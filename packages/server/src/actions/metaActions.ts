// ROLL_DICE/FLIP_COIN/CONCEDE/SAY — deferred from Phase 3 because the doc routes all four
// through the game log. Each supplies its own outcome-dependent log text via ApplyResult.log
// rather than the generic actionDescriptions.ts table.

import type { Action, TableState } from '@command-table/common';
import { bumpRevision, defaultVisibilityFor, detachFrom, err, ok, requirePlayer, withObject, type ApplyResult } from './helpers.js';

export function rollDice(
  state: TableState,
  action: Extract<Action, { t: 'ROLL_DICE' }>,
  randomInt: (exclusiveMax: number) => number
): ApplyResult {
  if (!requirePlayer(state, action.playerId)) return err(`no such player: ${action.playerId}`);
  if (action.sides < 2) return err('a die needs at least 2 sides');
  const result = randomInt(action.sides) + 1;
  return ok(bumpRevision(state), { text: `rolled a d${action.sides}: ${result}`, kind: 'random' });
}

export function flipCoin(
  state: TableState,
  action: Extract<Action, { t: 'FLIP_COIN' }>,
  randomInt: (exclusiveMax: number) => number
): ApplyResult {
  if (!requirePlayer(state, action.playerId)) return err(`no such player: ${action.playerId}`);
  const result = randomInt(2) === 0 ? 'heads' : 'tails';
  return ok(bumpRevision(state), { text: `flipped a coin: ${result}`, kind: 'random' });
}

export function say(state: TableState, action: Extract<Action, { t: 'SAY' }>): ApplyResult {
  if (!requirePlayer(state, action.playerId)) return err(`no such player: ${action.playerId}`);
  return ok(bumpRevision(state), { text: action.text, kind: 'chat' });
}

export function concede(state: TableState, action: Extract<Action, { t: 'CONCEDE' }>): ApplyResult {
  const player = requirePlayer(state, action.playerId);
  if (!player) return err(`no such player: ${action.playerId}`);

  let next = state;
  let revertedCount = 0;
  for (const obj of Object.values(state.objects)) {
    if (obj.ownerId === action.playerId) {
      // Leaving the game is leaving play: anything attached to it comes off (an opponent's aura).
      next = detachFrom(next, obj.id);
      // And what it was attached to lets go of it: the conceder's aura on an opponent's creature
      // must not stay attached from limbo.
      next = withObject(next, { ...next.objects[obj.id], zone: { zone: 'limbo' }, faceVisibility: { kind: 'none' }, attachedTo: null }, false);
    } else if (obj.controllerId === action.playerId) {
      // Owner regains control by default (CR 800.4a); flagged in the log rather than silently
      // assumed correct, per §14.3's "prompt rather than guess" — there's no prompt UI yet. A
      // permanent goes back to its owner's battlefield too: control is also whose mat it is on.
      const zone = 'playerId' in obj.zone && obj.zone.zone === 'battlefield' ? { playerId: obj.ownerId, zone: 'battlefield' as const } : obj.zone;
      // Sight of a face-down permanent goes back with control, as CHANGE_CONTROLLER hands it on.
      const faceVisibility = obj.faceDown ? defaultVisibilityFor(zone, obj.ownerId, true) : obj.faceVisibility;
      next = withObject(next, { ...next.objects[obj.id], controllerId: obj.ownerId, zone, faceVisibility }, false);
      revertedCount++;
    }
  }

  const players = next.players.map((p) => (p.id === action.playerId ? { ...p, status: 'conceded' as const } : p));
  const note = revertedCount > 0 ? ` (control of ${revertedCount} object(s) reverted to their owners — please review)` : '';

  return ok(bumpRevision({ ...next, players }), { text: `conceded at ${player.life} life${note}` });
}
