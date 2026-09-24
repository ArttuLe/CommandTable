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
  /** The chat rail, on the opposite side of the table from the log (see ChatRail.tsx). */
  chatRailOpen: boolean;
  toggleChatRail: () => void;
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
  /**
   * The object waiting to be pointed at something, while "Target…" or "Blocking…" is armed, and
   * which of the two it is. The next card clicked becomes the target or the blocked attacker;
   * Escape, or arming the same thing twice, stands it down.
   *
   * A mode rather than a list-of-everything dialog, because either end can be any card on the
   * table — a hundred-odd choices, and the one you want is already on screen under your cursor.
   * Blocking used to be a dialog listing the declared attackers; pointing at the creature is the
   * same gesture you would make across a real table, and the same one targeting already used.
   */
  pointing: { fromId: ObjectId; kind: PointingKind } | null;
  startPointing: (objectId: ObjectId, kind: PointingKind) => void;
  cancelPointing: () => void;
}

/** What the next card click means while a pointing mode is armed. */
export type PointingKind = 'target' | 'block';

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
  chatRailOpen: false,
  toggleChatRail: () => set((s) => ({ chatRailOpen: !s.chatRailOpen })),
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
  pointing: null,
  // Arming the same thing twice stands it down, so the menu item is its own escape hatch.
  startPointing: (objectId, kind) =>
    set((s) => ({
      pointing: s.pointing?.fromId === objectId && s.pointing.kind === kind ? null : { fromId: objectId, kind },
    })),
  cancelPointing: () => set({ pointing: null }),
}));
