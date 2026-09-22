import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // host: bind all interfaces, not just loopback, so the friend you're hosting for can load
    // the page. allowedHosts: Vite rejects unrecognised Host headers, and the tailnet name the
    // friend types is one (see playing-with-a-friend.md).
    //
    // strictPort: `npm run host` prints the URL to send your friend before this starts, so a
    // silent fallback to 5174 would hand them a link to nothing. Fail loudly instead.
    port: Number(process.env.CLIENT_PORT ?? 5173),
    strictPort: true,
    host: true,
    allowedHosts: ['.ts.net'],
  },
});
