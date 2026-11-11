// The opening-hand step's prose (SetupStep.tsx), as one pure function so every case can be read
// side by side.
//
// A mulligan here shuffles the hand back and deals seven again (MULLIGAN in the server's
// playerActions.ts); putting cards on the bottom is left to the player, through the hand card's
// Bottom menu item (cardMenu.ts). The first mulligan is free, as it is in multiplayer Commander,
// so after N mulligans the step says to bottom N − 1 cards, and how.

export interface SetupStatus {
  /** The line beside "Opening hands": what to do with the hand in front of you. */
  note: string;
  /** Your own decision, once you have made it. */
  kept: string | null;
  /** Who the table is waiting on. */
  waiting: string;
}

export function setupStatus({
  handCount,
  mulligans,
  kept,
  isHost,
  deciding,
}: {
  handCount: number;
  mulligans: number;
  kept: boolean;
  isHost: boolean;
  /** Display names of the players who have not kept yet. */
  deciding: string[];
}): SetupStatus {
  const toBottom = mulligans - 1;
  const note =
    mulligans === 0
      ? `Mulligan until you like your ${handCount === 1 ? 'card' : `${handCount} cards`}, then keep.`
      : mulligans === 1
        ? 'Mulligan 1 is free: keep all 7, or mulligan again.'
        : `Mulligan ${mulligans}: put ${toBottom === 1 ? '1 card' : `${toBottom} cards`} on the bottom — right-click ${toBottom === 1 ? 'it' : 'each'} and choose Bottom.`;

  return {
    note,
    // Only the host can start the game, so anyone else who has kept has nothing left to do but wait.
    kept: kept ? (isHost ? 'You kept.' : 'You kept — waiting for the host to start the game.') : null,
    waiting: deciding.length === 0 ? 'Everyone has kept.' : `Still deciding: ${deciding.join(', ')}`,
  };
}
