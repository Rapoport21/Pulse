/**
 * TasksDrawer — global task store, slide-over.
 *
 * Every task extracted from a call lands here. Grouped by priority:
 *
 *   STAT     (urgent · rose)
 *   ROUTINE  (this shift · amber)
 *   FYI      (informational · muted)
 *
 * Status is shown via subtle column:
 *   proposed     → awaiting HITL approval
 *   approved     → user said go
 *   edited       → user changed it
 *   rejected     → user said no
 *   in_progress  → AI executing
 *   done         → complete
 *
 * Opened from the sidebar (desktop) or the mobile header. When the AI
 * is mid-handoff, this drawer is the alternate place to make decisions
 * — same actions as the in-call HITL panel.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Check,
  ListChecks,
  User as UserIcon,
  Phone,
  ChevronRight,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Z,
  Mono,
  BracketLabel,
  TacticalButton,
} from './design';
import {
  useCall,
  TARGET_INFO,
  type ExtractedTask,
  type TaskPriority,
  type TaskStatus,
} from '../lib/callState';

interface TasksDrawerProps {
  open: boolean;
  onClose: () => void;
}

const PRIORITY_ORDER: TaskPriority[] = ['stat', 'routine', 'fyi'];

const priorityColor = (p: TaskPriority): string =>
  p === 'stat' ? COLORS.accent : p === 'routine' ? COLORS.warn : COLORS.textMuted;

const priorityLabel = (p: TaskPriority) =>
  p === 'stat' ? 'STAT' : p === 'routine' ? 'ROUTINE' : 'FYI';

const statusLabel = (s: TaskStatus): string =>
  s === 'proposed'    ? 'Awaiting review' :
  s === 'approved'    ? 'Approved'        :
  s === 'edited'      ? 'Edited'          :
  s === 'rejected'    ? 'Rejected'        :
  s === 'in_progress' ? 'In progress'     :
  s === 'done'        ? 'Done'            : s;

const statusColor = (s: TaskStatus): string =>
  s === 'proposed'    ? COLORS.warn :
  s === 'approved'    ? COLORS.ok   :
  s === 'edited'      ? COLORS.warn :
  s === 'rejected'    ? COLORS.textMuted :
  s === 'in_progress' ? COLORS.info :
  s === 'done'        ? COLORS.ok   : COLORS.textMuted;

export const TasksDrawer: React.FC<TasksDrawerProps> = ({ open, onClose }) => {
  const { tasks, approveTask, rejectTask, completeTask } = useCall();
  const [filter, setFilter] = useState<'open' | 'all'>('open');

  const visible = useMemo(() => {
    const open = (t: ExtractedTask) => t.status !== 'rejected' && t.status !== 'done';
    return filter === 'open' ? tasks.filter(open) : tasks;
  }, [tasks, filter]);

  const grouped = useMemo(() => {
    const out: Record<TaskPriority, ExtractedTask[]> = {
      stat: [],
      routine: [],
      fyi: [],
    };
    for (const t of visible) out[t.priority].push(t);
    return out;
  }, [visible]);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: Z.overlay,
            }}
          />

          {/* drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: MOTION.base, ease: MOTION.easeSmooth }}
            role="dialog"
            aria-label="Tasks"
            style={{
              position: 'fixed',
              right: 0,
              top: 0,
              bottom: 0,
              width: 'min(440px, 100vw)',
              background: COLORS.bg,
              borderLeft: `1px solid ${COLORS.border}`,
              zIndex: Z.modal,
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-16px 0 48px rgba(0,0,0,0.6)',
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
              fontFamily: FONTS.sans,
            }}
          >
            {/* header */}
            <div
              style={{
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                flexShrink: 0,
              }}
            >
              <ListChecks size={16} strokeWidth={1.75} color={COLORS.textSecondary} />
              <BracketLabel tone="primary" size="xs">
                TASKS
              </BracketLabel>
              <Mono tone="dim" size="xs">
                · {visible.length} {filter === 'open' ? 'open' : 'total'}
              </Mono>
              <div style={{ flex: 1 }} />
              <button
                type="button"
                onClick={() => setFilter((f) => (f === 'open' ? 'all' : 'open'))}
                style={{
                  background: 'transparent',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  padding: `${SPACE.xs}px ${SPACE.sm}px`,
                  color: COLORS.textSecondary,
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  cursor: 'pointer',
                }}
              >
                {filter === 'open' ? 'OPEN ONLY' : 'ALL'}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close tasks drawer"
                style={{
                  background: 'transparent',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                }}
              >
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: SPACE.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.lg,
              }}
            >
              {visible.length === 0 && (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: SPACE.xl,
                    gap: SPACE.sm,
                    textAlign: 'center',
                  }}
                >
                  <ListChecks size={24} strokeWidth={1.5} color={COLORS.textDim} />
                  <Mono tone="muted" size="xs" style={{ marginTop: SPACE.xs }}>
                    {filter === 'open' ? 'NO OPEN TASKS' : 'NO TASKS YET'}
                  </Mono>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 12,
                      color: COLORS.textDim,
                      maxWidth: 320,
                      lineHeight: 1.5,
                    }}
                  >
                    Tasks extracted from calls — STAT, Routine, or FYI — show
                    up here for review and tracking.
                  </div>
                </div>
              )}

              {PRIORITY_ORDER.map((p) => {
                const list = grouped[p];
                if (list.length === 0) return null;
                const color = priorityColor(p);
                return (
                  <section key={p}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'baseline',
                        gap: SPACE.sm,
                        marginBottom: SPACE.sm,
                        paddingBottom: SPACE.xs,
                        borderBottom: `1px solid ${color}30`,
                      }}
                    >
                      <Mono
                        size="xs"
                        style={{ color, fontWeight: 700, letterSpacing: '0.16em' }}
                      >
                        {priorityLabel(p)}
                      </Mono>
                      <Mono tone="muted" size="xs">
                        · {list.length} task{list.length === 1 ? '' : 's'}
                      </Mono>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                      {list.map((t) => (
                        <TaskRow
                          key={t.id}
                          task={t}
                          onApprove={() => approveTask(t.id)}
                          onReject={() => rejectTask(t.id)}
                          onComplete={() => completeTask(t.id)}
                        />
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

const TaskRow: React.FC<{
  task: ExtractedTask;
  onApprove: () => void;
  onReject: () => void;
  onComplete: () => void;
}> = ({ task, onApprove, onReject, onComplete }) => {
  const pColor = priorityColor(task.priority);
  const sColor = statusColor(task.status);
  const callInfo = TARGET_INFO[
    // task carries callId but not target; the lookup is loose here.
    // The source-call display is informational only.
    'charge_nurse'
  ];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: SPACE.md,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderLeft: `3px solid ${pColor}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE.xs,
          marginBottom: SPACE.xs,
        }}
      >
        <Mono
          size="xs"
          style={{ color: sColor, fontWeight: 700, letterSpacing: '0.14em' }}
        >
          {statusLabel(task.status).toUpperCase()}
        </Mono>
        <div style={{ flex: 1 }} />
        <Mono tone="dim" size="xs">
          conf · {task.aiConfidence.toUpperCase()}
        </Mono>
      </div>
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
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xs,
          marginBottom: task.status === 'proposed' ? SPACE.sm : 0,
        }}
      >
        <UserIcon size={10} strokeWidth={2} color={COLORS.textMuted} />
        <Mono tone="muted" size="xs">
          @{task.assignee}
        </Mono>
      </div>
      {task.status === 'proposed' && (
        <div style={{ display: 'flex', gap: 4 }}>
          <TacticalButton
            variant="primary"
            size="sm"
            icon={<Check size={11} strokeWidth={2.25} />}
            onClick={onApprove}
          >
            Approve
          </TacticalButton>
          <TacticalButton
            variant="ghost"
            size="sm"
            icon={<X size={11} strokeWidth={2.25} />}
            onClick={onReject}
          >
            Reject
          </TacticalButton>
        </div>
      )}
      {(task.status === 'approved' || task.status === 'edited' || task.status === 'in_progress') && (
        <TacticalButton
          variant="ghost"
          size="sm"
          icon={<Check size={11} strokeWidth={2.25} />}
          onClick={onComplete}
        >
          Mark done
        </TacticalButton>
      )}
    </motion.div>
  );
};
