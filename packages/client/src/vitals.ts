// The thresholds that mean "this player is dead", and the two readings of the commander damage
// grid that the UI actually asks for. Both the crossroads readouts and the HUD's vitals pad show
// these numbers, so they have to agree on when to flag one.

import type { ObjectId, PlayerState } from '@command-table/common';

export const POISON_LETHAL = 10;
export const COMMANDER_DAMAGE_LETHAL = 21;

export function isLethalLife(life: number): boolean {
  return life <= 0;
}

export function isLethalPoison(poison: number): boolean {
  return poison >= POISON_LETHAL;
}

export function isLethalCommanderDamage(damage: number): boolean {
  return damage >= COMMANDER_DAMAGE_LETHAL;
}

type DamageTaken = Pick<PlayerState, 'commanderDamageTaken'>;

/**
 * Every commander that has actually landed damage on this player, in the order the commanders
 * were given — so a badge doesn't jump places on the readout as another one connects.
 */
export function damageTakenFrom<T extends { id: ObjectId }>(
  player: DamageTaken,
  commanders: readonly T[]
): { commander: T; damage: number }[] {
  return commanders
    .map((commander) => ({ commander, damage: player.commanderDamageTaken[commander.id] ?? 0 }))
    .filter((entry) => entry.damage > 0);
}

/** The highest single commander's total — what the 21 rule turns on, so never the sum. */
export function worstDamageTaken(player: DamageTaken): number {
  return Math.max(0, ...Object.values(player.commanderDamageTaken));
}
