// Reconnect delay. Retries are unbounded on purpose: a host restarting their server or rebooting
// their laptop is now a supported way to recover a game (see sessionStore.ts), so giving up after
// N attempts would abandon players right when the thing they're waiting for is about to work.

const BASE_MS = 500;
const CAP_MS = 8000;

export function nextDelay(attempt: number, random: () => number = Math.random): number {
  const capped = Math.min(BASE_MS * 2 ** attempt, CAP_MS);
  // Jitter keeps four clients that dropped together from retrying in lockstep.
  return Math.round(capped * (0.5 + random() * 0.5));
}
