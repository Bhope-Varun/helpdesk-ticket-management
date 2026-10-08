import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { socket } from '../socket.ts';
import { Ticket, LockStateItem, AuditEvent, ConnectionStatus } from '../types/ticket.ts';
import { INITIAL_TICKETS } from '../../server/data/tickets.ts';
import { TicketCard } from './TicketCard.tsx';
import { AuditFeed } from './AuditFeed.tsx';
import { TestControlPanel } from './TestControlPanel.tsx';
import {
  Shield,
  Wifi,
  WifiOff,
  RefreshCw,
  Search,
  Filter,
  CheckCircle,
  Lock,
  Unlock,
  AlertCircle,
  Copy,
  Check,
  Radio,
  Server,
  Sparkles,
} from 'lucide-react';

interface Toast {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message: string;
}

export const TicketDashboard: React.FC = () => {
  const [tickets, setTickets] = useState<Ticket[]>(INITIAL_TICKETS);
  const [locks, setLocks] = useState<Map<string, string>>(new Map());
  const [currentSocketId, setCurrentSocketId] = useState<string | undefined>(socket.id);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>(
    socket.connected ? 'connected' : 'connecting'
  );
  const [processingTicketIds, setProcessingTicketIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'available' | 'my_locks' | 'other_locks'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copiedSocket, setCopiedSocket] = useState(false);

  // Helper to append audit logs
  const addAuditLog = useCallback(
    (
      type: AuditEvent['type'],
      message: string,
      severity: AuditEvent['severity'],
      ticketId?: string,
      socketId?: string
    ) => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newEvent: AuditEvent = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: timeStr,
        type,
        message,
        severity,
        ticketId,
        socketId,
      };
      setAuditEvents((prev) => [newEvent, ...prev.slice(0, 99)]);
    },
    []
  );

  // Helper to push ephemeral toast notification
  const addToast = useCallback((type: Toast['type'], title: string, message: string) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev, { id, type, title, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  // Socket connection and event listeners
  useEffect(() => {
    function handleConnect() {
      setCurrentSocketId(socket.id);
      setConnectionStatus('connected');
      addAuditLog('connect', `Connected to server with socket ID ${socket.id}`, 'success', undefined, socket.id);
      addToast('success', 'Connected', `Established socket session ${socket.id?.slice(0, 8)}...`);

      // Immediately request current complete lock state
      socket.emit('join_dashboard');
    }

    function handleDisconnect(reason: string) {
      setConnectionStatus('disconnected');
      addAuditLog('disconnect', `Socket disconnected (${reason})`, 'error', undefined, socket.id);
      addToast('warning', 'Disconnected', `Socket disconnected: ${reason}`);
    }

    function handleConnectError(err: Error) {
      setConnectionStatus('disconnected');
      addAuditLog('disconnect', `Connection error: ${err.message}`, 'error');
    }

    function handleReconnecting() {
      setConnectionStatus('reconnecting');
    }

    // Server sends full lock state
    function handleLockState(state: LockStateItem[]) {
      const newMap = new Map<string, string>();
      if (Array.isArray(state)) {
        state.forEach((item) => {
          if (item.ticketId && item.lockedBy) {
            newMap.set(item.ticketId, item.lockedBy);
          }
        });
      }
      setLocks(newMap);
      addAuditLog('lock_state', `Synced ${newMap.size} active lock(s) from server authoritative state`, 'info');
    }

    // Server broadcasts ticket_locked
    function handleTicketLocked(payload: { ticketId: string; lockedBy: string }) {
      if (!payload || !payload.ticketId) return;

      setLocks((prev) => {
        const next = new Map(prev);
        next.set(payload.ticketId, payload.lockedBy);
        return next;
      });

      setProcessingTicketIds((prev) => {
        const next = new Set(prev);
        next.delete(payload.ticketId);
        return next;
      });

      const isMe = payload.lockedBy === socket.id;
      addAuditLog(
        'ticket_locked',
        isMe
          ? `You locked ${payload.ticketId}`
          : `${payload.ticketId} locked by socket ${payload.lockedBy}`,
        isMe ? 'success' : 'warning',
        payload.ticketId,
        payload.lockedBy
      );

      if (isMe) {
        addToast('success', 'Ticket Locked', `Authoritative lock acquired on ${payload.ticketId}`);
      }
    }

    // Server broadcasts ticket_unlocked
    function handleTicketUnlocked(payload: { ticketId: string; reason?: string }) {
      if (!payload || !payload.ticketId) return;

      setLocks((prev) => {
        const next = new Map(prev);
        next.delete(payload.ticketId);
        return next;
      });

      setProcessingTicketIds((prev) => {
        const next = new Set(prev);
        next.delete(payload.ticketId);
        return next;
      });

      const reasonDesc =
        payload.reason === 'owner_disconnected'
          ? 'Auto-released (client disconnected)'
          : 'Released manually by owner';

      addAuditLog(
        'ticket_unlocked',
        `${payload.ticketId} unlocked: ${reasonDesc}`,
        'info',
        payload.ticketId
      );

      if (payload.reason === 'owner_disconnected') {
        addToast('info', 'Lock Auto-Released', `${payload.ticketId} unlocked due to client disconnect`);
      }
    }

    // Server rejects lock request
    function handleLockRejected(payload: { ticketId: string; reason: string; currentOwner?: string }) {
      if (payload && payload.ticketId) {
        setProcessingTicketIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.ticketId);
          return next;
        });
      }

      addAuditLog(
        'lock_rejected',
        `Lock rejected for ${payload.ticketId}: ${payload.reason}`,
        'error',
        payload.ticketId,
        payload.currentOwner
      );

      addToast('error', 'Lock Rejected', payload.reason || 'Failed to acquire lock');
    }

    // Server rejects unlock request
    function handleUnlockRejected(payload: { ticketId: string; reason: string; currentOwner?: string }) {
      if (payload && payload.ticketId) {
        setProcessingTicketIds((prev) => {
          const next = new Set(prev);
          next.delete(payload.ticketId);
          return next;
        });
      }

      addAuditLog(
        'unlock_rejected',
        `Unlock rejected for ${payload.ticketId}: ${payload.reason}`,
        'warning',
        payload.ticketId,
        payload.currentOwner
      );

      addToast('error', 'Unlock Rejected', payload.reason || 'Failed to unlock ticket');
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', handleConnectError);
    socket.io.on('reconnect_attempt', handleReconnecting);
    socket.on('lock_state', handleLockState);
    socket.on('ticket_locked', handleTicketLocked);
    socket.on('ticket_unlocked', handleTicketUnlocked);
    socket.on('lock_rejected', handleLockRejected);
    socket.on('unlock_rejected', handleUnlockRejected);

    // Initial check if already connected
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error', handleConnectError);
      socket.io.off('reconnect_attempt', handleReconnecting);
      socket.off('lock_state', handleLockState);
      socket.off('ticket_locked', handleTicketLocked);
      socket.off('ticket_unlocked', handleTicketUnlocked);
      socket.off('lock_rejected', handleLockRejected);
      socket.off('unlock_rejected', handleUnlockRejected);
    };
  }, [addAuditLog, addToast]);

  // Request lock
  const handleLock = useCallback(
    (ticketId: string) => {
      if (!socket.connected) {
        addToast('error', 'Cannot Lock', 'Socket is disconnected. Please reconnect first.');
        return;
      }
      setProcessingTicketIds((prev) => new Set(prev).add(ticketId));
      socket.emit('lock_ticket', { ticketId });
    },
    [addToast]
  );

  // Request unlock
  const handleUnlock = useCallback(
    (ticketId: string) => {
      if (!socket.connected) {
        addToast('error', 'Cannot Unlock', 'Socket is disconnected.');
        return;
      }
      setProcessingTicketIds((prev) => new Set(prev).add(ticketId));
      socket.emit('unlock_ticket', { ticketId });
    },
    [addToast]
  );

  // QA test helpers
  const handleSimulateDisconnect = useCallback(() => {
    socket.disconnect();
    setConnectionStatus('disconnected');
    addToast('warning', 'Socket Disconnected', 'Manual disconnect triggered. Server is auto-releasing all tickets owned by this socket.');
  }, [addToast]);

  const handleSimulateReconnect = useCallback(() => {
    socket.connect();
    setConnectionStatus('connecting');
    addToast('info', 'Reconnecting...', 'Establishing new socket connection...');
  }, [addToast]);

  const handleLockMultiple = useCallback(
    (ticketIds: string[]) => {
      if (!socket.connected) {
        addToast('error', 'Disconnected', 'Socket must be connected to acquire locks.');
        return;
      }
      ticketIds.forEach((id) => {
        setProcessingTicketIds((prev) => new Set(prev).add(id));
        socket.emit('lock_ticket', { ticketId: id });
      });
      addToast('info', 'Bulk Lock Sent', `Requested locks for ${ticketIds.join(', ')}`);
    },
    [addToast]
  );

  const handleResetAllLocks = useCallback(async () => {
    try {
      const res = await fetch('/api/locks/reset', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        addToast('info', 'Locks Reset', `Cleared ${data.clearedCount} active locks on server`);
      }
    } catch (err) {
      console.error(err);
      addToast('error', 'Reset Failed', 'Could not reset locks on server');
    }
  }, [addToast]);

  const handleCopySocketId = useCallback(() => {
    if (currentSocketId) {
      navigator.clipboard.writeText(currentSocketId);
      setCopiedSocket(true);
      setTimeout(() => setCopiedSocket(false), 2000);
    }
  }, [currentSocketId]);

  // Derived statistics
  const stats = useMemo(() => {
    const total = tickets.length;
    let lockedCount = 0;
    let myLocksCount = 0;

    tickets.forEach((t) => {
      const owner = locks.get(t.id);
      if (owner) {
        lockedCount++;
        if (owner === currentSocketId) {
          myLocksCount++;
        }
      }
    });

    const availableCount = total - lockedCount;
    const otherLocksCount = lockedCount - myLocksCount;

    return {
      total,
      available: availableCount,
      locked: lockedCount,
      myLocks: myLocksCount,
      otherLocks: otherLocksCount,
    };
  }, [tickets, locks, currentSocketId]);

  // Filtered tickets
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const owner = locks.get(t.id);
      const isLocked = Boolean(owner);
      const isMine = isLocked && owner === currentSocketId;
      const isOther = isLocked && !isMine;

      // Filter by mode
      if (filterMode === 'available' && isLocked) return false;
      if (filterMode === 'my_locks' && !isMine) return false;
      if (filterMode === 'other_locks' && !isOther) return false;

      // Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesId = t.id.toLowerCase().includes(q);
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesCustomer = t.customer.toLowerCase().includes(q);
        const matchesTag = t.tags.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesId && !matchesTitle && !matchesCustomer && !matchesTag) return false;
      }

      return true;
    });
  }, [tickets, locks, currentSocketId, filterMode, priorityFilter, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification Container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto p-3.5 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 flex items-start gap-3 ${
              toast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
                : toast.type === 'error'
                ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
                : toast.type === 'warning'
                ? 'bg-amber-950/90 border-amber-500/50 text-amber-200'
                : 'bg-indigo-950/90 border-indigo-500/50 text-indigo-200'
            }`}
          >
            {toast.type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
            {toast.type === 'warning' && <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
            {toast.type === 'info' && <Radio className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />}

            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold leading-tight">{toast.title}</div>
              <div className="text-[11px] opacity-90 mt-0.5 leading-snug">{toast.message}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Top Navigation */}
      <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          {/* Logo & System Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 ring-1 ring-white/10">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base tracking-tight text-white">Live Ops Helpdesk</h1>
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                  Realtime Locking
                </span>
              </div>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Server className="w-3 h-3 text-slate-500" />
                In-Memory Source of Truth
              </p>
            </div>
          </div>

          {/* Connection Status Badge & Socket Identity */}
          <div className="flex items-center gap-3">
            {/* Socket Identifier */}
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-950/70 border border-slate-800 text-xs text-slate-300">
              <span className="text-[11px] text-slate-400">Socket:</span>
              <span className="font-mono text-indigo-300 font-semibold max-w-[120px] truncate" title={currentSocketId}>
                {currentSocketId || 'Connecting...'}
              </span>
              <button
                onClick={handleCopySocketId}
                disabled={!currentSocketId}
                className="text-slate-500 hover:text-slate-300 ml-1 p-0.5 rounded transition-colors cursor-pointer"
                title="Copy socket ID"
              >
                {copiedSocket ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            {/* Connection Status Indicator */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${
                connectionStatus === 'connected'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : connectionStatus === 'reconnecting'
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
              }`}
            >
              {connectionStatus === 'connected' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="capitalize">{connectionStatus}</span>
                </>
              ) : connectionStatus === 'reconnecting' ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-amber-400" />
                  <span>Reconnecting</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-rose-400" />
                  <span>Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Layout */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full flex flex-col gap-6">
        {/* Testing Bench & Demonstration Banner */}
        <TestControlPanel
          connectionStatus={connectionStatus}
          currentSocketId={currentSocketId}
          ownedLockCount={stats.myLocks}
          onSimulateDisconnect={handleSimulateDisconnect}
          onSimulateReconnect={handleSimulateReconnect}
          onLockMultiple={handleLockMultiple}
          onResetAllLocks={handleResetAllLocks}
        />

        {/* Real-time Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
              Total Queue
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-white font-mono">{stats.total}</span>
              <span className="text-xs text-slate-500">Tickets</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5" />
              Available
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-emerald-400 font-mono">{stats.available}</span>
              <span className="text-xs text-slate-500">Unclaimed</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Locked by You
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-indigo-300 font-mono">{stats.myLocks}</span>
              <span className="text-xs text-slate-500">In Progress</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800">
            <div className="text-[11px] font-medium text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Locked by Peers
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-2xl font-bold text-amber-400 font-mono">{stats.otherLocks}</span>
              <span className="text-xs text-slate-500">Other Agents</span>
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-slate-900/70 rounded-xl border border-slate-800">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                filterMode === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setFilterMode('available')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                filterMode === 'available'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Available ({stats.available})
            </button>
            <button
              onClick={() => setFilterMode('my_locks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                filterMode === 'my_locks'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              My Locks ({stats.myLocks})
            </button>
            <button
              onClick={() => setFilterMode('other_locks')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                filterMode === 'other_locks'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              Peer Locks ({stats.otherLocks})
            </button>
          </div>

          {/* Search & Priority Filter */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search ticket, customer, tag..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950/70 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500 transition-colors cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>

        {/* Dashboard 2-Column Grid: Tickets List & Live Audit Stream */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Tickets Column (8 cols) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-200 uppercase tracking-wide">
                Active Incident Queue
              </h2>
              <span className="text-xs text-slate-400">
                Showing {filteredTickets.length} of {tickets.length} tickets
              </span>
            </div>

            {filteredTickets.length === 0 ? (
              <div className="p-12 text-center rounded-xl bg-slate-900/40 border border-slate-800 text-slate-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-500" />
                <p className="text-sm font-medium">No tickets match the current filters.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try clearing search or changing the status filter.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredTickets.map((ticket) => (
                  <TicketCard
                    key={ticket.id}
                    ticket={ticket}
                    lockedBy={locks.get(ticket.id)}
                    currentSocketId={currentSocketId}
                    isProcessing={processingTicketIds.has(ticket.id)}
                    onLock={handleLock}
                    onUnlock={handleUnlock}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Real-time Wire Protocol & Audit Log Column (4 cols) */}
          <div className="lg:col-span-4 sticky top-20 flex flex-col gap-4">
            <div className="h-[600px]">
              <AuditFeed
                events={auditEvents}
                onClear={() => setAuditEvents([])}
              />
            </div>

            {/* Architecture Explainer Card */}
            <div className="bg-slate-900/60 rounded-xl border border-slate-800/80 p-4 text-xs text-slate-400 space-y-2">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-indigo-400" />
                Concurrency Safety Guarantee
              </div>
              <p className="text-[11px] leading-relaxed">
                Locks are coordinated via a synchronous Node.js <code className="text-indigo-300 font-mono">Map&lt;ticketId, socket.id&gt;</code>.
                No async await gaps exist between checking and reserving locks, preventing double-owner race conditions.
              </p>
              <p className="text-[11px] leading-relaxed">
                On client disconnection (<code className="text-slate-300 font-mono">socket.on(&apos;disconnect&apos;)</code>), the server automatically walks the lock table, purges all tickets held by the disconnected socket, and broadcasts instant releases to all peers.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-slate-900 bg-slate-950/80 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Live Ops Helpdesk &bull; Real-Time Ticket Locking System</span>
          <span className="font-mono text-[11px] text-slate-400">
            Node.js + Express + Socket.IO + In-Memory State
          </span>
        </div>
      </footer>
    </div>
  );
};
