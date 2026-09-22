// Pan/zoom math for the table plane. Kept separate from the component so the one genuinely
// tricky bit — keeping the point under the cursor pinned while the scale changes — is testable
// without a DOM.
//
// A View is the CSS transform applied to the plane: `translate(x, y) scale(scale)`, with
// transform-origin at the top-left. Screen position of a plane point p is therefore
// `view.x + p * view.scale`, which is the whole coordinate system.

export interface View {
  x: number;
  y: number;
  scale: number;
}

export const MIN_SCALE = 0.15;
export const MAX_SCALE = 2.5;

export interface Size {
  width: number;
  height: number;
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));
}

/**
 * Scale by `factor` around a cursor position in viewport coordinates, so the card under the
 * pointer stays under the pointer. Returns the view unchanged when the zoom would be clamped
 * away entirely — without that, repeated wheel ticks at the limit would still pan the plane.
 */
export function zoomAt(view: View, cursor: { x: number; y: number }, factor: number): View {
  const scale = clampScale(view.scale * factor);
  const ratio = scale / view.scale;
  if (ratio === 1) return view;

  return {
    scale,
    x: cursor.x - (cursor.x - view.x) * ratio,
    y: cursor.y - (cursor.y - view.y) * ratio,
  };
}

/** The view that centers `content` inside `viewport` with `padding` on every edge. */
export function fitView(content: Size, viewport: Size, padding: number): View {
  // Guards a zero-sized content box during the first layout pass, where the ratio would be NaN.
  const width = content.width > 0 ? content.width : 1;
  const height = content.height > 0 ? content.height : 1;

  const scale = clampScale(
    Math.min((viewport.width - padding * 2) / width, (viewport.height - padding * 2) / height)
  );

  return {
    scale,
    x: (viewport.width - width * scale) / 2,
    y: (viewport.height - height * scale) / 2,
  };
}

export interface Rect extends Size {
  x: number;
  y: number;
}

/**
 * The view that centers one board in the viewport and fills it, for "follow the active player".
 *
 * Same shape as `fitView` but framing a rect inside the plane rather than the whole plane, and
 * it zooms *in*: a single mat is a fraction of the table, so the scale that fits it is usually
 * far above the fit-the-table scale (capped at MAX_SCALE like every other zoom).
 */
export function focusView(rect: Rect, viewport: Size, padding: number): View {
  const width = rect.width > 0 ? rect.width : 1;
  const height = rect.height > 0 ? rect.height : 1;

  const scale = clampScale(
    Math.min((viewport.width - padding * 2) / width, (viewport.height - padding * 2) / height)
  );

  return {
    scale,
    x: viewport.width / 2 - (rect.x + width / 2) * scale,
    y: viewport.height / 2 - (rect.y + height / 2) * scale,
  };
}
