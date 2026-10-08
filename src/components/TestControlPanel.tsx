import React from 'react';
import {
  FlaskConical,
  ExternalLink,
  WifiOff,
  Wifi,
  RotateCcw,
  CheckCircle2,
  Layers,
  Info,
} from 'lucide-react';
import { ConnectionStatus } from '../types/ticket.ts';

interface TestControlPanelProps {
  connectionStatus: ConnectionStatus;
  currentSocketId: string | undefined;
  ownedLockCount: number;
  onSimulateDisconnect: () => void;
  onSimulateReconnect: () => void;
  onLockMultiple: (ticketIds: string[]) => void;
  onResetAllLocks: () => void;
}

export const TestControlPanel: React.FC<TestControlPanelProps> = ({
  connectionStatus,
  currentSocketId,
  ownedLockCount,
  onSimulateDisconnect,
  onSimulateReconnect,
  onLockMultiple,
  onResetAllLocks,
}) => {
  const isConnected = connectionStatus === 'connected';

  const handleOpenSecondTab = () => {
    // Open another window/tab to test multi-client concurrency
    window.open(window.location.href, '_blank');
  };

  return (
    <div className="bg-slate-900/80 rounded-xl border border-slate-800 p-4 shadow-lg">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-200">
            Real-Time QA & Concurrency Bench
          </h3>
        </div>
        <span className="text-[11px] text-slate-400 font-mono">
          Authoritative In-Memory Map
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {/* Step 1: Open Second Tab */}
        <button
          onClick={handleOpenSecondTab}
          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/50 text-left transition-all cursor-pointer group"
          title="Open a duplicate tab with a distinct Socket.IO connection"
        >
          <div>
            <div className="text-xs font-semibold text-slate-200 group-hover:text-indigo-300">
              1. Open Second Tab
            </div>
            <div className="text-[11px] text-slate-400">
              Test multi-agent lock contention
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 shrink-0 ml-2" />
        </button>

        {/* Step 2: Simulate Disconnect */}
        {isConnected ? (
          <button
            onClick={onSimulateDisconnect}
            className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-rose-500/50 hover:bg-rose-950/20 text-left transition-all cursor-pointer group"
            title="Simulate sudden Wi-Fi drop / tab crash"
          >
            <div>
              <div className="text-xs font-semibold text-rose-300">
                2. Disconnect Socket
              </div>
              <div className="text-[11px] text-slate-400">
                Triggers server auto-cleanup
              </div>
            </div>
            <WifiOff className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
          </button>
        ) : (
          <button
            onClick={onSimulateReconnect}
            className="flex items-center justify-between p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/50 hover:bg-emerald-900/40 text-left transition-all cursor-pointer group"
            title="Reconnect to server and sync lock state"
          >
            <div>
              <div className="text-xs font-semibold text-emerald-300">
                Reconnect Socket
              </div>
              <div className="text-[11px] text-emerald-400/80">
                Join dashboard & sync state
              </div>
            </div>
            <Wifi className="w-4 h-4 text-emerald-400 shrink-0 ml-2" />
          </button>
        )}

        {/* Step 3: Test 5 Bulk Lock */}
        <button
          onClick={() => onLockMultiple(['TICKET-101', 'TICKET-102', 'TICKET-103'])}
          disabled={!isConnected}
          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-amber-500/50 hover:bg-amber-950/20 text-left transition-all cursor-pointer group disabled:opacity-50 disabled:cursor-not-allowed"
          title="Acquire TICKET-101, 102, 103 on this socket"
        >
          <div>
            <div className="text-xs font-semibold text-slate-200 group-hover:text-amber-300">
              3. Lock Multi (101-103)
            </div>
            <div className="text-[11px] text-slate-400">
              Verify Test 5 multi-release
            </div>
          </div>
          <Layers className="w-4 h-4 text-slate-500 group-hover:text-amber-400 shrink-0 ml-2" />
        </button>

        {/* Step 4: Reset All */}
        <button
          onClick={onResetAllLocks}
          className="flex items-center justify-between p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-800/40 text-left transition-all cursor-pointer group"
          title="Clear all active locks on server"
        >
          <div>
            <div className="text-xs font-semibold text-slate-300">
              Reset Server Locks
            </div>
            <div className="text-[11px] text-slate-500">
              Clear Map for clean QA run
            </div>
          </div>
          <RotateCcw className="w-4 h-4 text-slate-500 group-hover:text-slate-300 shrink-0 ml-2" />
        </button>
      </div>

      <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-2">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>
            Locks held by this tab: <strong className="text-slate-200 font-mono">{ownedLockCount}</strong>. Disconnecting immediately releases all of them across all tabs.
          </span>
        </div>
        <div className="font-mono text-[10px] text-slate-500">
          Client Socket: <span className="text-indigo-400">{currentSocketId || 'N/A'}</span>
        </div>
      </div>
    </div>
  );
};
