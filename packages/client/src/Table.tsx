import { isRedacted, type GameObject, type PlayerId, type ProjectedObject } from '@command-table/common';
import { useStore } from './store.js';
import { CardTile } from './CardTile.js';

function isOwnZone(obj: ProjectedObject, playerId: PlayerId, zone: string): boolean {
  return 'playerId' in obj.zone && obj.zone.playerId === playerId && obj.zone.zone === zone;
}

export function Table() {
  const tableState = useStore((s) => s.tableState)!;
  const playerId = useStore((s) => s.playerId)!;
  const act = useStore((s) => s.act);
  const pendingUndoRequest = useStore((s) => s.pendingUndoRequest);
  const send = useStore((s) => s.send);

  const objects = Object.values(tableState.objects);
  const opponents = tableState.players.filter((p) => p.id !== playerId);
  const me = tableState.players.find((p) => p.id === playerId);

  const battlefieldOf = (pid: PlayerId) => objects.filter((o) => isOwnZone(o, pid, 'battlefield'));
  const commandZoneOf = (pid: PlayerId) => objects.filter((o) => isOwnZone(o, pid, 'commandZone'));
  const myHand = objects.filter((o) => isOwnZone(o, playerId, 'hand'));

  return (
    <div className="table">
      <div className="opponents">
        {opponents.map((p) => (
          <PlayerArea
            key={p.id}
            name={p.displayName}
            life={p.life}
            handCount={tableState.handCounts[p.id]}
            libraryCount={tableState.libraryCounts[p.id]}
            status={p.status}
            connected={p.connected}
            battlefield={battlefieldOf(p.id)}
            commandZone={commandZoneOf(p.id)}
            onLifeDelta={(delta) => act({ t: 'SET_LIFE', playerIds: [p.id], update: { mode: 'delta', amount: delta } })}
            onTapToggle={(obj) => act({ t: obj.tapped ? 'UNTAP' : 'TAP', objectId: obj.id })}
          />
        ))}
      </div>

      <div className="sidebar">
        <div className="controls">
          <button onClick={() => act({ t: 'DRAW', playerId, count: 1 })}>Draw</button>
          <button onClick={() => act({ t: 'SHUFFLE_LIBRARY', playerId })}>Shuffle</button>
          <button onClick={() => act({ t: 'UNTAP_ALL', playerId })}>Untap all</button>
          <button onClick={() => act({ t: 'PASS_TURN' })}>Pass turn</button>
          <button onClick={() => act({ t: 'MULLIGAN', playerId })}>Mulligan</button>
          <button onClick={() => act({ t: 'CONCEDE', playerId })}>Concede</button>
        </div>

        {pendingUndoRequest && (
          <div className="undo-request">
            <p>{pendingUndoRequest.describes}?</p>
            <button onClick={() => send({ t: 'undoVote', targetRevision: pendingUndoRequest.targetRevision, approve: true })}>Approve</button>
            <button onClick={() => send({ t: 'undoVote', targetRevision: pendingUndoRequest.targetRevision, approve: false })}>Reject</button>
          </div>
        )}

        <div className="log">
          {tableState.log.map((entry, i) => {
            const actorName = tableState.players.find((p) => p.id === entry.actorId)?.displayName ?? entry.actorId;
            return (
              <p key={i}>
                <strong>{actorName}</strong> {entry.text}
              </p>
            );
          })}
        </div>
      </div>

      <div className="self-area">
        {me && (
          <PlayerArea
            name={me.displayName}
            life={me.life}
            handCount={tableState.handCounts[me.id]}
            libraryCount={tableState.libraryCounts[me.id]}
            status={me.status}
            connected={me.connected}
            battlefield={battlefieldOf(me.id)}
            commandZone={commandZoneOf(me.id)}
            onLifeDelta={(delta) => act({ t: 'SET_LIFE', playerIds: [me.id], update: { mode: 'delta', amount: delta } })}
            onTapToggle={(obj) => act({ t: obj.tapped ? 'UNTAP' : 'TAP', objectId: obj.id })}
            onGraveyard={(obj) => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: { playerId, zone: 'graveyard' } })}
          />
        )}

        <div className="hand">
          {myHand.map((obj) => (
            <CardTile
              key={obj.id}
              obj={obj}
              onClick={() => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: { playerId, zone: 'battlefield' } })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface PlayerAreaProps {
  name: string;
  life: number;
  handCount: number;
  libraryCount: number;
  status: string;
  connected: boolean;
  battlefield: ProjectedObject[];
  commandZone: ProjectedObject[];
  onLifeDelta: (delta: number) => void;
  onTapToggle: (obj: { id: string; tapped: boolean }) => void;
  onGraveyard?: (obj: GameObject) => void;
}

function PlayerArea({ name, life, handCount, libraryCount, status, connected, battlefield, commandZone, onLifeDelta, onTapToggle, onGraveyard }: PlayerAreaProps) {
  return (
    <div className={`player-area ${status !== 'active' ? 'inactive' : ''}`}>
      <div className="player-header">
        <span className="player-name">
          {name} {!connected && '(disconnected)'} {status !== 'active' && `— ${status}`}
        </span>
        <span className="life">
          <button onClick={() => onLifeDelta(-1)}>-1</button>
          {life}
          <button onClick={() => onLifeDelta(1)}>+1</button>
        </span>
        <span className="counts">
          Hand: {handCount} · Library: {libraryCount}
        </span>
      </div>

      {commandZone.length > 0 && (
        <div className="command-zone">
          {commandZone.map((obj) => (
            <CardTile key={obj.id} obj={obj} />
          ))}
        </div>
      )}

      <div className="battlefield">
        {battlefield.map((obj) => (
          <div key={obj.id} className="battlefield-slot">
            <CardTile obj={obj} onClick={() => onTapToggle(obj)} />
            {onGraveyard && !isRedacted(obj) && (
              <button className="gy-button" onClick={() => onGraveyard(obj)}>
                GY
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
