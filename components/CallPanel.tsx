/**
 * CallPanel — the full-size in-call surface.
 *
 * Lives inside the Comms screen. Renders one of five views based on
 * the active call's state:
 *
 *   calling       → "Connecting…"
 *   connected     → live transcript + Hand-to-AI / End controls
 *   ai_handoff    → AiHandoffPanel (HITL gate · proposals + countdown)
 *   ai_executing  → "AI executing…" with proposed tasks ticking to done
 *   ai_done       → "Done" summary, then call auto-ends
 *
 * Tightly coupled to lib/callState — reads the active Call directly
 * from useCall(). Tasks for this call come from the global task store
 * via Call.proposedTaskIds.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, PhoneCall, PhoneOff, User, Activity, Maximize2, Check, X, Edit3 } from 'lucide-react';
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
import {
  useCall,
  TARGET_INFO,
  type TranscriptLine,
  type ExtractedTask,
  type TaskPriority,
} from '../lib/callState';

// ════════════════════════════════════════════════════════════════
// Constants
// ════════════════════════════════════════════════════════════════

/** Per-priority countdown before AI auto-executes the proposed tasks.
 *  STAT requires explicit user approval (no auto). */
const AUTO_EXECUTE_SECONDS: Record<TaskPriority, number | null> = {
  stat: null,    // require approval
  routine: 8,
  fyi: 3,
};

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

const confidenceLabel = (c: ExtractedTask['aiConfidence']) =>
  c === 'high' ? 'HIGH' : c === 'med' ? 'MED' : 'LOW';

// ════════════════════════════════════════════════════════════════
// CallPanel
// ════════════════════════════════════════════════════════════════

interface CallPanelProps {
  /** When supplied, an expand-icon button appears in the header.
   *  Used by the mini-player to jump to the full Comms screen. */
  onExpand?: () => void;
}

export const CallPanel: React.FC<CallPanelProps> = ({ onExpand }) => {
  const { activeCall, tasks, endCall, handToAI } = useCall();
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [activeCall?.transcript.length]);

  if (!activeCall) return null;

  const info = TARGET_INFO[activeCall.target];
  const callTasks = tasks.filter((t) => activeCall.proposedTaskIds.includes(t.id));

  const accentColor =
    activeCall.state === 'ai_handoff' || activeCall.state === 'ai_executing'
      ? COLORS.warn
      : activeCall.state === 'calling'
        ? COLORS.info
        : activeCall.state === 'ai_done'
          ? COLORS.ok
          : COLORS.ok;

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
      {/* ── HEADER ───────────────────────────────────────────── */}
      <div
        style={{
          padding: `${SPACE.md}px`,
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
          {activeCall.state === 'ai_handoff' ||
          activeCall.state === 'ai_executing' ||
          activeCall.state === 'ai_done' ? (
            <Bot size={16} color={accentColor} strokeWidth={2} />
          ) : (
            <PhoneCall size={16} color={accentColor} strokeWidth={2} />
          )}
          <CornerBracket position="tl" color={accentColor} size={4} thickness={1} />
          <CornerBracket position="br" color={accentColor} size={4} thickness={1} />
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
        <CallStatePill state={activeCall.state} duration={activeCall.duration} />
        {onExpand && (
          <button
            type="button"
            onClick={onExpand}
            title="Open in Comms tab"
            aria-label="Open in Comms tab"
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
            }}
          >
            <Maximize2 size={12} strokeWidth={2} color={COLORS.textSecondary} />
          </button>
        )}
      </div>

      {/* ── BODY · state machine ─────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeCall.state === 'calling' && (
          <BodyShell key="calling">
            <ConnectingView label={info.label} />
          </BodyShell>
        )}

        {activeCall.state === 'connected' && (
          <BodyShell key="connected">
            <TranscriptList
              transcript={activeCall.transcript}
              listRef={transcriptRef}
            />
          </BodyShell>
        )}

        {activeCall.state === 'ai_handoff' && (
          <BodyShell key="handoff">
            <AiHandoffPanel callTasks={callTasks} />
          </BodyShell>
        )}

        {activeCall.state === 'ai_executing' && (
          <BodyShell key="executing">
            <AiExecutingView callTasks={callTasks} />
          </BodyShell>
        )}

        {activeCall.state === 'ai_done' && (
          <BodyShell key="done">
            <AiDoneView callTasks={callTasks} />
          </BodyShell>
        )}
      </AnimatePresence>

      {/* ── CONTROLS ─────────────────────────────────────────── */}
      <CallControls />
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Header pill
// ════════════════════════════════════════════════════════════════

