export type TicketPriority = 'Critical' | 'High' | 'Medium' | 'Low';
export type TicketCategory = 'Infrastructure' | 'Payments' | 'Authentication' | 'API' | 'Data';

export interface Ticket {
  id: string;
  title: string;
  customer: string;
  category: TicketCategory;
  priority: TicketPriority;
  createdAt: string;
  description: string;
  slaMinutesRemaining: number;
  tags: string[];
}

export interface LockStateItem {
  ticketId: string;
  lockedBy: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  type: 'ticket_locked' | 'ticket_unlocked' | 'lock_rejected' | 'unlock_rejected' | 'lock_state' | 'connect' | 'disconnect';
  ticketId?: string;
  socketId?: string;
  message: string;
  severity: 'info' | 'success' | 'warning' | 'error';
}

export type ConnectionStatus = 'connected' | 'disconnected' | 'reconnecting' | 'connecting';
