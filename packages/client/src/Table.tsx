import { useState } from 'react';
import { isRedacted, type GameObject, type ObjectId, type PlayerId, type PlayerState, type ProjectedObject } from '@command-table/common';
import { useStore } from './store.js';
import { CardTile } from './CardTile.js';
import { useCard } from './useCard.js';
import { ContextMenu } from './ContextMenu.js';

function isOwnZone(obj: ProjectedObject, playerId: PlayerId, zone: string): boolean {
  return 'playerId' in obj.zone && obj.zone.playerId === playerId && obj.zone.zone === zone;
}

const COMMANDER_DAMAGE_LETHAL = 21;

export function Table() {
  const tableState = useStore((s) => s.tableState)!;
  const playerId = useStore((s) => s.playerId)!;
  const act = useStore((s) => s.act);
  const pendingUndoRequest = useStore((s) => s.pendingUndoRequest);
  const send = useStore((s) => s.send);

  const [menu, setMenu] = useState<{ obj: ProjectedObject; x: number; y: number } | null>(null);
  const openMenu = (obj: ProjectedObject) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ obj, x: e.clientX, y: e.clientY });
  };

  const objects = Object.values(tableState.objects);
  const opponents = tableState.players.filter((p) => p.id !== playerId);
  const me = tableState.players.find((p) => p.id === playerId);

  const battlefieldOf = (pid: PlayerId) => objects.filter((o) => isOwnZone(o, pid, 'battlefield'));
  const commandZoneOf = (pid: PlayerId) => objects.filter((o) => isOwnZone(o, pid, 'commandZone'));
  const myHand = objects.filter((o) => isOwnZone(o, playerId, 'hand'));
  // Only cards SEARCH_LIBRARY/PEEK_TOP made visible show up here at all — everything else in a
  // library is omitted from tableState.objects entirely (§9.2), never fetched or rendered.
  const myVisibleLibrary = objects.filter((o) => isOwnZone(o, playerId, 'library'));

  // §12.3: a row per commander on the table, for every player's damage-taken column.
  const allCommanders = tableState.players.flatMap((owner) =>
    owner.commanderIds.map((id) => ({ id, ownerName: owner.displayName, obj: tableState.objects[id] }))
  );

  return (
    <div className="table">
      <div className="opponents">
        {opponents.map((p) => (
          <PlayerArea
            key={p.id}
            player={p}
            handCount={tableState.handCounts[p.id]}
            libraryCount={tableState.libraryCounts[p.id]}
            battlefield={battlefieldOf(p.id)}
            commandZone={commandZoneOf(p.id)}
            allCommanders={allCommanders}
            onLifeDelta={(delta) => act({ t: 'SET_LIFE', playerIds: [p.id], update: { mode: 'delta', amount: delta } })}
            onPoisonDelta={(delta) => act({ t: 'SET_PLAYER_COUNTER', playerId: p.id, key: 'poison', update: { mode: 'delta', amount: delta } })}
            onTapToggle={(obj) => act({ t: obj.tapped ? 'UNTAP' : 'TAP', objectId: obj.id })}
            onCommanderDamageDelta={(fromCommanderObjectId, delta) =>
              act({ t: 'SET_COMMANDER_DAMAGE', toPlayerId: p.id, fromCommanderObjectId, update: { mode: 'delta', amount: delta } })
            }
            onObjectContextMenu={openMenu}
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
          <button onClick={() => act({ t: 'SEARCH_LIBRARY', playerId })}>Search library</button>
          <button
            onClick={() => {
              const countText = window.prompt('Look at the top how many cards?', '1');
              const count = Number(countText);
              if (Number.isFinite(count) && count > 0) act({ t: 'PEEK_TOP', playerId, count });
            }}
          >
            Peek top…
          </button>
          <button
            onClick={() => {
              const sidesText = window.prompt('Roll a d__?', '6');
              const sides = Number(sidesText);
              if (Number.isFinite(sides) && sides >= 2) act({ t: 'ROLL_DICE', playerId, sides });
            }}
          >
            Roll dice…
          </button>
          <button onClick={() => act({ t: 'FLIP_COIN', playerId })}>Flip coin</button>
          <button
            onClick={() => {
              const name = window.prompt('Token name:', 'Squirrel');
              if (!name) return;
              const typeLine = window.prompt('Type line:', 'Token Creature — Squirrel') ?? '';
              const power = window.prompt('Power (blank if none):', '1') || undefined;
              const toughness = window.prompt('Toughness (blank if none):', '1') || undefined;
              const quantityText = window.prompt('Quantity:', '1');
              const quantity = Number(quantityText);
              if (!Number.isFinite(quantity) || quantity < 1) return;
              act({
                t: 'CREATE_TOKEN',
                ownerId: playerId,
                zone: { playerId, zone: 'battlefield' },
                source: { adhoc: { name, typeLine, power, toughness } },
                quantity,
              });
            }}
          >
            Create token…
          </button>
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

        <ChatBox onSend={(text) => act({ t: 'SAY', playerId, text })} />
      </div>

      <div className="self-area">
        {me && (
          <PlayerArea
            player={me}
            handCount={tableState.handCounts[me.id]}
            libraryCount={tableState.libraryCounts[me.id]}
            battlefield={battlefieldOf(me.id)}
            commandZone={commandZoneOf(me.id)}
            allCommanders={allCommanders}
            onLifeDelta={(delta) => act({ t: 'SET_LIFE', playerIds: [me.id], update: { mode: 'delta', amount: delta } })}
            onPoisonDelta={(delta) => act({ t: 'SET_PLAYER_COUNTER', playerId: me.id, key: 'poison', update: { mode: 'delta', amount: delta } })}
            onTapToggle={(obj) => act({ t: obj.tapped ? 'UNTAP' : 'TAP', objectId: obj.id })}
            onGraveyard={(obj) => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: { playerId, zone: 'graveyard' } })}
            onCommanderDamageDelta={(fromCommanderObjectId, delta) =>
              act({ t: 'SET_COMMANDER_DAMAGE', toPlayerId: me.id, fromCommanderObjectId, update: { mode: 'delta', amount: delta } })
            }
            onCastCommander={(obj) => {
              // Two steps so §12.2's tax tracking (command zone -> stack) fires; the doc treats
              // the stack itself as a non-goal (§1.3: "no stack resolution"), so resolving
              // straight to the battlefield in the same click is a fair simplification.
              act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: { zone: 'stack' } });
              act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: { playerId, zone: 'battlefield' } });
            }}
            onObjectContextMenu={openMenu}
          />
        )}

        <div className="hand">
          {myHand.map((obj) => (
            <CardTile
              key={obj.id}
              obj={obj}
              onClick={() => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: { playerId, zone: 'battlefield' } })}
              onContextMenu={openMenu(obj)}
            />
          ))}
        </div>

        {myVisibleLibrary.length > 0 && (
          <div className="library-viewer">
            <p className="library-viewer-label">Library (searched/peeked — right-click a card to move it)</p>
            <div className="hand">
              {myVisibleLibrary
                .filter((o): o is GameObject => !isRedacted(o))
                .sort((a, b) => a.position - b.position)
                .map((obj) => (
                  <CardTile key={obj.id} obj={obj} onContextMenu={openMenu(obj)} />
                ))}
            </div>
          </div>
        )}
      </div>

      {menu && <ContextMenu obj={menu.obj} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </div>
  );
}