const CallStatePill: React.FC<{ state: ReturnType<typeof useCall>['activeCall'] extends infer C ? C extends { state: infer S } ? S : never : never; duration: number }> = ({ state, duration }) => {
  if (state === 'calling') return <StatusPill label="Connecting" tone="info" pulse size="xs" />;
  if (state === 'connected')
    return (
      <Mono tone="ok" size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatDuration(duration)}
      </Mono>
    );
  if (state === 'ai_handoff')
    return <StatusPill label="HITL review" tone="warn" pulse size="xs" />;
  if (state === 'ai_executing')
    return <StatusPill label="AI executing" tone="warn" pulse size="xs" />;
  if (state === 'ai_done')
    return <StatusPill label="Done" tone="ok" size="xs" />;
  return null;
};

// ════════════════════════════════════════════════════════════════
// Body shell — animates each body view in / out
// ════════════════════════════════════════════════════════════════

const BodyShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: MOTION.fast, ease: MOTION.ease }}
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
    }}
  >
    {children}
  </motion.div>
);

// ════════════════════════════════════════════════════════════════
// Connecting view
// ════════════════════════════════════════════════════════════════

const ConnectingView: React.FC<{ label: string }> = ({ label }) => (
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
      <PhoneCall size={24} strokeWidth={1.75} color={COLORS.info} />
    </motion.div>
    <Mono tone="info" size="xs" style={{ letterSpacing: '0.16em' }}>
      DIALING · {label.toUpperCase()}
    </Mono>
  </div>
);

// ════════════════════════════════════════════════════════════════
// Transcript list
// ════════════════════════════════════════════════════════════════

const TranscriptList: React.FC<{
  transcript: TranscriptLine[];
  listRef: React.RefObject<HTMLDivElement | null>;
}> = ({ transcript, listRef }) => (
  <div
    ref={listRef}
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
    {transcript.length === 0 && (
      <Mono
        tone="dim"
        size="xs"
        style={{ textAlign: 'center', padding: SPACE.lg, letterSpacing: '0.12em' }}
      >
        // ESTABLISHING LINE
      </Mono>
    )}
  </div>
);

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
// AI Handoff Panel (HITL gate)
// ════════════════════════════════════════════════════════════════

const AiHandoffPanel: React.FC<{ callTasks: ExtractedTask[] }> = ({ callTasks }) => {
  const { approveTask, rejectTask, editTask, executeApprovedAndEnd } = useCall();

  // Countdown: longest auto-execute window of any proposed task
  // (excluding STAT which has no auto). If any STAT is proposed, no
  // countdown runs — explicit approval required.
  const hasStat = callTasks.some((t) => t.priority === 'stat' && t.status === 'proposed');
  const countdownTarget: number | null = hasStat
    ? null
    : Math.max(
        ...callTasks
          .filter((t) => t.status === 'proposed')
          .map((t) => AUTO_EXECUTE_SECONDS[t.priority] ?? 0),
        0,
      );

  const [secondsLeft, setSecondsLeft] = useState(countdownTarget ?? 0);

  useEffect(() => {
    if (countdownTarget === null || countdownTarget <= 0) return;
    setSecondsLeft(countdownTarget);
    const id = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          clearInterval(id);
          // Auto-execute when countdown hits zero
          executeApprovedAndEnd();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // Re-run only if countdownTarget changes
  }, [countdownTarget]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
      }}
    >
      {/* HITL banner */}
      <div
        style={{
          padding: `${SPACE.sm}px ${SPACE.md}px`,
          background: `${COLORS.warn}14`,
          borderBottom: `1px solid ${COLORS.warn}`,
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
          flexShrink: 0,
        }}
      >
        <Bot size={14} strokeWidth={2} color={COLORS.warn} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <Mono size="xs" style={{ color: COLORS.warn, fontWeight: 700, letterSpacing: '0.14em' }}>
            HITL · AI PROPOSED {callTasks.length} TASK{callTasks.length === 1 ? '' : 'S'}
          </Mono>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              color: COLORS.textSecondary,
              marginTop: 2,
              lineHeight: 1.4,
            }}
          >
            {hasStat
              ? 'STAT items require approval. Review and confirm before execution.'
              : 'Auto-executing in '}
            {!hasStat && countdownTarget !== null && (
              <Mono
                size="xs"
                style={{
                  color: COLORS.warn,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {secondsLeft}s
              </Mono>
            )}
          </div>
        </div>
      </div>

      {/* Proposed tasks */}
      <div
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
        {callTasks.map((task) => (
          <ProposalCard
            key={task.id}
            task={task}
            onApprove={() => approveTask(task.id)}
            onReject={() => rejectTask(task.id)}
            onEdit={(patch) => editTask(task.id, patch)}
          />
        ))}
      </div>

      {/* Decision footer */}
      <div
        style={{
          padding: SPACE.md,
          background: COLORS.surface,
          borderTop: `1px solid ${COLORS.border}`,
          display: 'flex',
          gap: SPACE.sm,
          flexShrink: 0,
        }}
      >
        <TacticalButton
          variant="primary"
          size="sm"
          fullWidth
          icon={<Check size={12} strokeWidth={2.25} />}
          onClick={executeApprovedAndEnd}
        >
          Execute & end
        </TacticalButton>
      </div>
    </div>
  );
};

