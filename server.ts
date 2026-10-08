import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import { registerTicketSocketHandlers } from './server/socket/ticketSocket.ts';
import { getLockState, clearAllLocks } from './server/services/ticketLockService.ts';
import { INITIAL_TICKETS } from './server/data/tickets.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    pingInterval: 10000,
    pingTimeout: 5000,
  });

  app.use(express.json());

  // REST API Routes
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'Live Ops Helpdesk',
      uptime: process.uptime(),
      activeLocksCount: getLockState().length,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/tickets', (_req, res) => {
    res.json(INITIAL_TICKETS);
  });

  app.get('/api/locks', (_req, res) => {
    res.json(getLockState());
  });

  app.post('/api/locks/reset', (_req, res) => {
    const cleared = clearAllLocks();
    io.emit('lock_state', []);
    res.json({ success: true, clearedCount: cleared });
  });

  // Register Socket.IO handlers
  registerTicketSocketHandlers(io);

  // Vite middleware in dev or static files in production
  const isProduction = process.env.NODE_ENV === 'production';
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Live Ops Helpdesk] Server listening on port ${PORT}`);
    console.log(`[Live Ops Helpdesk] Socket.IO ready on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
