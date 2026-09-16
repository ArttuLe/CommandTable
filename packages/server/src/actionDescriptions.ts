// Generic, action-type-derived log text, per design doc §15.1 ("human-readable, not raw action
// dumps"). Deliberately never names a specific card: GameObjects only carry a scryfallId, not a
// display name (that lives in the DB-backed CardIndex), and keeping the pure action-application
// layer free of that dependency was judged worth slightly less specific log lines — see
// README.md. Actions whose text depends on the outcome rather than the input (dice, coin flips,
// chat) supply their own text via ApplyResult.log instead of going through this table.

import type { Action } from '@command-table/common';

export function describeAction(action: Action): string {
  switch (action.t) {
    case 'MOVE_OBJECT':
      return 'moved a card';
    case 'SHUFFLE_LIBRARY':
      return 'shuffled their library';
    case 'DRAW':
      return `drew ${action.count} card${action.count === 1 ? '' : 's'}`;
    case 'PASS_TURN':
      return 'passed the turn';
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
      return `set the '${action.marker}' marker on a card`;
    case 'CLEAR_MARKER':
      return `cleared the '${action.marker}' marker from a card`;
    case 'CLEAR_ALL_MARKERS':
      return 'cleared all markers table-wide';
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
    case 'ROLL_DICE':
    case 'FLIP_COIN':
    case 'CONCEDE':
    case 'SAY':
      // These always supply their own outcome-dependent text via ApplyResult.log.
      return '';
  }
}