const ProposalCard: React.FC<{
  task: ExtractedTask;
  onApprove: () => void;
  onReject: () => void;
  onEdit: (patch: Partial<Pick<ExtractedTask, 'text' | 'priority' | 'assignee'>>) => void;
}> = ({ task, onApprove, onReject, onEdit }) => {
  const [editing, setEditing] = useState(false);
  const [draftText, setDraftText] = useState(task.text);
  const [draftPriority, setDraftPriority] = useState<TaskPriority>(task.priority);

  const pColor = priorityColor(task.priority);
  const decided = task.status !== 'proposed';

  const saveEdit = () => {
    onEdit({ text: draftText.trim(), priority: draftPriority });
    setEditing(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: decided ? 0.6 : 1, y: 0 }}
      transition={{ duration: MOTION.fast }}
      style={{
        position: 'relative',
        padding: SPACE.md,
        background: COLORS.surface,
        border: `1px solid ${decided ? COLORS.border : pColor}`,
        borderLeft: `3px solid ${pColor}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xs,
          marginBottom: SPACE.xs,
        }}
      >
        <Mono
          size="xs"
          style={{ color: pColor, fontWeight: 700, letterSpacing: '0.14em' }}
        >
          {priorityLabel(task.priority)}
        </Mono>
        <Mono tone="muted" size="xs">
          · CONF {confidenceLabel(task.aiConfidence)}
        </Mono>
        <div style={{ flex: 1 }} />
        {decided && (
          <Mono
            size="xs"
            style={{
              color:
                task.status === 'rejected'
                  ? COLORS.textMuted
                  : task.status === 'edited'
                    ? COLORS.warn
                    : COLORS.ok,
              fontWeight: 600,
              letterSpacing: '0.12em',
            }}
          >
            {task.status.toUpperCase()}
          </Mono>
        )}
      </div>

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs, marginBottom: SPACE.sm }}>
          <input
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            style={{
              width: '100%',
              padding: `${SPACE.xs}px ${SPACE.sm}px`,
              background: COLORS.bgDeep,
              border: `1px solid ${COLORS.borderStrong}`,
              color: COLORS.textPrimary,
              fontFamily: FONTS.sans,
              fontSize: 13,
              borderRadius: RADIUS.sm,
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
            fontSize: 14,
            fontWeight: 500,
            color: COLORS.textPrimary,
            lineHeight: 1.4,
            marginBottom: SPACE.xs,
            letterSpacing: '-0.005em',
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
          marginBottom: decided ? 0 : SPACE.sm,
        }}
      >
        <User size={10} strokeWidth={2} color={COLORS.textMuted} />
        <Mono tone="muted" size="xs">
          @{task.assignee}
        </Mono>
      </div>

      {!decided && (
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 11,
            color: COLORS.textDim,
            lineHeight: 1.4,
            marginBottom: SPACE.sm,
            fontStyle: 'italic',
          }}
        >
          {task.aiReasoning}
        </div>
      )}

      {!decided && (
        <div style={{ display: 'flex', gap: 4 }}>
          {editing ? (
            <>
              <TacticalButton variant="primary" size="xs" fullWidth onClick={saveEdit}>
                Save
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
                onClick={onApprove}
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
                onClick={onReject}
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

// ════════════════════════════════════════════════════════════════
// AI Executing / Done views
// ════════════════════════════════════════════════════════════════

const AiExecutingView: React.FC<{ callTasks: ExtractedTask[] }> = ({ callTasks }) => {
  const active = callTasks.filter(
    (t) => t.status === 'approved' || t.status === 'edited' || t.status === 'in_progress',
  );
  const done = callTasks.filter((t) => t.status === 'done');

  return (
    <div
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
      <Mono size="xs" style={{ color: COLORS.warn, letterSpacing: '0.16em', fontWeight: 700 }}>
        // AI EXECUTING · {active.length + done.length} TASKS
      </Mono>
      {[...active, ...done].map((t) => (
        <ExecRow key={t.id} task={t} />
      ))}
    </div>
  );
};

const AiDoneView: React.FC<{ callTasks: ExtractedTask[] }> = ({ callTasks }) => {
  const done = callTasks.filter((t) => t.status === 'done');
  const rejected = callTasks.filter((t) => t.status === 'rejected');
  return (
    <div
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
      <Mono size="xs" style={{ color: COLORS.ok, letterSpacing: '0.16em', fontWeight: 700 }}>
        // DONE · {done.length} EXECUTED · {rejected.length} REJECTED
      </Mono>
      {callTasks.map((t) => (
        <ExecRow key={t.id} task={t} />
      ))}
    </div>
  );
};

const ExecRow: React.FC<{ task: ExtractedTask }> = ({ task }) => {
  const done = task.status === 'done';
  const rejected = task.status === 'rejected';
  const pColor = priorityColor(task.priority);
  return (
    <div
      style={{
        padding: SPACE.sm,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${rejected ? COLORS.textMuted : pColor}`,
        borderRadius: RADIUS.sm,
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.sm,
        opacity: rejected ? 0.55 : 1,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 8,
          height: 8,
          borderRadius: RADIUS.full,
          background: done ? COLORS.ok : rejected ? COLORS.textMuted : COLORS.warn,
          flexShrink: 0,
          boxShadow: !done && !rejected ? `0 0 8px ${COLORS.warn}` : 'none',
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            color: COLORS.textPrimary,
            lineHeight: 1.3,
            letterSpacing: '-0.003em',
          }}
        >
          {task.text}
        </div>
        <Mono tone="muted" size="xs" style={{ marginTop: 2 }}>
          @{task.assignee} · {priorityLabel(task.priority)}
        </Mono>
      </div>
      <Mono
        size="xs"
        style={{
          color: done ? COLORS.ok : rejected ? COLORS.textMuted : COLORS.warn,
          fontWeight: 700,
          letterSpacing: '0.12em',
          flexShrink: 0,
        }}
      >
        {done ? 'DONE' : rejected ? 'SKIP' : task.status === 'in_progress' ? 'RUN' : 'READY'}
      </Mono>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Controls — always visible, always end-call-available
// ════════════════════════════════════════════════════════════════

const CallControls: React.FC = () => {
  const { activeCall, endCall, handToAI, holdActiveCall, heldCalls } = useCall();
  if (!activeCall) return null;

  const showHandToAI = activeCall.state === 'connected';
  const showHold = activeCall.state === 'connected' && heldCalls.length === 0;
  const showEnd = activeCall.state !== 'ai_executing';

  return (
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
      {showHandToAI && (
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
      {showHold && (
        <TacticalButton
          variant="ghost"
          size="sm"
          fullWidth
          icon={<Activity size={12} strokeWidth={2} />}
          onClick={holdActiveCall}
        >
          Hold
        </TacticalButton>
      )}
      {showEnd && (
        <TacticalButton
          variant="danger"
          size="sm"
          fullWidth
          icon={<PhoneOff size={12} strokeWidth={2} />}
          onClick={() => endCall()}
        >
          End call
        </TacticalButton>
      )}
    </div>
  );
};
