// The arrows: which creature is blocking which attacker, and what a spell on the stack is
// pointed at. Drawn over the mats rather than beside them, because "who is blocking whom" is a
// relationship between two cards and any other way of showing it — a badge, a list — makes you
// hold the pairing in your head instead of seeing it.
//
// It lives *inside* the plane, so it inherits the plane's transform: an arrow drawn at a card's
// plane position stays glued to that card through every pan and zoom, with nothing to recompute.
// The geometry itself is in arrows.ts, which is pure; this file only measures and paints.

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ObjectId } from '@command-table/common';
import { arrowPaths, type ArrowPath, type Box } from './arrows.js';
import type { Relation } from './combat.js';

export function ArrowLayer({ relations, revision }: { relations: Relation[]; revision: number }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [paths, setPaths] = useState<ArrowPath[]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const measure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;

    // offsetWidth is the untransformed layout width, so it is already in plane units; the
    // measured rect is in screen pixels. Their ratio is the plane's live scale, which is how
    // every measurement below gets back into plane space without this needing to know the view.
    const hostRect = host.getBoundingClientRect();
    const scale = host.offsetWidth > 0 ? hostRect.width / host.offsetWidth : 1;
    setSize({ width: host.offsetWidth, height: host.offsetHeight });

    const wanted = new Set(relations.flatMap((r) => [r.fromId, r.toId]));
    const boxes: Record<ObjectId, Box> = {};
    for (const id of wanted) {
      const node = host.parentElement?.querySelector<HTMLElement>(`[data-object-id="${CSS.escape(id)}"]`);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      boxes[id] = {
        x: (rect.left - hostRect.left) / scale,
        y: (rect.top - hostRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      };
    }

    setPaths(arrowPaths(relations, boxes));
  }, [relations]);

  // After layout, not after paint: measuring in useEffect lets one frame render with the arrows
  // still at their old positions, which reads as a flicker every time a card moves.
  //
  // `revision` is in the deps because a card can move without the relations changing at all — a
  // blocker being tapped, a permanent played onto the same row — and the arrow has to follow it.
  useLayoutEffect(() => {
    measure();
  }, [measure, revision]);

  // The mats reflow when the window changes, and nothing above would say so.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(host);
    return () => observer.disconnect();
  }, [measure]);

  return (
    <div className="arrow-layer" ref={hostRef}>
      {paths.length > 0 && size.width > 0 && (
        <svg viewBox={`0 0 ${size.width} ${size.height}`} width={size.width} height={size.height}>
          <defs>
            {/* One marker per colour: SVG markers don't inherit the path's stroke in every
                browser, so tying the arrowhead to `context-stroke` is not portable. The colours
                are the two the mats already use — your board's accent and the turn colour — so
                an arrow matches the border of the board its near end sits on. */}
            <ArrowHead id="arrowhead-mine" className="arrow-head-mine" />
            <ArrowHead id="arrowhead-theirs" className="arrow-head-theirs" />
          </defs>

          {paths.map((path) => (
            <g key={path.id} className={`arrow arrow-${path.kind} ${path.mine ? 'mine' : 'theirs'}`}>
              <path
                d={`M ${path.from.x} ${path.from.y} Q ${path.control.x} ${path.control.y} ${path.to.x} ${path.to.y}`}
                markerEnd={`url(#arrowhead-${path.mine ? 'mine' : 'theirs'})`}
              />
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

function ArrowHead({ id, className }: { id: string; className: string }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
      <path className={className} d="M 0 0 L 10 5 L 0 10 z" />
    </marker>
  );
}
