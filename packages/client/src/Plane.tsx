import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { placeMenu } from './menuPlacement.js';
import { useCloseOnEscape } from './useCloseOnEscape.js';
import { MAX_SCALE, MIN_SCALE, fitView, focusView, zoomAt, type View } from './planeView.js';

const FIT_PADDING = 24;
// Roomier than the fit padding: framing one mat this tightly would cut the glow off its edge
// and leave no hint of the boards either side of it.
const FOCUS_PADDING = 60;
// Kept in step with the `.plane.gliding` transition in styles.css, which does the actual easing.
const GLIDE_MS = 650;
// Wheel deltas vary wildly between mice and trackpads, so zoom exponentially on the delta
// rather than adding a fixed step — that keeps a trackpad pinch smooth and a notched mouse
// wheel from jumping several steps per click.
const ZOOM_SENSITIVITY = 0.0015;
const BUTTON_ZOOM_STEP = 1.25;

/**
 * A pan/zoom viewport over a fixed-size plane. The whole thing is one CSS transform on one
 * element, so panning a table full of cards is a single composited layer move rather than a
 * relayout of every card — which is why this doesn't need a canvas or WebGL at Commander's
 * scale (four boards, a couple hundred cards at most).
 *
 * Panning is deliberately unbounded; "Fit" is one click away, which is simpler and less
 * frustrating than edge-clamping math that fights the user near the borders.
 *
 * `focus` names an element inside the plane (by `data-focus`) to glide to — the settings gear's
 * "follow the active player" points it at whoever's turn it is, and a middle-click asks for the
 * same thing once. Null means the view is the user's own business, which is the default.
 *
 * It carries a `nonce` as well as the key because the two callers want different things from the
 * same mechanism: following re-aims when the turn changes, but a middle-click has to re-aim at a
 * player the view is *already* pointed at, which a key-only effect would ignore as "no change".
 */
export interface PlaneFocus {
  key: string;
  nonce: number;
}

export function Plane({
  children,
  fitKey,
  focus,
  onFocusRequest,
  following,
  onToggleFollow,
}: {
  children: React.ReactNode;
  fitKey: unknown;
  focus?: PlaneFocus | null;
  onFocusRequest?: () => void;
  /** Whether the view is currently chasing the active player, for the menu to report. */
  following?: boolean;
  onToggleFollow?: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ x: 0, y: 0, scale: 1 });
  const [panning, setPanning] = useState(false);
  const [gliding, setGliding] = useState(false);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const panRef = useRef<{ startX: number; startY: number; origin: View } | null>(null);

  // Whether the view is still the one a fit chose, rather than one the user has panned, zoomed or
  // glided to. While it is, a change of size refits it (below); the moment they move the camera,
  // where it points is theirs and nothing re-aims it behind their back.
  const framed = useRef(true);

  const fit = useCallback(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    framed.current = true;
    setView(
      fitView(
        { width: content.offsetWidth, height: content.offsetHeight },
        { width: viewport.clientWidth, height: viewport.clientHeight },
        FIT_PADDING
      )
    );
  }, []);

  // Refit when the board count changes (a player joining changes the plane's size), not on
  // every card played — a view that re-centered itself mid-turn would be unusable.
  useLayoutEffect(() => {
    fit();
  }, [fit, fitKey]);

  // The first fit is measured before the HUD below has settled — the hand fans and the opening-hand
  // band comes and goes after it — so on its own it framed the table for a viewport that was about
  // to change, and stayed that way until F. Watching both sizes lets a fit follow them, and
  // following the window too comes for free, for as long as the view is still the fit's own.
  useEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport || !content) return;
    const observer = new ResizeObserver(() => {
      if (framed.current) fit();
    });
    observer.observe(viewport);
    observer.observe(content);
    return () => observer.disconnect();
  }, [fit]);

  // Glide to whichever board `focus` names, whenever it changes — once per turn while following
  // is on, or once per middle-click. The easing is the CSS transition; this only sets the
  // destination.
  const focusKey = focus?.key ?? null;
  const focusNonce = focus?.nonce ?? 0;
  useEffect(() => {
    if (!focusKey) return;
    const viewport = viewportRef.current;
    const content = contentRef.current;
    const target = content?.querySelector<HTMLElement>(`[data-focus="${CSS.escape(focusKey)}"]`);
    if (!viewport || !content || !target) return;

    framed.current = false;
    setView((v) => {
      // Measured rects are in screen pixels; dividing by the live scale puts them back into
      // plane coordinates, which is the space focusView works in.
      const contentRect = content.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      return focusView(
        {
          x: (targetRect.left - contentRect.left) / v.scale,
          y: (targetRect.top - contentRect.top) / v.scale,
          width: targetRect.width / v.scale,
          height: targetRect.height / v.scale,
        },
        { width: viewport.clientWidth, height: viewport.clientHeight },
        FOCUS_PADDING
      );
    });

    // Dropped again afterwards so a drag or a wheel tick stays immediate — a transition left on
    // permanently would make panning feel like dragging through syrup.
    setGliding(true);
    const timer = setTimeout(() => setGliding(false), GLIDE_MS);
    return () => clearTimeout(timer);
  }, [focusKey, focusNonce]);

  // Native listener rather than React's onWheel: React attaches wheel passively at the root, so
  // preventDefault() there is ignored and the page scrolls behind the zoom.
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const rect = viewport!.getBoundingClientRect();
      const cursor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      framed.current = false;
      setView((v) => zoomAt(v, cursor, Math.exp(-e.deltaY * ZOOM_SENSITIVITY)));
    }

    viewport.addEventListener('wheel', onWheel, { passive: false });
    return () => viewport.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    if (!panning) return;

    function onMove(e: MouseEvent) {
      const pan = panRef.current;
      if (!pan) return;
      setView((v) => ({ ...v, x: pan.origin.x + (e.clientX - pan.startX), y: pan.origin.y + (e.clientY - pan.startY) }));
    }
    function onUp() {
      setPanning(false);
      panRef.current = null;
    }

    // On window, not the viewport, so a drag that leaves the element still tracks and still ends.
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [panning]);

  function onMouseDown(e: React.MouseEvent) {
    // Middle-click snaps to whoever's turn it is — the same glide the follow setting does, for
    // people who want it on demand rather than every turn. preventDefault kills the browser's
    // autoscroll, which would otherwise hijack the next mouse move.
    if (e.button === 1) {
      e.preventDefault();
      onFocusRequest?.();
      return;
    }
    if (e.button !== 0) return;
    // Anything interactive keeps its own click; the background drags the table.
    if ((e.target as HTMLElement).closest('.card-tile, button, input, table')) return;
    panRef.current = { startX: e.clientX, startY: e.clientY, origin: view };
    framed.current = false;
    setPanning(true);
  }

  // Around a viewport point, defaulting to the middle: the zoom buttons have no cursor to keep
  // anything under, but the context menu does — it zooms around where you right-clicked.
  function zoomBy(factor: number, at?: { x: number; y: number }) {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    const point = at
      ? { x: at.x - rect.left, y: at.y - rect.top }
      : { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
    framed.current = false;
    setView((v) => zoomAt(v, point, factor));
  }

  // The table's own right-click menu. A card's menu wins on a card (CardTile binds its own), and
  // the same guard as panning decides what counts as the table: the background, not the chrome
  // sitting on it.
  function onContextMenu(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest('.card-tile, button, input, table')) return;
    e.preventDefault();
    setMenuAt({ x: e.clientX, y: e.clientY });
  }

  return (
    <div
      className={`plane-viewport ${panning ? 'panning' : ''}`}
      ref={viewportRef}
      onMouseDown={onMouseDown}
      onContextMenu={onContextMenu}
      // Firefox fires the autoscroll on auxclick rather than mousedown, so both need suppressing.
      onAuxClick={(e) => e.button === 1 && e.preventDefault()}
    >
      <div
        className={`plane ${gliding ? 'gliding' : ''}`}
        ref={contentRef}
        // The scale is published as well as applied, so the few things that must read from across
        // the table at any zoom can size themselves against it (the rails' names and life, styles.css).
        style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, '--plane-scale': view.scale } as React.CSSProperties}
      >
        {children}
      </div>

      <div className="plane-controls">
        <button onClick={() => zoomBy(1 / BUTTON_ZOOM_STEP)} disabled={view.scale <= MIN_SCALE} title="Zoom out">
          −
        </button>
        <button onClick={fit} title="Fit the whole table on screen (F)">
          Fit
        </button>
        <button onClick={() => zoomBy(BUTTON_ZOOM_STEP)} disabled={view.scale >= MAX_SCALE} title="Zoom in">
          +
        </button>
      </div>

      {menuAt && (
        <PlaneMenu
          at={menuAt}
          scale={view.scale}
          onZoom={(factor) => zoomBy(factor, menuAt)}
          onFit={fit}
          following={following}
          onToggleFollow={onToggleFollow}
          onClose={() => setMenuAt(null)}
        />
      )}
    </div>
  );
}

