// How tightly the hand fans.
//
// The crowded hand overlapped every card by a fixed 0.44 of a card width above a hard-coded
// eight, which is fine at nine cards and ruinous at twenty — a post-wheel Commander hand painted
// straight over the action bar and the zone dock, because `nowrap` plus a fixed overlap has no
// idea how much room it was given. Both halves of that were guesses. The overlap is measured
// instead, and "crowded" is its consequence: a hand that fits doesn't overlap at all, and one
// that doesn't overlaps exactly enough to fit and no more.
//
// That matters at seven cards, which is every opening hand: seven cards are a shade
// wider than the room the HUD gives them, so under the old threshold they wrapped onto a second
// row — the one thing the fan exists to prevent — because seven is not more than eight.
//
// Pure arithmetic so it can be tested without a DOM; Table measures the hand and feeds it.

/** Past this a card is no longer a card you can pick out, so the fan overflows instead. */
const MAX_OVERLAP = 0.88;

/**
 * A pixel of slack. The hand is measured with `clientWidth`, which is rounded to whole pixels,
 * against a width in fractional ones — so a hand that exactly fits can read as a hair too wide.
 * Without this, that hair is enough to start overlapping, which narrows the hand, which makes it
 * fit, which stops the overlapping: the layout would hunt instead of settling.
 */
const SLACK = 1;

/**
 * The per-card overlap, as a fraction of card width, that keeps `count` cards inside `available`.
 * Zero when they already fit — the hand is then a plain flex row, which is what it should be
 * whenever it can afford to be.
 */
export function fanOverlap(count: number, cardWidth: number, gap: number, available: number): number {
  if (count <= 1) return 0;
  // What the row wants if nothing overlaps: every card, plus the gap between each pair.
  const natural = count * cardWidth + (count - 1) * gap;
  if (natural <= available + SLACK) return 0;
  // Each of the `count - 1` overlaps has to swallow an equal share of the excess.
  const needed = (natural - available) / ((count - 1) * cardWidth);
  return Math.min(MAX_OVERLAP, needed);
}
