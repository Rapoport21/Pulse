/**
 * CallPanel — the live in-call surface.
 *
 * Same component renders in two places: pinned inside the desktop
 * sidebar AND inside the full-screen Comms tab. The layout is a
 * vertical stack so it works in both widths.
 *
 *   ┌──────────────────────────────────┐
 *   │ HEADER · target · LINK · time    │
 *   ├──────────────────────────────────┤
 *   │ TRANSCRIPT (scrolls, flex 2)     │
 *   │  packets…                        │
 *   ├──────────────────────────────────┤
 *   │ TASKS (auto+manual, live)        │
 *   │  ● AUTO ✓ Page RT to ER         │
 *   │  ● MANUAL · Approve disch…      │
 *   │     [Approve] [Edit] [Reject]    │
 *   ├──────────────────────────────────┤
 *   │ [Hold]  [End call]               │
 *   └──────────────────────────────────┘
 *
 * Tasks flow live during the connected state. AUTO tasks self-execute
 * (proposed → in_progress → done with delays). MANUAL tasks stay
 * 'proposed' until the operator approves / edits / rejects them — they
 * also appear in the global TasksDrawer and the Tasks tab in Comms.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot, PhoneCall, PhoneOff, User, Maximize2, Check, X, Edit3, ChevronDown,
} from 'lucide-react';
import {
  COLORS, FONTS, SPACE, RADIUS, MOTION,
  Mono, BracketLabel, StatusPill, CornerBracket, TacticalButton,
} from './design';
import {
  useCall, TARGET_INFO,
  type CallState,
  type TranscriptLine,
  type ExtractedTask,
  type TaskPriority,
  type TaskStatus,
} from '../lib/callState';

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
};

const priorityColor = (p: TaskPriority): string =>
  p === 'stat' ? COLORS.accent : p === 'routine' ? COLORS.warn : COLORS.textMuted;

const priorityLabel = (p: TaskPriority) =>
  p === 'stat' ? 'STAT' : p === 'routine' ? 'ROUTINE' : 'FYI';

const statusBadge = (s: TaskStatus, mode: ExtractedTask['executionMode']) => {
  if (s === 'proposed')    return { text: 'NEEDS YOU', color: COLORS.warn };
  if (s === 'approved')    return { text: 'QUEUED',    color: COLORS.info };
  if (s === 'edited')      return { text: 'EDITED',    color: COLORS.warn };
  if (s === 'rejected')    return { text: 'REJECTED',  color: COLORS.textMuted };
  if (s === 'in_progress') return { text: mode === 'auto' ? 'AI RUN' : 'RUN', color: COLORS.info };
  if (s === 'done')        return { text: 'DONE',      color: COLORS.ok };
  return { text: s, color: COLORS.textMuted };
};

// ════════════════════════════════════════════════════════════════
// CallPanel
// ════════════════════════════════════════════════════════════════

interface CallPanelProps {
  /** Adds an expand-icon button in the header. The sidebar passes a
   *  navigate-to-Comms callback here; Comms passes nothing. */
  onExpand?: () => void;
}

export const CallPanel: React.FC<CallPanelProps> = ({ onExpand }) => {
  const { activeCall, tasks, endCall, holdActiveCall, heldCalls } = useCall();
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [activeCall?.transcript.length]);

  if (!activeCall) return null;

  const info = TARGET_INFO[activeCall.target];
  const callTasks = tasks.filter((t) => activeCall.proposedTaskIds.includes(t.id));
  const pendingManual = callTasks.filter((t) => t.status === 'proposed');

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
      {/* ── HEADER ──────────────────────────────────────────── */}
      <CallHeader call={activeCall} info={info} onExpand={onExpand} />

      {/* ── TRANSCRIPT ─────────────────────────────────────── */}
      <div
        ref={transcriptRef}
        style={{
          flex: 1,
          padding: SPACE.md,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.sm,
          minHeight: 120,
        }}
      >
        {activeCall.state === 'calling' && <ConnectingRow label={info.label} />}

        {activeCall.transcript.map((line, i) => (
          <TranscriptPacket key={i} line={line} index={i + 1} />
        ))}

        {activeCall.state === 'connected' && activeCall.transcript.length === 0 && (
          <Mono
            tone="dim"
            size="xs"
            style={{ textAlign: 'center', padding: SPACE.lg, letterSpacing: '0.12em' }}
          >
            // ESTABLISHING LINE
          </Mono>
        )}
      </div>

      {/* ── LIVE TASKS ─────────────────────────────────────── */}
      {callTasks.length > 0 && (
        <TasksSection callTasks={callTasks} pendingManualCount={pendingManual.length} />
      )}

      {/* ── CONTROLS ───────────────────────────────────────── */}
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
        {activeCall.state === 'connected' && heldCalls.length === 0 && (
          <TacticalButton
            variant="ghost"
            size="sm"
            fullWidth
            onClick={holdActiveCall}
          >
            Hold
          </TacticalButton>
        )}
        <TacticalButton
          variant="danger"
          size="sm"
          fullWidth
          icon={<PhoneOff size={12} strokeWidth={2} />}
          onClick={() => endCall()}
        >
          End call
        </TacticalButton>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Header
