// Ephemeral, purely client-side UI state — never mirrors the server, unlike store.ts. Currently
// the hover-zoom preview (§16.1: "non-negotiable... players need to read cards constantly"), the
// mana pad (§8.4: "client-local... resets at will and never leaves their browser"), and
// multi-select (§16.2: "tap five lands" or "sacrifice all my tokens" as one gesture).

import { create } from 'zustand';
import type { Card, ObjectId } from '@command-table/common';

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
}));
