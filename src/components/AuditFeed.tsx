import React from 'react';
import { AuditEvent } from '../types/ticket.ts';
import { Activity, Trash2, ArrowDownCircle, Check, X, ShieldAlert, Wifi, WifiOff } from 'lucide-react';

interface AuditFeedProps {
  events: AuditEvent[];
  onClear: () => void;
}

export const AuditFeed: React.FC<AuditFeedProps> = ({ events, onClear }) => {
  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 flex flex-col h-full overflow-hidden shadow-lg">
      <div className="p-3.5 px-4 border-b border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-400" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">
            Live Socket Event Stream
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
            {events.length} events
          </span>
        </div>

        <button
          onClick={onClear}
          className="text-slate-400 hover:text-slate-200 text-xs inline-flex items-center gap-1 hover:bg-slate-800/80 px-2 py-1 rounded transition-colors cursor-pointer"
          title="Clear audit log"
        >
          <Trash2 className="w-3 h-3" />
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2 font-mono text-xs">
        {events.length === 0 ? (
          <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-center p-4">
            <Activity className="w-6 h-6 mb-2 stroke-[1.5] text-slate-600 animate-pulse" />
            <p className="text-xs font-sans">No socket events captured yet.</p>
            <p className="text-[11px] font-sans text-slate-600 mt-1">
              Lock or unlock a ticket to view real-time wire protocol payloads.
            </p>
          </div>
        ) : (
          events.map((evt) => {
            const badgeClass = {
              success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
              warning: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
              error: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
              info: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
            }[evt.severity];

            const icon = {
              ticket_locked: <Check className="w-3 h-3 text-emerald-400 shrink-0" />,
              ticket_unlocked: <ArrowDownCircle className="w-3 h-3 text-sky-400 shrink-0" />,
              lock_rejected: <X className="w-3 h-3 text-rose-400 shrink-0" />,
              unlock_rejected: <ShieldAlert className="w-3 h-3 text-amber-400 shrink-0" />,
              lock_state: <Activity className="w-3 h-3 text-indigo-400 shrink-0" />,
              connect: <Wifi className="w-3 h-3 text-emerald-400 shrink-0" />,
              disconnect: <WifiOff className="w-3 h-3 text-rose-400 shrink-0" />,
            }[evt.type];

            return (
              <div
                key={evt.id}
                className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800/90 hover:border-slate-700/80 transition-colors"
              >
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <div className="flex items-center gap-1.5">
                    {icon}
                    <span className={`px-1.5 py-0.2 rounded text-[10px] uppercase font-semibold border ${badgeClass}`}>
                      {evt.type}
                    </span>
                    {evt.ticketId && (
                      <span className="font-bold text-slate-200">{evt.ticketId}</span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">{evt.timestamp}</span>
                </div>

                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  {evt.message}
                </p>

                {evt.socketId && (
                  <div className="mt-1 text-[10px] text-slate-500 truncate">
                    socket: <span className="text-slate-400">{evt.socketId}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
