// Table settings, behind the gear in the status bar.
//
// One toggle so far — following the active player — kept out of the plane's own controls because
// it is a standing preference rather than a view command like Fit or zoom.

import { useEffect, useRef, useState } from 'react';
import { useUiStore } from './uiStore.js';

export function SettingsMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const followActivePlayer = useUiStore((s) => s.followActivePlayer);
  const toggleFollowActivePlayer = useUiStore((s) => s.toggleFollowActivePlayer);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="settings-menu" ref={ref}>
      <button
        className={`icon-button gear ${open ? 'open' : ''}`}
        title="Settings"
        aria-label="Settings"
        onClick={() => setOpen((o) => !o)}
      >
        ⚙
      </button>
      {open && (
        <div className="settings-popover">
          <p className="popover-group">View</p>
          <label>
            <input type="checkbox" checked={followActivePlayer} onChange={toggleFollowActivePlayer} />
            <span>
              Follow the active player
              <small>The table pans to whoever's turn it is and zooms in on their board.</small>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}
