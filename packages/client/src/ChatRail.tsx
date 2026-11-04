// Chat, on the left, opposite the log.
//
// It used to be the last few lines of the log rail, sharing a scroll with every tap and untap at
// the table — which meant a message could scroll out of sight between being sent and being read.
// On its own side it holds only what people said, so a conversation stays a conversation.
//
// Chat is shown here and only here — the log rail filters it out, so a message is read once.
// Both rails are views of the one server-side log, split by `kind`; this is not a second store.

import { useEffect, useRef, useState } from 'react';
import type { LogEntry, PlayerId, PlayerState } from '@command-table/common';
import { playerHue } from './LogRail.js';
import { chatEntries } from './logStreams.js';
import { SIGNALS } from './shortcuts.js';

export function ChatRail({
  log,
  players,
  open,
  onToggle,
  onSend,
}: {
  log: LogEntry[];
  players: PlayerState[];
  open: boolean;
  onToggle: () => void;
  onSend: (text: string) => void;
}) {
  const messages = chatEntries(log);
  const [seenCount, setSeenCount] = useState(messages.length);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setSeenCount(messages.length);
  }, [open, messages.length]);

  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [open, messages.length]);

  const unread = Math.max(0, messages.length - seenCount);

  if (!open) {
    return (
      <button className="chat-strip" onClick={onToggle} title="Open chat">
        <span className="log-strip-label">Chat</span>
        {unread > 0 && <span className="unread-badge">{unread}</span>}
      </button>
    );
  }

  return (
    <aside className="chat-rail">
      <div className="rail-header">
        <button className="icon-button" onClick={onToggle} title="Collapse">
          ‹
        </button>
        <span>Chat</span>
      </div>

      <div className="log" ref={listRef}>
        {messages.length === 0 ? (
          <p className="popover-note">Nothing said yet.</p>
        ) : (
          messages.map((entry, i) => {
            const name = players.find((p) => p.id === entry.actorId)?.displayName ?? entry.actorId;
            return (
              <p key={i} className="log-line log-chat">
                <strong style={{ color: `hsl(${playerHue(players, entry.actorId)} 65% 72%)` }}>{name}</strong>{' '}
                <span className="log-chat-text">{entry.text}</span>
              </p>
            );
          })
        )}
      </div>

      <ChatBox onSend={onSend} />
    </aside>
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
    <>
      <div className="chat-signals">
        {SIGNALS.map((signal) => (
          <button key={signal.key} className="btn btn-ghost" title={`Says "${signal.text}" — shortcut: ${signal.key.toUpperCase()}`} onClick={() => onSend(signal.text)}>
            {signal.label}
          </button>
        ))}
      </div>
      <form className="chat-box" onSubmit={submit}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Say something…" />
        <button className="btn" type="submit">
          Send
        </button>
      </form>
    </>
  );
}
