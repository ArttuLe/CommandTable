// The table's icons: drawn, one stroke weight, sized to the text around them. They replace
// Unicode glyphs (❤ ☠ ⚔ Σ ⚙ ☾ ⧉) whose look depended on whichever font the browser fell back
// to — in Chromium without an emoji font, ⚔ came out as "×", so commander damage read "× 0".
//
// The mana emblems are this table's own, not Magic's printed symbols: a shape per colour inside
// the coloured disc it already had, so a colour is found by its hue and told apart by its shape.

import type { ComponentType } from 'react';
import {
  Bone,
  Check,
  CircleHelp,
  Copy,
  Diamond,
  Droplet,
  Flame,
  Heart,
  Moon,
  Settings,
  Sigma,
  Skull,
  Sun,
  Swords,
  TreePine,
  X,
  type LucideProps,
} from 'lucide-react';
import type { ManaColor } from './uiStore.js';

function icon(Drawn: ComponentType<LucideProps>) {
  return function Icon(props: LucideProps) {
    return <Drawn size="1em" strokeWidth={2.25} aria-hidden="true" className="icon" {...props} />;
  };
}

export const LifeIcon = icon(Heart);
export const PoisonIcon = icon(Skull);
export const CommanderDamageIcon = icon(Swords);
export const TotalIcon = icon(Sigma);
export const SettingsIcon = icon(Settings);
export const HelpIcon = icon(CircleHelp);
export const SummoningSickIcon = icon(Moon);
export const CopyIcon = icon(Copy);
export const CopiedIcon = icon(Check);
export const CloseIcon = icon(X);

const MANA_EMBLEMS: Record<ManaColor, ComponentType<LucideProps>> = {
  W: icon(Sun),
  U: icon(Droplet),
  B: icon(Bone),
  R: icon(Flame),
  G: icon(TreePine),
  C: icon(Diamond),
};

export function ManaEmblem({ color }: { color: ManaColor }) {
  const Emblem = MANA_EMBLEMS[color];
  return <Emblem />;
}
