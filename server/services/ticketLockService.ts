/**
 * Ticket Lock Service
 *
 * In-memory source of truth for all active ticket locks.
 * Guarantees atomic, synchronous checks and mutations to eliminate race conditions
 * within the single Node.js event-loop process.
 */

export interface LockStateItem {
  ticketId: string;
  lockedBy: string;
}

export interface LockResult {
  success: boolean;
  ticketId?: string;
  lockedBy?: string;
  reason?: string;
  currentOwner?: string;
}

export interface UnlockResult {
  success: boolean;
  ticketId?: string;
  reason?: string;
  currentOwner?: string;
}

// Authoritative in-memory Map: ticketId -> socket.id
const ticketLocks = new Map<string, string>();

/**
 * Normalizes and sanitizes ticket IDs.
 */
export function normalizeTicketId(ticketId: unknown): string | null {
  if (typeof ticketId !== 'string') {
    return null;
  }
  const trimmed = ticketId.trim().toUpperCase();
  if (!trimmed || trimmed.length > 50) {
    return null;
  }
  return trimmed;
}

/**
 * Synchronously checks and locks a ticket for a socket ID.
 * Atomic: no async operations between check and mutation.
 */
export function lockTicket(rawTicketId: unknown, socketId: string): LockResult {
  const ticketId = normalizeTicketId(rawTicketId);

  if (!ticketId) {
    return {
      success: false,
      reason: 'Invalid or missing ticket ID',
    };
  }

  if (!socketId || typeof socketId !== 'string') {
    return {
      success: false,
      reason: 'Invalid socket identifier',
    };
  }

  // Synchronous check & set to guarantee race condition safety
  const existingOwner = ticketLocks.get(ticketId);
  if (existingOwner) {
    return {
      success: false,
      ticketId,
      reason: existingOwner === socketId ? 'You already own this ticket lock' : 'Ticket is already locked',
      currentOwner: existingOwner,
    };
  }

  ticketLocks.set(ticketId, socketId);

  return {
    success: true,
    ticketId,
    lockedBy: socketId,
  };
}

/**
 * Unlocks a ticket if and only if the requesting socket ID owns the lock.
 */
export function unlockTicket(rawTicketId: unknown, socketId: string): UnlockResult {
  const ticketId = normalizeTicketId(rawTicketId);

  if (!ticketId) {
    return {
      success: false,
      reason: 'Invalid or missing ticket ID',
    };
  }

  const existingOwner = ticketLocks.get(ticketId);

  if (!existingOwner) {
    return {
      success: false,
      ticketId,
      reason: 'Ticket is not locked',
    };
  }

  if (existingOwner !== socketId) {
    return {
      success: false,
      ticketId,
      reason: 'You do not own this ticket lock',
      currentOwner: existingOwner,
    };
  }

  ticketLocks.delete(ticketId);

  return {
    success: true,
    ticketId,
  };
}

/**
 * Automatically releases all tickets owned by a disconnected socket.
 * Mandatory cleanup on socket disconnect.
 */
export function releaseTicketsForSocket(socketId: string): string[] {
  if (!socketId) return [];

  const releasedTickets: string[] = [];

  for (const [ticketId, ownerSocketId] of ticketLocks.entries()) {
    if (ownerSocketId === socketId) {
      ticketLocks.delete(ticketId);
      releasedTickets.push(ticketId);
    }
  }

  return releasedTickets;
}

/**
 * Returns the complete current lock state as a serializable array.
 */
export function getLockState(): LockStateItem[] {
  const state: LockStateItem[] = [];
  for (const [ticketId, lockedBy] of ticketLocks.entries()) {
    state.push({ ticketId, lockedBy });
  }
  return state;
}

/**
 * Helper to query single ticket lock owner
 */
export function getTicketOwner(rawTicketId: unknown): string | null {
  const ticketId = normalizeTicketId(rawTicketId);
  if (!ticketId) return null;
  return ticketLocks.get(ticketId) || null;
}

/**
 * Helper to clear all locks (used for testing/resets)
 */
export function clearAllLocks(): number {
  const count = ticketLocks.size;
  ticketLocks.clear();
  return count;
}