// ════════════════════════════════════════════════════════════════

const CallHeader: React.FC<{
  call: { state: CallState; duration: number; target: keyof typeof TARGET_INFO };
  info: (typeof TARGET_INFO)[keyof typeof TARGET_INFO];
  onExpand?: () => void;
}> = ({ call, info, onExpand }) => {
  const accent =
    call.state === 'calling' ? COLORS.info :
    call.state === 'ended'   ? COLORS.textMuted : COLORS.ok;
  return (
    <div
      style={{
        padding: SPACE.md,
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
          background: `${accent}14`,
          border: `1px solid ${accent}`,
          borderRadius: RADIUS.sm,
          flexShrink: 0,
        }}
      >
        <PhoneCall size={16} color={accent} strokeWidth={2} />
        <CornerBracket position="tl" color={accent} size={4} thickness={1} />
        <CornerBracket position="br" color={accent} size={4} thickness={1} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Mono tone="dim" size="xs">
          // LINK.{info.code}
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
          {info.label}
        </div>
      </div>
      {call.state === 'calling' && <StatusPill label="Connecting" tone="info" pulse size="xs" />}
      {call.state === 'connected' && (
        <Mono tone="ok" size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {formatDuration(call.duration)}
        </Mono>
      )}
      {onExpand && (
        <button
          type="button"
          onClick={onExpand}
          title="Open Comms"
          aria-label="Open Comms"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            background: 'transparent',
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            cursor: 'pointer',
            marginLeft: SPACE.xs,
            flexShrink: 0,
            color: COLORS.textSecondary,
          }}
        >
          <Maximize2 size={12} strokeWidth={2} />
        </button>
      )}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Connecting row
// ════════════════════════════════════════════════════════════════

