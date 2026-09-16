import { useStore } from './store.js';
import { Home } from './Home.js';
import { Lobby } from './Lobby.js';
import { Table } from './Table.js';

export function App() {
  const roomState = useStore((s) => s.roomState);
  const tableState = useStore((s) => s.tableState);
  const errorMessage = useStore((s) => s.errorMessage);
  const dismissError = useStore((s) => s.dismissError);

  return (
    <>
      {errorMessage && (
        <div className="error-toast" onClick={dismissError}>
          {errorMessage}
        </div>
      )}
      {!roomState ? <Home /> : tableState ? <Table /> : <Lobby />}
    </>
  );
}