interface CommanderRef {
  id: ObjectId;
  ownerName: string;
  obj: ProjectedObject | undefined;
}

interface PlayerAreaProps {
  player: PlayerState;
  handCount: number;
  libraryCount: number;
  battlefield: ProjectedObject[];
  commandZone: ProjectedObject[];
  allCommanders: CommanderRef[];
  onLifeDelta: (delta: number) => void;
  onPoisonDelta: (delta: number) => void;
  onTapToggle: (obj: { id: string; tapped: boolean }) => void;
  onGraveyard?: (obj: GameObject) => void;
  onCommanderDamageDelta: (fromCommanderObjectId: ObjectId, delta: number) => void;
  onCastCommander?: (obj: GameObject) => void;
  onObjectContextMenu: (obj: ProjectedObject) => (e: React.MouseEvent) => void;
}

function PlayerArea({ player, handCount, libraryCount, battlefield, commandZone, allCommanders, onLifeDelta, onPoisonDelta, onTapToggle, onGraveyard, onCommanderDamageDelta, onCastCommander, onObjectContextMenu }: PlayerAreaProps) {
  const poison = player.counters.poison ?? 0;
  return (
    <div className={`player-area ${player.status !== 'active' ? 'inactive' : ''}`}>
      <div className="player-header">
        <span className="player-name">
          {player.displayName} {!player.connected && '(disconnected)'} {player.status !== 'active' && `— ${player.status}`}
        </span>
        <span className={`life ${player.life <= 0 ? 'lethal' : ''}`}>
          <button onClick={() => onLifeDelta(-1)}>-1</button>
          {player.life}
          <button onClick={() => onLifeDelta(1)}>+1</button>
        </span>
        <span className={`poison ${poison >= 10 ? 'lethal' : ''}`}>
          <button onClick={() => onPoisonDelta(-1)}>-1</button>
          Poison: {poison}
          <button onClick={() => onPoisonDelta(1)}>+1</button>
        </span>
        <span className="counts">
          Hand: {handCount} · Library: {libraryCount}
        </span>
      </div>

      {commandZone.length > 0 && (
        <div className="command-zone">
          {commandZone.map((obj) => (
            <CommanderTile
              key={obj.id}
              obj={obj}
              taxCount={player.commanderCastCount[obj.id] ?? 0}
              onCast={onCastCommander && !isRedacted(obj) ? () => onCastCommander(obj) : undefined}
              onContextMenu={onObjectContextMenu(obj)}
            />
          ))}
        </div>
      )}

      <div className="battlefield">
        {battlefield.map((obj) => (
          <BattlefieldSlot
            key={obj.id}
            obj={obj}
            onTapToggle={onTapToggle}
            onGraveyard={onGraveyard}
            onContextMenu={onObjectContextMenu(obj)}
          />
        ))}
        {/* §16.1: lands row vs. nonlands area "removes enormous visual noise". Since land-ness
            depends on card data that loads asynchronously per object, this uses a CSS ordering
            trick (lands first, a full-width spacer forces a line wrap, nonlands after) rather
            than pre-splitting into two arrays — a permanent may briefly render in the wrong
            group for one frame while its card data is still loading, then self-correct. */}
        <div className="battlefield-split" />
      </div>

      <table className="commander-damage">
        <tbody>
          {allCommanders.map((c) => {
            const damage = player.commanderDamageTaken[c.id] ?? 0;
            return (
              <tr key={c.id} className={damage >= COMMANDER_DAMAGE_LETHAL ? 'lethal' : ''}>
                <td>
                  <CommanderName commander={c} />
                </td>
                <td>
                  <button onClick={() => onCommanderDamageDelta(c.id, -1)}>-1</button>
                  {damage}
                  <button onClick={() => onCommanderDamageDelta(c.id, 1)}>+1</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function useIsLand(obj: ProjectedObject): boolean {
  const card = useCard(obj);
  if (!isRedacted(obj) && obj.source.kind === 'token' && obj.source.adhoc) {
    return obj.source.adhoc.typeLine.includes('Land');
  }
  return card?.typeLine.includes('Land') ?? false;
}

function BattlefieldSlot({
  obj,
  onTapToggle,
  onGraveyard,
  onContextMenu,
}: {
  obj: ProjectedObject;
  onTapToggle: (obj: { id: string; tapped: boolean }) => void;
  onGraveyard?: (obj: GameObject) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const isLand = useIsLand(obj);
  return (
    <div className="battlefield-slot" style={{ order: isLand ? 0 : 2 }}>
      <CardTile obj={obj} onClick={() => onTapToggle(obj)} onContextMenu={onContextMenu} />
      {onGraveyard && !isRedacted(obj) && (
        <button className="gy-button" onClick={() => onGraveyard(obj)}>
          GY
        </button>
      )}
    </div>
  );
}

function CommanderTile({
  obj,
  taxCount,
  onCast,
  onContextMenu,
}: {
  obj: ProjectedObject;
  taxCount: number;
  onCast?: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const tax = taxCount * 2;
  return (
    <div className="commander-tile">
      <CardTile obj={obj} onClick={onCast} onContextMenu={onContextMenu} />
      {tax > 0 && <span className="tax-badge">+{tax}</span>}
    </div>
  );
}

function CommanderName({ commander }: { commander: CommanderRef }) {
  const card = useCard(commander.obj);
  return <>{card ? card.name : `${commander.ownerName}'s commander`}</>;
}

function ChatBox({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText('');
  }
  return (
    <form className="chat-box" onSubmit={submit}>
      <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something…" />
      <button type="submit">Send</button>
    </form>
  );
}
