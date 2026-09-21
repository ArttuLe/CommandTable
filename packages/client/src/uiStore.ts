// Ephemeral, purely client-side UI state — never mirrors the server, unlike store.ts. Currently
// the hover-zoom preview (§16.1: "non-negotiable... players need to read cards constantly"), the
// mana pad (§8.4: "client-local... resets at will and never leaves their browser"), and
// multi-select (§16.2: "tap five lands" or "sacrifice all my tokens" as one gesture), plus
// whether the log rail is docked open.

import { create } from 'zustand';
import type { Card, ObjectId } from '@command-table/common';
import type { ReplaceableZone } from './commanderPrompt.js';

export type ManaColor = 'W' | 'U' | 'B' | 'R' | 'G' | 'C';

const EMPTY_MANA_POOL: Record<ManaColor, number> = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };

interface UiStore {
  hoveredCard: Card | null;
  setHoveredCard: (card: Card | null) => void;
  manaPad: Record<ManaColor, number>;
  bumpMana: (color: ManaColor, delta: number) => void;
  resetMana: () => void;
  selectedIds: Set<ObjectId>;
  toggleSelected: (id: ObjectId) => void;
  clearSelection: () => void;
  logRailOpen: boolean;
  toggleLogRail: () => void;
  /** Which zone-dock popover is open, if any. Lives here rather than inside ZoneDock so that
      searching or peeking can put the revealed cards in front of you (see ActionBar). */
  openZoneKey: string | null;
  openZone: (key: string) => void;
  toggleZone: (key: string) => void;
  closeZone: () => void;
  /** Set by a library search, paid off by a shuffle when the popover closes (see Table). */
  libraryDirty: boolean;
  setLibraryDirty: (dirty: boolean) => void;
  /** How many dialogs are up. Table reads it to stand its keyboard shortcuts down (Dialog.tsx). */
  openDialogs: number;
  pushDialog: () => void;
  popDialog: () => void;
  /** Settings gear: the plane re-frames itself on the active player's board each turn. */
  followActivePlayer: boolean;
  toggleFollowActivePlayer: () => void;
  /** Commander replacement offers waved away, keyed by the zone they were waved away in. */
  dismissedCommanders: Record<ObjectId, ReplaceableZone>;
  dismissCommander: (objectId: ObjectId, zone: ReplaceableZone) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  hoveredCard: null,
  setHoveredCard: (card) => set({ hoveredCard: card }),
  manaPad: EMPTY_MANA_POOL,
  bumpMana: (color, delta) =>
    set((s) => ({ manaPad: { ...s.manaPad, [color]: Math.max(0, s.manaPad[color] + delta) } })),
  resetMana: () => set({ manaPad: EMPTY_MANA_POOL }),
  selectedIds: new Set(),
  toggleSelected: (id) =>
    set((s) => {
      const next = new Set(s.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  clearSelection: () => set({ selectedIds: new Set() }),
  logRailOpen: false,
  toggleLogRail: () => set((s) => ({ logRailOpen: !s.logRailOpen })),
  openZoneKey: null,
  openZone: (key) => set({ openZoneKey: key }),
  toggleZone: (key) => set((s) => ({ openZoneKey: s.openZoneKey === key ? null : key })),
  closeZone: () => set({ openZoneKey: null }),
  libraryDirty: false,
  setLibraryDirty: (dirty) => set({ libraryDirty: dirty }),
  openDialogs: 0,
  pushDialog: () => set((s) => ({ openDialogs: s.openDialogs + 1 })),
  popDialog: () => set((s) => ({ openDialogs: Math.max(0, s.openDialogs - 1) })),
  followActivePlayer: false,
  toggleFollowActivePlayer: () => set((s) => ({ followActivePlayer: !s.followActivePlayer })),
  dismissedCommanders: {},
  dismissCommander: (objectId, zone) =>
    set((s) => ({ dismissedCommanders: { ...s.dismissedCommanders, [objectId]: zone } })),
}));
