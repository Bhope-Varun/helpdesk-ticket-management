import { io, Socket } from 'socket.io-client';

// Shared socket instance connecting to current origin
export const socket: Socket = io({
  autoConnect: true,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 10000,
});
