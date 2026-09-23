// The player's own actions, as a list rather than as JSX.
//
// These used to be written straight into the "More ⋯" popover. They now have two homes — that
// popover, and the grid the "Show every action" setting puts beside the hand (see ActionBar) —
// so the catalog lives here once and each home decides only how to draw it.
//
// Ordered by how often they come up, the same reasoning that put Draw / Untap all / Pass turn in
// the bar itself: Library first, Concede last and on its own.

import type { Action, PlayerId } from '@command-table/common';
import type { LibraryLook } from './libraryMoves.js';

/** The actions that ask a question before they act; each names a dialog in ActionBar. */
export type PlayerDialog = 'peek' | 'mill' | 'token' | 'dice' | 'allLife' | 'concede';

export interface PlayerActionItem {
  label: string;
  /** Drawn in red and, where the layout allows, kept away from the rest. Concede only. */
  danger?: boolean;
  run: () => void;
}

export interface PlayerActionGroup {
  /** The heading above the group, or null for the ungrouped tail. */
  title: string | null;
  items: PlayerActionItem[];
}

interface PlayerActionDeps {
  playerId: PlayerId;
  act: (action: Action) => void;
  openDialog: (dialog: PlayerDialog) => void;
  /**
   * Opens the library dock, because both of the actions that need it only flip card visibility
   * server-side and would otherwise look like nothing happened (see ActionBar's lookAtLibrary).
   */
  lookAtLibrary: (look: LibraryLook) => void;
}

export function playerActionGroups({
  playerId,
  act,
  openDialog,
  lookAtLibrary,
}: PlayerActionDeps): PlayerActionGroup[] {
  return [
    {
      title: 'Library',
      items: [
        { label: 'Shuffle', run: () => act({ t: 'SHUFFLE_LIBRARY', playerId }) },
        {
          label: 'Search library',
          run: () => {
            act({ t: 'SEARCH_LIBRARY', playerId });
            lookAtLibrary('search');
          },
        },
        { label: 'Peek / Scry…', run: () => openDialog('peek') },
        // `MILL` is aimed at its controller far more often than not, and a card is always
        // movable by hand, so this one is your own library like the rest of the group.
        { label: 'Mill…', run: () => openDialog('mill') },
        { label: 'Mulligan', run: () => act({ t: 'MULLIGAN', playerId }) },
      ],
    },
    {
      title: 'Table',
      items: [
        { label: 'Adjust all life…', run: () => openDialog('allLife') },
        { label: 'Clear all markers', run: () => act({ t: 'CLEAR_ALL_MARKERS' }) },
        { label: 'Create token…', run: () => openDialog('token') },
      ],
    },
    {
      title: 'Random',
      items: [
        { label: 'Roll dice…', run: () => openDialog('dice') },
        { label: 'Flip coin', run: () => act({ t: 'FLIP_COIN', playerId }) },
      ],
    },
    {
      title: null,
      items: [{ label: 'Concede', danger: true, run: () => openDialog('concede') }],
    },
  ];
}
