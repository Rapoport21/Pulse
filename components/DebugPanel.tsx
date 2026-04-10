import React, { useState } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import {
  useConnectionStatus,
  usePresence,
  useRealtimeLog,
  getDeviceId,
  getLatencyMs,
  broadcastReset,
  getRealtimeStateSnapshot,
} from '../lib/realtime';
import type { SurgeModeState } from '../lib/surgeTaskTemplates';
import type { UserProfile } from '../types';

interface DebugPanelProps {
  currentUser?: UserProfile | null;
}

export const DebugPanel: React.FC<DebugPanelProps> = ({ currentUser }) => {
  const status = useConnectionStatus();
  const presence = usePresence();
  const log = useRealtimeLog();
  const [collapsed, setCollapsed] = useState(false);

  const surge = getRealtimeStateSnapshot<SurgeModeState>('surge-mode') || {
    active: false,
    activatedAt: null,
  };

  const dotColor =
    status === 'connected' ? 'bg-emerald-500' : status === 'connecting' ? 'bg-amber-500' : 'bg-rose-500';

  return (
    <div className="fixed bottom-4 right-4 z-[1000] font-mono text-[11px] text-neutral-200 max-w-md w-[420px] bg-black/90 backdrop-blur border border-neutral-700 rounded-lg shadow-2xl">
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 cursor-pointer select-none"
        onClick={() => setCollapsed((c) => !c)}
      >
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${dotColor} shadow-[0_0_8px_currentColor]`}></span>
          <span className="font-bold uppercase tracking-widest text-neutral-400">PULSE Debug</span>
          <span className="text-neutral-500">{status}</span>
          <span className="text-neutral-600">· {getLatencyMs()}ms</span>
        </div>
        {collapsed ? <ChevronUp className="w-3 h-3 text-neutral-400" /> : <ChevronDown className="w-3 h-3 text-neutral-400" />}
      </div>

      {!collapsed && (
        <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
          {/* Identity */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded p-2">
            <div className="text-neutral-500 uppercase tracking-widest text-[9px] mb-1">Identity</div>
            <div>device: <span className="text-cyan-400">{getDeviceId().slice(0, 12)}…</span></div>
            <div>role: <span className="text-cyan-400">{currentUser?.role || '—'}</span></div>
            <div>user: <span className="text-cyan-400">{currentUser?.name || '—'}</span></div>
          </div>

          {/* Presence */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded p-2">
            <div className="text-neutral-500 uppercase tracking-widest text-[9px] mb-1">
              Presence — {presence.length} peer{presence.length === 1 ? '' : 's'}
            </div>
            {presence.length === 0 ? (
              <div className="text-neutral-600">no peers</div>
            ) : (
              <ul className="space-y-0.5">
                {presence.map((id) => (
                  <li key={id} className="truncate">
                    <span className={id === getDeviceId() ? 'text-emerald-400' : 'text-neutral-300'}>
                      {id.slice(0, 12)}{id === getDeviceId() ? ' (you)' : ''}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Surge snapshot */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded p-2">
            <div className="text-neutral-500 uppercase tracking-widest text-[9px] mb-1">Surge State</div>
            <div>active: <span className={surge.active ? 'text-rose-400' : 'text-emerald-400'}>{String(surge.active)}</span></div>
            {surge.activatedAt && (
              <div>activatedAt: <span className="text-neutral-400">{new Date(surge.activatedAt).toLocaleTimeString()}</span></div>
            )}
          </div>

          {/* Log */}
          <div className="bg-neutral-900/60 border border-neutral-800 rounded p-2">
            <div className="text-neutral-500 uppercase tracking-widest text-[9px] mb-1">
              Live Log ({log.length})
            </div>
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {log.length === 0 && <div className="text-neutral-600">no events</div>}
              {[...log].reverse().map((entry, i) => (
                <div key={i} className="leading-snug">
                  <span className="text-neutral-600">
                    {new Date(entry.ts).toLocaleTimeString().slice(0, 8)}
                  </span>{' '}
                  <span className={entry.direction === 'in' ? 'text-cyan-400' : 'text-amber-400'}>
                    {entry.direction === 'in' ? '←' : '→'}
                  </span>{' '}
                  <span className="text-neutral-300">{entry.type}</span>
                  {entry.key && <span className="text-purple-400"> [{entry.key}]</span>}
                  {entry.payloadPreview && (
                    <span className="text-neutral-500"> {entry.payloadPreview}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => {
              broadcastReset();
            }}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-rose-700/30 hover:bg-rose-700/50 border border-rose-700/50 rounded text-rose-300 text-[11px] font-bold uppercase tracking-widest"
          >
            <RotateCcw className="w-3 h-3" /> Reset demo state
          </button>
        </div>
      )}
    </div>
  );
};

/**
 * Always-visible tiny connection indicator. Renders a small dot in the bottom-left.
 */
export const ConnectionIndicator: React.FC = () => {
  const status = useConnectionStatus();
  const dotColor =
    status === 'connected'
      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]'
      : status === 'connecting'
        ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)]'
        : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]';
  return (
    <div className="fixed bottom-2 left-2 z-[999] flex items-center gap-1.5 px-2 py-1 bg-black/60 backdrop-blur border border-neutral-800 rounded-full pointer-events-none">
      <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
      <span className="text-[9px] font-mono uppercase tracking-widest text-neutral-400">{status}</span>
    </div>
  );
};
