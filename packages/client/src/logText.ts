// A log line with its card named (§15.1: the log is the referee, and "tapped a permanent" settles
// nothing). The server writes each line with a generic subject — "a card", "a permanent" — and,
// when everyone could see the card, attaches a reference to it (LogEntry.subject). Resolved here,
// the name takes the place of that first generic subject; destinations ("a hand", "a library")
// come after it and are left as they are.

const GENERIC_SUBJECT = /\ba (card|permanent)\b/;

export function namedLogText(text: string, name: string | null): string {
  return name ? text.replace(GENERIC_SUBJECT, name) : text;
}
