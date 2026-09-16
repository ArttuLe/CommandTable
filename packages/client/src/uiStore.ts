// Ephemeral, purely client-side UI state — never mirrors the server, unlike store.ts. Currently
// just the hover-zoom preview (§16.1: "non-negotiable... players need to read cards constantly").

import { create } from 'zustand';
import type { Card } from '@command-table/common';

interface UiStore {
  hoveredCard: Card | null;
  setHoveredCard: (card: Card | null) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  hoveredCard: null,
  setHoveredCard: (card) => set({ hoveredCard: card }),
}));
