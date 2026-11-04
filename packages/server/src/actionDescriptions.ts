// Generic, action-type-derived log text, per design doc §15.1 ("human-readable, not raw action
// dumps"). Deliberately never names a specific card: GameObjects only carry a scryfallId, not a
// display name (that lives in the DB-backed CardIndex), and keeping the pure action-application
// layer free of that dependency was judged worth slightly less specific log lines — see
// README.md. Actions whose text depends on the outcome rather than the input (dice, coin flips,
// chat) supply their own text via ApplyResult.log instead of going through this table.

import { ATTACKING_MARKER, parseBlockMarker, parseTargetMarker, type Action, type ZoneRef } from '@command-table/common';

/**
 * Where a MOVE_OBJECT put the card. The zone is the one part of a move this layer *can* name —
 * it is on the action itself, unlike the card, which would need the CardIndex (see the note
 * above). "a hand" rather than "their hand": a move may be someone else's, and the actor's name
 * is already prefixed to the line.
 */
function moveDestination(toZone: ZoneRef, toPosition?: number): string {
  switch (toZone.zone) {
    case 'hand':
      return 'to a hand';
    case 'graveyard':
      return 'to a graveyard';
    case 'exile':
      return 'to exile';
    case 'battlefield':
      return 'to the battlefield';
    case 'commandZone':
      return 'to the command zone';
    case 'stack':
      return 'to the stack';
    case 'limbo':
      return 'out of the game';
    case 'library':
      // Top vs. anywhere-else is the distinction that matters after a scry; the exact index is
      // noise, since nobody can see it anyway.
      return toPosition === 0 ? 'to the top of a library' : 'into a library';
  }
}

/**
 * What setting or clearing a marker means, in the table's words. Combat markers carry an object id
 * in the string (markers.ts), which is for the model and not for the people reading the log, so
 * they are described by kind; anything else is a label the players typed, and is quoted.
 */
function describeMarker(marker: string, set: boolean): string {
  if (marker === ATTACKING_MARKER) return set ? 'declared an attacker' : 'took back an attack';
  if (parseBlockMarker(marker)) return set ? 'declared a block' : 'took back a block';
  if (parseTargetMarker(marker)) return set ? 'pointed a card at a target' : 'cleared a target';
  return set ? `labelled a card '${marker}'` : `took the '${marker}' label off a card`;
}

export function describeAction(action: Action): string {
  switch (action.t) {
    case 'MOVE_OBJECT':
      return `moved a card ${moveDestination(action.toZone, action.toPosition)}`;
    case 'SHUFFLE_LIBRARY':
      return 'shuffled their library';
    case 'DRAW':
      return `drew ${action.count} card${action.count === 1 ? '' : 's'}`;
    case 'PASS_TURN':
      return 'passed the turn (the new active player untaps; attackers cleared)';
    case 'TAP':
      return 'tapped a permanent';
    case 'UNTAP':
      return 'untapped a permanent';
    case 'UNTAP_ALL':
      return 'untapped all permanents';
    case 'SET_COUNTER':
      return `changed the '${action.key}' counter on a card`;
    case 'ATTACH':
      return 'attached one card to another';
    case 'UNATTACH':
      return 'detached a card';
    case 'SET_MARKER':
      return describeMarker(action.marker, true);
    case 'CLEAR_MARKER':
      return describeMarker(action.marker, false);
    case 'CLEAR_MARKERS_AND_COUNTERS':
      return 'cleared every marker and counter table-wide';
    case 'TRANSFORM':
      return 'transformed a card';
    case 'TURN_FACE_DOWN':
      return 'turned a card face down';
    case 'TURN_FACE_UP':
      return 'turned a card face up';
    case 'SET_ANNOTATION':
      return 'updated an annotation';
    case 'CHANGE_CONTROLLER':
      return 'changed control of a permanent';
    case 'CREATE_TOKEN':
      return `created ${action.quantity} token${action.quantity === 1 ? '' : 's'}`;
    case 'CREATE_COPY':
      return 'created a copy';
    case 'DELETE_OBJECT':
      return 'removed an object from the table';
    case 'MILL':
      return `milled ${action.count} card${action.count === 1 ? '' : 's'}`;
    case 'PEEK_TOP':
      return `looked at the top ${action.count} card${action.count === 1 ? '' : 's'} of their library`;
    case 'REVEAL':
      return 'revealed a card';
    case 'HIDE':
      return 'hid a card again';
    case 'SEARCH_LIBRARY':
      return 'searched their library';
    case 'MOVE_ALL':
      return 'moved a group of cards';
    case 'SET_LIFE':
      return action.playerIds.length === 1 ? 'changed a life total' : `changed ${action.playerIds.length} players' life totals`;
    case 'SET_PLAYER_COUNTER':
      return `changed the '${action.key}' counter`;
    case 'SET_COMMANDER_DAMAGE':
      return 'updated commander damage';
    case 'MULLIGAN':
      return 'took a mulligan';
    case 'KEEP_HAND':
      return 'kept their opening hand';
    case 'BEGIN_PLAY':
      return 'started the game';
    case 'ROLL_DICE':
    case 'FLIP_COIN':
    case 'CONCEDE':
    case 'SAY':
      // These always supply their own outcome-dependent text via ApplyResult.log.
      return '';
  }
}
