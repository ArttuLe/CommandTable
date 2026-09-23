# Playing with a friend

There is no hosted server and no VPS (§14.5 stays unreached on purpose). Whoever is hosting
tonight runs the server on their own machine; the role can swap game to game. What has to cross
the internet is one person's laptop, so the connection is set up with
[Tailscale](https://tailscale.com) — a WireGuard mesh that hole-punches a **direct, end-to-end
encrypted link** between the two machines, with no port forwarding and nothing exposed publicly.

Once, on both machines:

1. Install Tailscale, sign in, and make sure you are both on the same tailnet (the owner shares
   an invite; or share the single hosting machine as a node).
2. `npm install` and `npm run ingest --workspace @command-table/server`. The card index is a
   gitignored per-machine cache, so **everyone who might host needs their own** — a guest
   doesn't.

Per game, on the hosting machine:

3. `npm run host`. It starts the server and the client together and prints the link to send,
   already assembled from your tailnet name, along with the passphrase:

   ```
   Send your friend:  http://thinkpad.tail9c2f.ts.net:5173   (Tailscale)
   Passphrase:        SWAMP7
   ```

   Set `HOST_SECRET` to choose the passphrase instead of having one generated. If Tailscale
   isn't running it falls back to a LAN address and says so — that link only reaches your own
   network.
4. Send your friend that link and passphrase, plus the room code once you've made a room.

Guests need neither an ingested card index nor a checkout — just the URL, the passphrase, and a
browser. There is deliberately no `npm run guest`: a guest opens the link, and that is the whole
guest experience.

To run the two halves separately (debugging one of them, say), the underlying commands are still
`npm run dev --workspace @command-table/server` and `... @command-table/client`.

## Why it is set up this way

- **No HTTPS, deliberately.** Tailscale already encrypts every packet between the two machines,
  so plain `http`/`ws` over the tailnet is not in the clear — adding TLS on top would buy
  nothing and cost certificate handling.
- **Never port-forward :8080 or :5173 to the open internet.** The passphrase stops a stranger
  taking a seat, but the server does no rate limiting and no validation of inbound message
  shapes; it is built to sit on a trusted network. Tailscale is what keeps it there.
- **The host is still authoritative.** This is peer-to-peer only in the sense that there is no
  VPS — the hosting machine remains the referee that holds hidden information, so `projection.ts`
  (§9.1) is what keeps your hand out of your opponent's client, exactly as it does locally.
