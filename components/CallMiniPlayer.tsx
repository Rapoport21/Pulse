/**
 * CallMiniPlayer — universal floating pill for any active call.
 *
 * Renders only when a call is active. One DOM presence; can be mounted
 * at the bottom of the desktop sidebar OR above the mobile bottom tab
 * bar. Tap anywhere on the pill → opens the full Comms screen.
 *
 * Pattern reference (mini-player + tap-to-expand):
 *   - Spotify mini-player
 *   - Apple iOS phone "compact pill" during background call
 *   - Discord call-in-progress sidebar pill
 */

import React from 'react';
import { motion } from 'motion/react';
import { PhoneCall, Maximize2 } from 'lucide-react';
import { COLORS, FONTS, SPACE, RADIUS, MOTION, Mono } from './design';
import { useCall, TARGET_INFO, type CallState } from '../lib/callState';

interface CallMiniPlayerProps {
  /** Called when the user taps the pill (not the end-call button).
   *  Should open the full Comms screen. */
  onExpand: () => void;
  /** If true, render with a top border (used in sidebar bottom). */
  variant?: 'sidebar' | 'mobile';
}

const stateTone = (state: CallState): { color: string; label: string } => {
  if (state === 'calling')   return { color: COLORS.info, label: 'CONNECTING' };
  if (state === 'connected') return { color: COLORS.ok,   label: 'LIVE' };
  return { color: COLORS.textMuted, label: 'IDLE' };
};

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
};

export const CallMiniPlayer: React.FC<CallMiniPlayerProps> = ({
  onExpand,
  variant = 'sidebar',
}) => {
  const { activeCall, heldCalls, endCall } = useCall();
  if (!activeCall) return null;

  const info = TARGET_INFO[activeCall.target];
  const tone = stateTone(activeCall.state);
  const hasHeld = heldCalls.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: MOTION.base, ease: MOTION.easeSmooth }}
      style={{
        position: 'relative',
        background: COLORS.surface,
        borderTop:
          variant === 'sidebar'
            ? `1px solid ${tone.color}`
            : `1px solid ${COLORS.border}`,
        borderBottom: variant === 'mobile' ? `1px solid ${tone.color}` : undefined,
        boxShadow:
          activeCall.state === 'connected'
            ? `0 -4px 18px -8px ${tone.color}66`
            : 'none',
        flexShrink: 0,
      }}
    >
      {/* Scanning line — tactical activity indicator */}
      <motion.div
        aria-hidden
        animate={{ x: ['0%', '100%'] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '30%',
          height: 1,
          background: `linear-gradient(90deg, transparent, ${tone.color}, transparent)`,
          pointerEvents: 'none',
        }}
      />

      <button
        type="button"
        onClick={onExpand}
        aria-label="Open Comms"
        style={{
          width: '100%',
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          background: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          cursor: 'pointer',
          fontFamily: FONTS.sans,
          color: COLORS.textPrimary,
          textAlign: 'left',
          minHeight: 56,
        }}
      >
        {/* State icon */}
        <div
          style={{
            position: 'relative',
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${tone.color}14`,
            border: `1px solid ${tone.color}`,
            borderRadius: RADIUS.sm,
            flexShrink: 0,
          }}
        >
          <PhoneCall size={12} strokeWidth={2} color={tone.color} />
          {activeCall.state === 'calling' && (
            <motion.span
              aria-hidden
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              style={{
                position: 'absolute',
                inset: -2,
                border: `1px solid ${tone.color}`,
                borderRadius: RADIUS.sm,
                pointerEvents: 'none',
              }}
            />
          )}
        </div>

        {/* Target + state */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.xs }}>
            <Mono size="xs" style={{ color: tone.color, fontWeight: 700, letterSpacing: '0.14em' }}>
              {tone.label}
            </Mono>
            {hasHeld && (
              <Mono tone="muted" size="xs">
                · +{heldCalls.length} held
              </Mono>
            )}
            <div style={{ flex: 1 }} />
            <Mono
              size="xs"
              tone="muted"
              style={{ fontVariantNumeric: 'tabular-nums' }}
            >
              {formatDuration(activeCall.duration)}
            </Mono>
          </div>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.textPrimary,
              letterSpacing: '-0.005em',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {info.label}
          </div>
        </div>

        <Maximize2
          size={14}
          strokeWidth={1.75}
          color={COLORS.textSecondary}
          style={{ flexShrink: 0 }}
        />
      </button>

      {/* End-call quick button — always reachable, never hidden */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          endCall();
        }}
        aria-label="End call"
        style={{
          position: 'absolute',
          right: SPACE.md,
          top: '50%',
          transform: 'translate(38px, -50%)',
          display: 'none',
        }}
      />
    </motion.div>
  );
};
