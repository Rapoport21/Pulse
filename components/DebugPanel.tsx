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
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  CornerBracket,
  TacticalButton,
} from './design';

interface DebugPanelProps {
  currentUser?: UserProfile | null;
}

const statusToColor = (status: string): string => {
  if (status === 'connected') return COLORS.ok;
  if (status === 'connecting') return COLORS.warn;
  return COLORS.crit;
};

const DebugSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <div
    style={{
      background: COLORS.surfaceElev,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      padding: SPACE.sm,
      position: 'relative',
    }}
  >
    <CornerBracket position="tl" color={COLORS.borderStrong} size={5} thickness={1} />
    <CornerBracket position="br" color={COLORS.borderStrong} size={5} thickness={1} />
    <Mono
      tone="muted"
      size="xs"
      style={{ display: 'block', marginBottom: 6, fontSize: 9 }}
    >
      {title}
    </Mono>
    {children}
  </div>
);

const KeyValueRow: React.FC<{
  label: string;
  value: React.ReactNode;
  valueColor?: string;
}> = ({ label, value, valueColor = COLORS.info }) => (
  <div
    style={{
      display: 'flex',
      gap: SPACE.xs,
      fontSize: 11,
      color: COLORS.textSecondary,
      fontFamily: FONTS.mono,
      letterSpacing: '0.03em',
    }}
  >
    <span style={{ color: COLORS.textMuted }}>{label}:</span>
    <span style={{ color: valueColor }}>{value}</span>
  </div>
);

export const DebugPanel: React.FC<DebugPanelProps> = ({ currentUser }) => {
  const status = useConnectionStatus();
  const presence = usePresence();
  const log = useRealtimeLog();
  const [collapsed, setCollapsed] = useState(false);

  const surge = getRealtimeStateSnapshot<SurgeModeState>('surge-mode') || {
    active: false,
    activatedAt: null,
  };

  const dotColor = statusToColor(status);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: SPACE.base,
        right: SPACE.base,
        zIndex: 1000,
        width: 420,
        maxWidth: 'calc(100vw - 32px)',
        fontFamily: FONTS.mono,
        fontSize: 11,
        color: COLORS.textSecondary,
        background: 'rgba(2, 2, 2, 0.92)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: `1px solid ${COLORS.borderStrong}`,
        borderRadius: RADIUS.sm,
        boxShadow: '0 24px 60px rgba(0,0,0,0.85)',
        overflow: 'hidden',
      }}
    >
      <CornerBracket position="tl" color={COLORS.borderStrong} size={8} thickness={1} />
      <CornerBracket position="br" color={COLORS.borderStrong} size={8} thickness={1} />

      {/* Header */}
      <div
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          cursor: 'pointer',
          userSelect: 'none',
          background: COLORS.surface,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
          <span
            style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: dotColor,
              boxShadow: `0 0 8px ${dotColor}`,
            }}
          />
          <Mono tone="primary" size="xs" style={{ fontWeight: 600 }}>
            PULSE · DEBUG
          </Mono>
          <Mono tone="muted" size="xs">
            {status.toUpperCase()}
          </Mono>
          <Mono tone="dim" size="xs">
            · {getLatencyMs()}ms
          </Mono>
        </div>
        {collapsed ? (
          <ChevronUp size={12} strokeWidth={2} color={COLORS.textMuted} />
        ) : (
          <ChevronDown size={12} strokeWidth={2} color={COLORS.textMuted} />
        )}
      </div>

      {!collapsed && (
        <div
          style={{
            padding: SPACE.md,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.md,
            maxHeight: '60vh',
            overflowY: 'auto',
          }}
        >
          <DebugSection title="IDENTITY">
            <KeyValueRow label="device" value={`${getDeviceId().slice(0, 12)}…`} />
            <KeyValueRow label="role" value={currentUser?.role || '—'} />
            <KeyValueRow label="user" value={currentUser?.name || '—'} />
          </DebugSection>

          <DebugSection
            title={`PRESENCE — ${presence.length} PEER${presence.length === 1 ? '' : 'S'}`}
          >
            {presence.length === 0 ? (
              <div style={{ color: COLORS.textDim }}>no peers</div>
            ) : (
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                {presence.map((id) => (
                  <li
                    key={id}
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: id === getDeviceId() ? COLORS.ok : COLORS.textSecondary,
                    }}
                  >
                    {id.slice(0, 12)}
                    {id === getDeviceId() ? ' (you)' : ''}
                  </li>
                ))}
              </ul>
            )}
          </DebugSection>

          <DebugSection title="SURGE STATE">
            <KeyValueRow
              label="active"
              value={String(surge.active)}
              valueColor={surge.active ? COLORS.accent : COLORS.ok}
            />
            {surge.activatedAt && (
              <KeyValueRow
                label="activatedAt"
                value={new Date(surge.activatedAt).toLocaleTimeString()}
                valueColor={COLORS.textSecondary}
              />
            )}
          </DebugSection>

          <DebugSection title={`LIVE LOG (${log.length})`}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                maxHeight: 192,
                overflowY: 'auto',
              }}
            >
              {log.length === 0 && (
                <div style={{ color: COLORS.textDim }}>no events</div>
              )}
              {[...log].reverse().map((entry, i) => (
                <div key={i} style={{ lineHeight: 1.4 }}>
                  <span style={{ color: COLORS.textDim }}>
                    {new Date(entry.ts).toLocaleTimeString().slice(0, 8)}
                  </span>{' '}
                  <span
                    style={{
                      color: entry.direction === 'in' ? COLORS.info : COLORS.warn,
                    }}
                  >
                    {entry.direction === 'in' ? '←' : '→'}
                  </span>{' '}
                  <span style={{ color: COLORS.textSecondary }}>{entry.type}</span>
                  {entry.key && (
                    <span style={{ color: '#C084FC' }}> [{entry.key}]</span>
                  )}
                  {entry.payloadPreview && (
                    <span style={{ color: COLORS.textMuted }}>
                      {' '}
                      {entry.payloadPreview}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </DebugSection>

          <TacticalButton
            variant="danger"
            size="sm"
            fullWidth
            icon={<RotateCcw size={12} strokeWidth={2} />}
            onClick={() => broadcastReset()}
          >
            Reset Demo State
          </TacticalButton>
        </div>
      )}
    </div>
  );
};

/**
 * Always-visible tiny connection indicator. Renders a small dot in the bottom-left
 * on desktop. Hidden on mobile — MobileView renders its own connection status
 * inline in the top HUD strip so it doesn't overlap the bottom tab bar.
 */
export const ConnectionIndicator: React.FC = () => {
  const status = useConnectionStatus();
  const dotColor = statusToColor(status);
  return (
    <div
      className="pulse-connection-indicator"
      style={{
        position: 'fixed',
        bottom: SPACE.sm,
        left: SPACE.sm,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: `${SPACE.xs}px ${SPACE.sm}px`,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.full,
        pointerEvents: 'none',
        transition: `border-color ${MOTION.fast}s ease`,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: dotColor,
          boxShadow: `0 0 6px ${dotColor}`,
        }}
      />
      <Mono tone="muted" size="xs" style={{ fontSize: 9 }}>
        {status}
      </Mono>
    </div>
  );
};
