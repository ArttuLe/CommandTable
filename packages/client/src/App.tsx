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

  return (
    <>
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
