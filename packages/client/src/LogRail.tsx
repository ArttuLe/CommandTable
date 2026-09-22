// The log (§15.1: "with no engine arbitrating, the log is the referee") docked beside the table
// instead of inside a modal.
//
// The modal's real problem wasn't where it sat, it was that nothing reached you until you went
// looking: a chat message or a dice roll was invisible until someone opened it. So the rail
// collapses to a strip with an unread count, and anything you can't afford to miss — chat,
// random results, other players' actions — also surfaces as a transient toast.

import { useEffect, useRef, useState } from 'react';
import type { LogEntry, PlayerId, PlayerState } from '@command-table/common';

const TOAST_MS = 5000;
const MAX_TOASTS = 3;
// Kept in step with the `.toast.leaving` fade in styles.css: an expired toast is marked, left
// on screen long enough to fade, and only then dropped.
const TOAST_FADE_MS = 300;

/** Stable per-player accent so the log is scannable by color, not just by name. */
export function playerHue(players: readonly PlayerState[], playerId: PlayerId): number {
  const index = players.findIndex((p) => p.id === playerId);
  return index < 0 ? 0 : (index * 97) % 360;
}

export function LogRail({
  log,
  players,
  myId,
  open,
  onToggle,
  onSend,
}: {
  log: LogEntry[];
  players: PlayerState[];
  myId: PlayerId;
  open: boolean;
  onToggle: () => void;
  onSend: (text: string) => void;
}) {
  const [seenCount, setSeenCount] = useState(log.length);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSeenCount(log.length);
  }, [open, log.length]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, log.length]);

  const unread = Math.max(0, log.length - seenCount);

  if (!open) {
    return (
      <button className="log-strip" onClick={onToggle} title="Open log & chat">
        <span className="log-strip-label">Log &amp; chat</span>
        {unread > 0 && <span className="unread-badge">{unread}</span>}
      </button>
    );
  }

  return (
    <aside className="log-rail">
      <div className="rail-header">
        <span>Log &amp; chat</span>
        <button className="icon-button" onClick={onToggle} title="Collapse">
          ›
        </button>
      </div>

      <div className="log" ref={listRef}>
        {log.map((entry, i) => (
          <LogLine key={i} entry={entry} players={players} myId={myId} />
        ))}
      </div>

      <ChatBox onSend={onSend} />
    </aside>
  );
}

function LogLine({ entry, players, myId }: { entry: LogEntry; players: PlayerState[]; myId: PlayerId }) {
  const actor = players.find((p) => p.id === entry.actorId);
  const name = actor?.displayName ?? entry.actorId;
  return (
    <p className={`log-line ${entry.kind ? `log-${entry.kind}` : ''} ${entry.actorId === myId ? 'log-mine' : ''}`}>
      <strong style={{ color: `hsl(${playerHue(players, entry.actorId)} 65% 72%)` }}>{name}</strong>{' '}
      {entry.kind === 'chat' ? <span className="log-chat-text">{entry.text}</span> : entry.text}
    </p>
  );
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
      <button className="btn" type="submit">
        Send
      </button>
    </form>
  );
}

/**
 * Transient copies of log entries you'd otherwise miss while the rail is collapsed. Your own
 * actions are skipped — you just took them — except chat and dice, which are worth echoing.
 */
export function Toasts({
  log,
  players,
  myId,
  railOpen,
}: {
  log: LogEntry[];
  players: PlayerState[];
  myId: PlayerId;
  railOpen: boolean;
}) {
  const [toasts, setToasts] = useState<{ id: number; entry: LogEntry; expiresAt: number; leaving?: boolean }[]>([]);
  const seenRef = useRef(log.length);

  useEffect(() => {
    if (log.length <= seenRef.current) {
      seenRef.current = log.length; // an undo shortened the log
      return;
    }
    const expiresAt = Date.now() + TOAST_MS;
    const fresh = log
      .slice(seenRef.current)
      .filter((entry) => entry.actorId !== myId || entry.kind !== undefined)
      .map((entry, i) => ({ id: seenRef.current + i, entry, expiresAt }));
    seenRef.current = log.length;
    if (fresh.length === 0) return;

    setToasts((current) => [...current, ...fresh].slice(-MAX_TOASTS));
  }, [log, myId]);

  // Each toast carries its own deadline and one timer waits for the nearest, rather than each
  // batch owning a timer: a batch's timer was cancelled by the next log entry arriving, which
  // left the toasts it was meant to clear on screen for the rest of the game. Expiry only marks
  // a toast; the fade is what removes it.
  useEffect(() => {
    const live = toasts.filter((t) => !t.leaving);
    if (live.length === 0) return;
    const soonest = Math.min(...live.map((t) => t.expiresAt));
    const timer = setTimeout(() => {
      const now = Date.now();
      setToasts((current) => current.map((t) => (t.expiresAt <= now ? { ...t, leaving: true } : t)));
    }, Math.max(0, soonest - Date.now()));
    return () => clearTimeout(timer);
  }, [toasts]);

  useEffect(() => {
    if (!toasts.some((t) => t.leaving)) return;
    const timer = setTimeout(() => setToasts((current) => current.filter((t) => !t.leaving)), TOAST_FADE_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div className={`toasts ${railOpen ? 'rail-open' : ''}`}>
      {toasts.map(({ id, entry, leaving }) => {
        const name = players.find((p) => p.id === entry.actorId)?.displayName ?? entry.actorId;
        return (
          <div key={id} className={`toast ${entry.kind ? `toast-${entry.kind}` : ''} ${leaving ? 'leaving' : ''}`}>
            <strong style={{ color: `hsl(${playerHue(players, entry.actorId)} 65% 72%)` }}>{name}</strong> {entry.text}
          </div>
        );
      })}
    </div>
  );
}
