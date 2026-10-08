import React from 'react';
import { Ticket } from '../types/ticket.ts';
import { Lock, Unlock, ShieldAlert, Clock, Building, Tag, CheckCircle2, AlertTriangle } from 'lucide-react';

interface TicketCardProps {
  ticket: Ticket;
  lockedBy: string | undefined;
  currentSocketId: string | undefined;
  isProcessing: boolean;
  onLock: (ticketId: string) => void;
  onUnlock: (ticketId: string) => void;
}

export const TicketCard: React.FC<TicketCardProps> = ({
  ticket,
  lockedBy,
  currentSocketId,
  isProcessing,
  onLock,
  onUnlock,
}) => {
  const isLocked = Boolean(lockedBy);
  const isOwnedByMe = isLocked && lockedBy === currentSocketId;
  const isLockedByOther = isLocked && !isOwnedByMe;

  const priorityColor = {
    Critical: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    High: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
    Medium: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
    Low: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  }[ticket.priority];

  return (
    <div
      className={`relative flex flex-col justify-between rounded-xl border transition-all duration-200 ${
        isOwnedByMe
          ? 'bg-slate-900/90 border-indigo-500/60 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/40'
          : isLockedByOther
          ? 'bg-slate-900/60 border-amber-500/40 shadow-sm'
          : 'bg-slate-900/70 border-slate-800 hover:border-slate-700 hover:shadow-md'
      }`}
    >
      {/* Top Banner / Header */}
      <div className="p-5 pb-3">
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold tracking-wider text-slate-200">
              {ticket.id}
            </span>
            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${priorityColor}`}>
              {ticket.priority}
            </span>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {ticket.category}
            </span>
          </div>

          {/* Status Badge */}
          <div>
            {isOwnedByMe ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/40 animate-pulse">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                Locked by You
              </span>
            ) : isLockedByOther ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/40">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                Locked by Other
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                Available
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="font-semibold text-base text-slate-100 leading-snug line-clamp-1 mb-1">
          {ticket.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
          {ticket.description}
        </p>

        {/* Metadata Details */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-1.5 truncate">
            <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="truncate">{ticket.customer}</span>
          </div>
          <div className="flex items-center gap-1.5 justify-end">
            <Clock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span className="font-mono text-[11px] text-slate-300">{ticket.slaMinutesRemaining}m SLA rem.</span>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap mt-2">
          {ticket.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 text-[10px] text-slate-400 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700/60 font-mono"
            >
              <Tag className="w-2.5 h-2.5 text-slate-500" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* Lock Holder Banner & Actions */}
      <div className="mt-3 p-4 pt-3 bg-slate-950/40 rounded-b-xl border-t border-slate-800/60 flex items-center justify-between gap-3">
        {/* Ownership Info */}
        <div className="text-xs truncate max-w-[210px]">
          {isOwnedByMe ? (
            <div className="flex flex-col">
              <span className="text-[11px] text-indigo-300 font-medium">Your Active Lock</span>
              <span className="font-mono text-[10px] text-slate-400 truncate">
                Socket: {currentSocketId}
              </span>
            </div>
          ) : isLockedByOther ? (
            <div className="flex flex-col">
              <span className="text-[11px] text-amber-300 font-medium">Locked by Peer</span>
              <span className="font-mono text-[10px] text-slate-400 truncate" title={lockedBy}>
                Socket: {lockedBy}
              </span>
            </div>
          ) : (
            <div className="flex flex-col">
              <span className="text-[11px] text-emerald-400 font-medium">Ready for Triage</span>
              <span className="text-[10px] text-slate-500">Unclaimed in queue</span>
            </div>
          )}
        </div>

        {/* Action Button */}
        <div>
          {isOwnedByMe ? (
            <button
              onClick={() => onUnlock(ticket.id)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              title="Release lock and return ticket to queue"
            >
              <Unlock className="w-3.5 h-3.5" />
              Unlock
            </button>
          ) : isLockedByOther ? (
            <button
              disabled
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800/80 text-slate-500 border border-slate-700/60 cursor-not-allowed"
              title="Ticket is locked by another agent"
            >
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              Locked
            </button>
          ) : (
            <button
              onClick={() => onLock(ticket.id)}
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              title="Acquire authoritative lock on this ticket"
            >
              <Lock className="w-3.5 h-3.5" />
              Lock Ticket
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
