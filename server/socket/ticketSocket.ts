import { Server, Socket } from 'socket.io';
import {
  lockTicket,
  unlockTicket,
  releaseTicketsForSocket,
  getLockState,
} from '../services/ticketLockService.ts';

export function registerTicketSocketHandlers(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Immediately send the current lock state or respond to join_dashboard
    socket.on('join_dashboard', () => {
      const currentLocks = getLockState();
      socket.emit('lock_state', currentLocks);
      console.log(`[Socket.IO] Sent lock_state (${currentLocks.length} locked) to ${socket.id}`);
    });

    // Handle lock_ticket request
    socket.on('lock_ticket', (payload: unknown) => {
      let ticketId: unknown = undefined;

      if (payload && typeof payload === 'object' && 'ticketId' in payload) {
        ticketId = (payload as { ticketId: unknown }).ticketId;
      } else if (typeof payload === 'string') {
        ticketId = payload;
      }

      const result = lockTicket(ticketId, socket.id);

      if (!result.success) {
        console.warn(`[Socket.IO] Lock rejected for ${ticketId} requested by ${socket.id}: ${result.reason}`);
        socket.emit('lock_rejected', {
          ticketId: result.ticketId || ticketId,
          reason: result.reason,
          currentOwner: result.currentOwner,
        });
        return;
      }

      console.log(`[Socket.IO] Ticket locked: ${result.ticketId} by ${socket.id}`);

      // Broadcast to every connected client
      io.emit('ticket_locked', {
        ticketId: result.ticketId,
        lockedBy: socket.id,
      });
    });

    // Handle unlock_ticket request
    socket.on('unlock_ticket', (payload: unknown) => {
      let ticketId: unknown = undefined;

      if (payload && typeof payload === 'object' && 'ticketId' in payload) {
        ticketId = (payload as { ticketId: unknown }).ticketId;
      } else if (typeof payload === 'string') {
        ticketId = payload;
      }

      const result = unlockTicket(ticketId, socket.id);

      if (!result.success) {
        console.warn(`[Socket.IO] Unlock rejected for ${ticketId} requested by ${socket.id}: ${result.reason}`);
        socket.emit('unlock_rejected', {
          ticketId: result.ticketId || ticketId,
          reason: result.reason,
          currentOwner: result.currentOwner,
        });
        return;
      }

      console.log(`[Socket.IO] Ticket unlocked: ${result.ticketId} by ${socket.id}`);

      // Broadcast release to all clients
      io.emit('ticket_unlocked', {
        ticketId: result.ticketId,
        reason: 'manual',
      });
    });

    // CRITICAL: Handle disconnect
    socket.on('disconnect', (reason: string) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} (reason: ${reason})`);

      // Find every ticket locked by this socket and release them
      const releasedTickets = releaseTicketsForSocket(socket.id);

      for (const ticketId of releasedTickets) {
        console.log(`[Socket.IO] Auto-released ticket: ${ticketId} because ${socket.id} disconnected`);

        io.emit('ticket_unlocked', {
          ticketId,
          reason: 'owner_disconnected',
        });
      }
    });
  });
}
