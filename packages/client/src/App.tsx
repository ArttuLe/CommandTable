import { useEffect } from 'react';
import { joinDevTable } from './api.js';
import { parseDevRoute } from './devRoute.js';
import { loadSession } from './session.js';
import { useStore } from './store.js';
import { useUiStore } from './uiStore.js';
import { Home } from './Home.js';
import { Lobby } from './Lobby.js';
import { Table } from './Table.js';

export function App() {
  const roomState = useStore((s) => s.roomState);
  const tableState = useStore((s) => s.tableState);
  const errorMessage = useStore((s) => s.errorMessage);
  const dismissError = useStore((s) => s.dismissError);
  const hoveredCard = useUiStore((s) => s.hoveredCard);
  const status = useStore((s) => s.status);
  const resume = useStore((s) => s.resume);
  const showError = useStore((s) => s.showError);

  // Refresh recovery: this tab owned the stored session, so take the seat back without asking.
  // A session belonging to some other tab is offered on Home instead (see session.ts).
  //
  // /devtest/:playerAmount/:playerName comes first and wins: the URL names the seat, so whatever
  // this browser happened to have stored is not what was asked for. Dev builds only — the check
  // is a constant Vite folds away, so the route does not exist in a built client (devRoute.ts).
  useEffect(() => {
    const dev = import.meta.env.DEV ? parseDevRoute(window.location.pathname) : null;
    if (dev) {
      joinDevTable(dev.playerAmount, dev.playerName)
        .then((seat) => resume({ ...seat, secret: 'dev' }))
        .catch((e: Error) => showError(e.message));
      return;
    }
    const stored = loadSession();
    if (stored?.sameTab) resume(stored.session);
  }, [resume, showError]);

  return (
    <>
      {status === 'reconnecting' && <div className="reconnect-banner">Reconnecting…</div>}
      {errorMessage && (
        <div className="error-toast" onClick={dismissError}>
          {errorMessage}
        </div>
      )}
      {!roomState ? <Home /> : tableState ? <Table /> : <Lobby />}
      {hoveredCard?.imageUris && (
        <div className="zoom-preview">
          <img src={hoveredCard.imageUris.normal} alt={hoveredCard.name} />
        </div>
      )}
    </>
  );
}