const ConnectingRow: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACE.sm,
      padding: SPACE.xl,
    }}
  >
    <motion.div
      animate={{ opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
    >
      <PhoneCall size={20} strokeWidth={1.75} color={COLORS.info} />
    </motion.div>
    <Mono tone="info" size="xs" style={{ letterSpacing: '0.16em' }}>
      DIALING · {label.toUpperCase()}
    </Mono>
  </div>
);

// ════════════════════════════════════════════════════════════════
// Transcript packet
// ════════════════════════════════════════════════════════════════

const TranscriptPacket: React.FC<{
  line: TranscriptLine;
  index: number;
}> = ({ line, index }) => {
  const isMe = line.speaker === 'me';
  const isAi = line.speaker === 'ai';
  const speakerLabel = isMe ? 'OPERATOR' : isAi ? 'PULSE.AI' : 'REMOTE';
  const speakerColor = isMe ? COLORS.info : isAi ? COLORS.warn : COLORS.ok;
  const borderColor = isAi ? COLORS.borderStrong : COLORS.border;
  const bg = isAi ? COLORS.surfaceElev : COLORS.surface;
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
      style={{
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
          gap: SPACE.xs,
          marginBottom: 4,
        }}
      >
        <Mono tone="dim" size="xs">
          #{String(index).padStart(3, '0')}
        </Mono>
        {isAi && <Bot size={10} color={speakerColor} strokeWidth={2} />}
        <Mono size="xs" style={{ color: speakerColor }}>
          {speakerLabel}
        </Mono>
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

// ════════════════════════════════════════════════════════════════
// Tasks section — live during the call
// ════════════════════════════════════════════════════════════════

const TasksSection: React.FC<{
  callTasks: ExtractedTask[];
  pendingManualCount: number;
}> = ({ callTasks, pendingManualCount }) => {
  const [collapsed, setCollapsed] = useState(false);
  const auto = callTasks.filter((t) => t.executionMode === 'auto');
  const manual = callTasks.filter((t) => t.executionMode === 'manual');

  return (
    <div
      style={{
        borderTop: `1px solid ${COLORS.border}`,
        background: COLORS.surface,
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '50%',
        minHeight: 0,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xs,
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          background: 'transparent',
          border: 'none',
          borderBottom: collapsed ? 'none' : `1px solid ${COLORS.border}`,
          cursor: 'pointer',
          color: COLORS.textPrimary,
          fontFamily: FONTS.sans,
          flexShrink: 0,
        }}
      >
        <BracketLabel
          tone={pendingManualCount > 0 ? 'accent' : 'secondary'}
          size="xs"
        >
          TASKS
        </BracketLabel>
        <Mono tone="muted" size="xs">
          · {callTasks.length} extracted · {auto.length} auto · {manual.length} manual
        </Mono>
        {pendingManualCount > 0 && (
          <span
            style={{
              marginLeft: SPACE.xs,
              padding: '2px 6px',
              background: COLORS.accent,
              color: COLORS.textPrimary,
              borderRadius: RADIUS.full,
              fontFamily: FONTS.mono,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.1em',
            }}
          >
            {pendingManualCount} NEEDS YOU
          </span>
        )}
        <div style={{ flex: 1 }} />
        <motion.span
          aria-hidden
          animate={{ rotate: collapsed ? -90 : 0 }}
          transition={{ duration: MOTION.fast }}
        >
          <ChevronDown size={12} strokeWidth={2} color={COLORS.textSecondary} />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: MOTION.fast, ease: MOTION.easeSmooth }}
            style={{ overflow: 'hidden', minHeight: 0, flexShrink: 1 }}
          >
            <div
              style={{
                padding: SPACE.sm,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.xs,
                maxHeight: 280,
              }}
            >
              {callTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const TaskRow: React.FC<{ task: ExtractedTask }> = ({ task }) => {
  const { approveTask, rejectTask, editTask } = useCall();
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(task.text);
  const [draftPriority, setDraftPriority] = useState<TaskPriority>(task.priority);

  const pColor = priorityColor(task.priority);
  const badge = statusBadge(task.status, task.executionMode);
  const isProposed = task.status === 'proposed';
  const isDone = task.status === 'done';
  const isRejected = task.status === 'rejected';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: isRejected ? 0.45 : 1, y: 0 }}
      transition={{ duration: MOTION.fast }}
      style={{
        padding: `${SPACE.sm}px ${SPACE.sm + 2}px`,
        background: COLORS.bgDeep,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${pColor}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xs,
          marginBottom: 4,
        }}
      >
        <Mono
          size="xs"
          style={{
            color: task.executionMode === 'auto' ? COLORS.info : COLORS.warn,
            fontWeight: 700,
            letterSpacing: '0.14em',
          }}
        >
          {task.executionMode === 'auto' ? 'AUTO' : 'MANUAL'}
        </Mono>
        <Mono tone="muted" size="xs">
          · {priorityLabel(task.priority)}
        </Mono>
        <div style={{ flex: 1 }} />
        <Mono
          size="xs"
          style={{
            color: badge.color,
            fontWeight: 700,
            letterSpacing: '0.12em',
          }}
        >
          {isDone && <Check size={9} strokeWidth={3} style={{ marginRight: 3, verticalAlign: 'middle' }} />}
          {badge.text}
        </Mono>
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs, marginBottom: SPACE.xs }}>
          <input
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            style={{
              padding: `${SPACE.xs}px ${SPACE.sm}px`,
              background: COLORS.surface,
              border: `1px solid ${COLORS.borderStrong}`,
              color: COLORS.textPrimary,
              fontFamily: FONTS.sans,
              fontSize: 13,
              borderRadius: RADIUS.sm,
              outline: 'none',
            }}
          />
          <div style={{ display: 'flex', gap: 4 }}>
            {(['stat', 'routine', 'fyi'] as TaskPriority[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setDraftPriority(p)}
                style={{
                  flex: 1,
                  padding: `${SPACE.xs}px`,
                  background: draftPriority === p ? `${priorityColor(p)}26` : 'transparent',
                  border: `1px solid ${draftPriority === p ? priorityColor(p) : COLORS.border}`,
                  color: draftPriority === p ? priorityColor(p) : COLORS.textMuted,
                  borderRadius: RADIUS.sm,
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                  fontWeight: 600,
                }}
              >
                {priorityLabel(p)}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.textPrimary,
            lineHeight: 1.35,
            letterSpacing: '-0.003em',
            marginBottom: 4,
          }}
        >
          {task.text}
        </div>
      )}

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xs,
        }}
      >
        <User size={9} strokeWidth={2} color={COLORS.textMuted} />
        <Mono tone="muted" size="xs">
          @{task.assignee}
        </Mono>
        {task.executionMode === 'manual' && isProposed && (
          <>
            <div style={{ flex: 1 }} />
            <Mono tone="dim" size="xs" style={{ fontStyle: 'italic' }}>
              conf · {task.aiConfidence}
            </Mono>
          </>
        )}
      </div>

      {isProposed && (
        <div style={{ display: 'flex', gap: 4, marginTop: SPACE.xs }}>
          {editing ? (
            <>
              <TacticalButton
                variant="primary"
                size="xs"
                fullWidth
                onClick={() => {
                  editTask(task.id, { text: draftText.trim(), priority: draftPriority });
                  setEditing(false);
                }}
              >
                Save edit
              </TacticalButton>
              <TacticalButton
                variant="ghost"
                size="xs"
                onClick={() => {
                  setDraftText(task.text);
                  setDraftPriority(task.priority);
                  setEditing(false);
                }}
              >
                Cancel
              </TacticalButton>
            </>
          ) : (
            <>
              <TacticalButton
                variant="primary"
                size="xs"
                icon={<Check size={11} strokeWidth={2.25} />}
                onClick={() => approveTask(task.id)}
              >
                Approve
              </TacticalButton>
              <TacticalButton
                variant="ghost"
                size="xs"
                icon={<Edit3 size={11} strokeWidth={2} />}
                onClick={() => setEditing(true)}
              >
                Edit
              </TacticalButton>
              <TacticalButton
                variant="ghost"
                size="xs"
                icon={<X size={11} strokeWidth={2.25} />}
                onClick={() => rejectTask(task.id)}
              >
                Reject
              </TacticalButton>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
};
