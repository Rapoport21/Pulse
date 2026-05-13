import React, { useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { Bot, PhoneCall, PhoneOff, User, Activity } from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  BracketLabel,
  StatusPill,
  CornerBracket,
  TacticalButton,
} from './design';
import { useCall, CALL_TARGET_LABEL, type TranscriptLine } from '../lib/callState';

/**
 * CallPanel — the live in-the-moment call surface.
 *
 * Rendered inside both the right-side CallDrawer and the Comms top-level
 * tab. Reads call state from the CallProvider context (lib/callState).
 *
 * Layout:
 *   ┌──────────────────────────────┐
 *   │ header · target + duration   │  fixed
 *   ├──────────────────────────────┤
 *   │ transcript                   │  flex, scrolls
 *   │   ...                        │
 *   ├──────────────────────────────┤
 *   │ extracted action tasks       │  fixed
 *   ├──────────────────────────────┤
 *   │ controls (Hand to AI · End)  │  fixed
 *   └──────────────────────────────┘
 */
export const CallPanel: React.FC = () => {
  const { activeCall, callState, callDuration, transcript, actionTasks, endCall, handToAI } =
    useCall();
  const transcriptRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript on new lines
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  if (!activeCall) return null;

  const targetLabel = CALL_TARGET_LABEL[activeCall];
  const linkCode = activeCall === 'nurse' ? 'NURSE' : 'BLOOD_BANK';

  const accentColor =
    callState === 'ai_speaking'
      ? COLORS.warn
      : callState === 'calling'
        ? COLORS.info
        : COLORS.ok;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        background: COLORS.bgDeep,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: `${SPACE.md}px ${SPACE.md}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 36,
            height: 36,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${accentColor}14`,
            border: `1px solid ${accentColor}`,
            borderRadius: RADIUS.sm,
            flexShrink: 0,
          }}
        >
          {callState === 'ai_speaking' ? (
            <Bot size={16} color={accentColor} strokeWidth={2} />
          ) : (
            <PhoneCall size={16} color={accentColor} strokeWidth={2} />
          )}
          <CornerBracket position="tl" color={accentColor} size={4} thickness={1} />
          <CornerBracket position="br" color={accentColor} size={4} thickness={1} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Mono tone="dim" size="xs">
            // LINK.{linkCode}
          </Mono>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.textPrimary,
              letterSpacing: '-0.01em',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {targetLabel}
          </div>
        </div>
        {callState === 'calling' && (
          <StatusPill label="Connecting" tone="info" pulse size="xs" />
        )}
        {callState === 'connected' && (
          <Mono tone="ok" size="xs">
            {formatTime(callDuration)}
          </Mono>
        )}
        {callState === 'ai_speaking' && (
          <Mono tone="warn" size="xs">
            AI · {formatTime(callDuration)}
          </Mono>
        )}
      </div>

      {/* Transcript */}
      {(callState === 'connected' || callState === 'ai_speaking') && (
        <div
          ref={transcriptRef}
          style={{
            flex: 1,
            padding: SPACE.md,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.sm,
            minHeight: 0,
          }}
        >
          {transcript.map((line, i) => (
            <TranscriptPacket key={i} line={line} index={i + 1} />
          ))}
          {callState === 'ai_speaking' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              style={{
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                background: `${COLORS.warn}14`,
                border: `1px solid ${COLORS.warn}`,
                borderRadius: RADIUS.sm,
                display: 'flex',
                gap: SPACE.sm,
                alignItems: 'flex-start',
              }}
            >
              <Bot
                size={14}
                color={COLORS.warn}
                strokeWidth={2}
                style={{ marginTop: 2, flexShrink: 0 }}
              />
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 12,
                  color: COLORS.textPrimary,
                  lineHeight: 1.45,
                  letterSpacing: '-0.003em',
                }}
              >
                AI is taking over. "I have logged the requested actions. You may
                disconnect. Thank you."
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Extracted tasks */}
      {actionTasks.length > 0 && (
        <div
          style={{
            padding: SPACE.md,
            background: COLORS.surface,
            borderTop: `1px solid ${COLORS.border}`,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.xs,
              marginBottom: SPACE.sm,
            }}
          >
            <Activity size={10} strokeWidth={2} color={COLORS.textSecondary} />
            <BracketLabel tone="secondary" size="xs">
              EXTRACTED
            </BracketLabel>
            <Mono tone="dim" size="xs">
              {actionTasks.length} task{actionTasks.length === 1 ? '' : 's'}
            </Mono>
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.xs,
            }}
          >
            {actionTasks.map((task, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  padding: `${SPACE.xs}px ${SPACE.sm}px`,
                  background: COLORS.bgDeep,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 12,
                    fontWeight: 500,
                    color: COLORS.textPrimary,
                    letterSpacing: '-0.003em',
                  }}
                >
                  {task.task}
                </span>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <User size={10} strokeWidth={2} color={COLORS.textMuted} />
                  <Mono tone="muted" size="xs">
                    @{task.assignee}
                  </Mono>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Controls */}
      <div
        style={{
          padding: SPACE.md,
          borderTop: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          display: 'flex',
          gap: SPACE.sm,
          flexShrink: 0,
        }}
      >
        {callState === 'connected' && (
          <TacticalButton
            variant="primary"
            size="sm"
            fullWidth
            icon={<Bot size={12} strokeWidth={2} />}
            onClick={handToAI}
          >
            Hand to AI
          </TacticalButton>
        )}
        <TacticalButton
          variant="danger"
          size="sm"
          fullWidth
          icon={<PhoneOff size={12} strokeWidth={2} />}
          onClick={endCall}
        >
          End Call
        </TacticalButton>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────
// TranscriptPacket — tactical packet styling for one transcript line.
// Copied from CommandSidebar's earlier definition; pulled here so the
// drawer + tab share the same renderer.
// ─────────────────────────────────────────────────────────────────────
const TranscriptPacket: React.FC<{
  line: TranscriptLine;
  index: number;
}> = ({ line, index }) => {
  const isMe = line.speaker === 'me';
  const isAi = line.speaker === 'ai';

  const speakerLabel = isMe ? 'OPERATOR' : isAi ? 'PULSE.AI' : 'REMOTE';
  const speakerColor = isMe ? COLORS.info : isAi ? COLORS.info : COLORS.ok;
  const borderColor = isAi ? COLORS.borderStrong : COLORS.border;
  const bg = isAi ? COLORS.surfaceElev : COLORS.surface;

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
      style={{
        position: 'relative',
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
          <Mono tone="dim" size="xs">
            #{String(index).padStart(3, '0')}
          </Mono>
          {isAi && <Bot size={10} color={speakerColor} strokeWidth={2} />}
          <Mono size="xs" style={{ color: speakerColor }}>
            {speakerLabel}
          </Mono>
        </div>
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 13,
          color: COLORS.textPrimary,
          lineHeight: 1.5,
          letterSpacing: '-0.003em',
        }}
      >
        {line.text}
      </div>
    </motion.div>
  );
};
