import { useEffect } from 'react';
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

  // Refresh recovery: this tab owned the stored session, so take the seat back without asking.
  // A session belonging to some other tab is offered on Home instead (see session.ts).
  useEffect(() => {
    const stored = loadSession();
    if (stored?.sameTab) resume(stored.session);
  }, [resume]);

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