/**
 * The plane's context menu: the three commands the corner controls carry and the one view
 * setting, where the cursor already is. The controls stay — they are what a first-time player
 * finds — but reaching a corner, or the settings gear, is a trip away from the board you are
 * looking at.
 *
 * Measured, then placed, for the same reason the card menu is (see menuPlacement.ts): it is fixed
 * at the cursor, and a right-click near the bottom edge would otherwise run it off-screen.
 */
function PlaneMenu({
  at,
  scale,
  onZoom,
  onFit,
  following,
  onToggleFollow,
  onClose,
}: {
  at: { x: number; y: number };
  scale: number;
  onZoom: (factor: number) => void;
  onFit: () => void;
  following?: boolean;
  onToggleFollow?: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useCloseOnEscape(true, onClose);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos(placeMenu(at, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [at]);

  function run(fn: () => void) {
    fn();
    onClose();
  }

  return (
    <>
      <div className="context-menu-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={ref}
        className="context-menu"
        style={{ left: pos?.left ?? at.x, top: pos?.top ?? at.y, visibility: pos ? 'visible' : 'hidden' }}
      >
        <div className="context-menu-title">The table</div>
        <button disabled={scale >= MAX_SCALE} onClick={() => run(() => onZoom(BUTTON_ZOOM_STEP))}>
          Zoom in
        </button>
        <button disabled={scale <= MIN_SCALE} onClick={() => run(() => onZoom(1 / BUTTON_ZOOM_STEP))}>
          Zoom out
        </button>
        <button onClick={() => run(onFit)}>Fit the whole table</button>

        {/* The same setting the gear carries, offered where the view it acts on is. The label
            says what the click will do rather than what is on, which is the idiom the card menu
            already uses for Tap/Untap. */}
        {onToggleFollow && (
          <>
            <hr />
            <button onClick={() => run(onToggleFollow)}>
              {following ? 'Stop following the active player' : 'Follow the active player'}
            </button>
          </>
        )}
      </div>
    </>
  );
}
