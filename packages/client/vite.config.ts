import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    // host: bind all interfaces, not just loopback, so the friend you're hosting for can load
    // the page. allowedHosts: Vite rejects unrecognised Host headers, and the tailnet name the
    // friend types is one (see playing-with-a-friend.md).
    port: 5173,
    host: true,
    allowedHosts: ['.ts.net'],
  },
});
