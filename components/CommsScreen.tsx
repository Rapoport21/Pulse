/**
 * CommsScreen — the full Comms surface.
 *
 *   ┌──────────────────────────────────┐  ┌──────────────────────┐
 *   │ HELD QUEUE CHIPS (if any)        │  │ TAB STRIP            │
 *   ├──────────────────────────────────┤  │ [Directory] [Tasks · 3]
 *   │                                  │  │             [Recent · 5]
 *   │   Active CallPanel               │  ├──────────────────────┤
 *   │   (or empty state)               │  │ Selected tab content │
 *   │                                  │  │                      │
 *   └──────────────────────────────────┘  └──────────────────────┘
 *
 * The right column is a single tabbed card so contacts / tasks /
 * recent calls don't compete for vertical space. The Tasks tab is the
 * place to handle manual-approval items after the call ends (the
 * global TasksDrawer is the same data, opened from elsewhere).
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  PhoneCall, History, Users, Search, PhoneOff, Pause, ListChecks,
  Check, X, User as UserIcon,
} from 'lucide-react';
import {
  COLORS, FONTS, SPACE, RADIUS, MOTION,
  Mono, BracketLabel, StatusPill, TacticalCard, TacticalButton,
} from './design';
import {
  useCall,
  CALL_DIRECTORY,
  FAVORITE_TARGETS,
  TARGET_INFO,
  type CallTargetId,
  type CallTargetInfo,
  type CallRecord,
  type ExtractedTask,
  type TaskPriority,
  type TaskStatus,
} from '../lib/callState';
import { CallPanel } from './CallPanel';

type RightTab = 'directory' | 'tasks' | 'recent';

export const CommsScreen: React.FC = () => {
  const {
    activeCall, heldCalls, history, tasks,
    pendingReviewCount, openTaskCount,
    startCall, resumeCall, endCall,
  } = useCall();

  const [tab, setTab] = useState<RightTab>(
    pendingReviewCount > 0 ? 'tasks' : 'directory',
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.lg,
        padding: SPACE.lg,
        minHeight: 0,
        flex: 1,
      }}
    >
      {/* ── HEADER ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE.md,
          flexWrap: 'wrap',
        }}
      >
        <h1
          style={{
            fontFamily: FONTS.sans,
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            color: COLORS.textPrimary,
            margin: 0,
          }}
        >
          Comms
        </h1>
        <Mono tone="secondary" size="xs">
          // CALL · TASKS · DIRECTORY · HISTORY
        </Mono>
        <div style={{ flex: 1 }} />
        {pendingReviewCount > 0 && (
          <StatusPill
            label={`${pendingReviewCount} task${pendingReviewCount === 1 ? '' : 's'} need you`}
            tone="warn"
            pulse
            size="xs"
          />
        )}
        {openTaskCount > 0 && pendingReviewCount === 0 && (
          <StatusPill
            label={`${openTaskCount} open task${openTaskCount === 1 ? '' : 's'}`}
            tone="ok"
            size="xs"
          />
        )}
        {activeCall ? (
          <StatusPill
            label={TARGET_INFO[activeCall.target].label}
            tone="ok"
            pulse
            size="xs"
          />
        ) : (
          <StatusPill label="No active call" tone="neutral" size="xs" />
        )}
      </div>

      {/* ── HELD QUEUE ──────────────────────────────────────── */}
      {heldCalls.length > 0 && (
        <HeldQueue
          heldCalls={heldCalls}
          onResume={resumeCall}
          onEnd={endCall}
        />
      )}

      {/* ── 2-COL ROW ───────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(400px, 2fr) minmax(340px, 1fr)',
          gap: SPACE.lg,
          alignItems: 'start',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* LEFT — Active call */}
        <TacticalCard padding="none" style={{ minHeight: 520, display: 'flex' }}>
          {activeCall ? (
            <CallPanel />
          ) : (
            <EmptyState
              icon={<PhoneCall size={28} strokeWidth={1.5} color={COLORS.textDim} />}
              title="No active call"
              detail="Tap a contact in the directory to start a call. PULSE transcribes live, auto-executes routine actions, and gates the rest behind your approval."
            />
          )}
        </TacticalCard>

        {/* RIGHT — Tasks tile (always visible) + Directory/Recent
            tabs below. Sprint 2026-05-14 item 19. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg, minWidth: 0 }}>
          {/* Tasks tile — always rendered, never tabbed away. */}
          <TacticalCard padding="none">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.xs,
                padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surface,
                minHeight: 44,
              }}
            >
              <ListChecks size={12} strokeWidth={2} color={COLORS.textSecondary} />
              <Mono
                size="xs"
                style={{ color: COLORS.textPrimary, fontWeight: 700, letterSpacing: '0.14em' }}
              >
                TASKS
              </Mono>
              {pendingReviewCount > 0 && (
                <span
                  style={{
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
                  {pendingReviewCount} REVIEW
                </span>
              )}
              <Mono tone="muted" size="xs" style={{ marginLeft: 'auto' }}>
                {openTaskCount} open
              </Mono>
            </div>
            <div style={{ padding: SPACE.md, maxHeight: 360, overflowY: 'auto' }}>
              <TasksTab tasks={tasks} />
            </div>
          </TacticalCard>

          {/* Directory / Recent — tabbed (Tasks is now its own card). */}
          <TacticalCard padding="none">
            <DirRecentTabs
              active={tab === 'tasks' ? 'directory' : tab}
              onChange={setTab as (t: 'directory' | 'recent') => void}
              recentCount={history.length}
            />
            <div style={{ padding: SPACE.md }}>
              <AnimatePresence mode="wait">
                {tab !== 'recent' && (
                  <TabPanel key="directory">
                    <DirectoryTab
                      activeCallId={activeCall?.id}
                      onCall={(id) => startCall(id)}
                    />
                  </TabPanel>
                )}
                {tab === 'recent' && (
                  <TabPanel key="recent">
                    <RecentTab history={history} />
                  </TabPanel>
                )}
              </AnimatePresence>
            </div>
          </TacticalCard>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Tabs
// ════════════════════════════════════════════════════════════════

// Slim Directory/Recent tab strip — used after splitting Tasks into
// its own always-visible tile (sprint 2026-05-14 item 19).
const DirRecentTabs: React.FC<{
  active: 'directory' | 'recent';
  onChange: (t: 'directory' | 'recent') => void;
  recentCount: number;
}> = ({ active, onChange, recentCount }) => (
  <div
    style={{
      display: 'flex',
      borderBottom: `1px solid ${COLORS.border}`,
      background: COLORS.surface,
    }}
  >
    <TabButton
      label="Directory"
      icon={<Users size={12} strokeWidth={2} />}
      active={active === 'directory'}
      onClick={() => onChange('directory')}
      count={CALL_DIRECTORY.length}
    />
    <TabButton
      label="Recent"
      icon={<History size={12} strokeWidth={2} />}
      active={active === 'recent'}
      onClick={() => onChange('recent')}
      count={recentCount}
    />
  </div>
);

const RightTabs: React.FC<{
  active: RightTab;
  onChange: (t: RightTab) => void;
  taskCount: number;
  pendingCount: number;
  recentCount: number;
}> = ({ active, onChange, taskCount, pendingCount, recentCount }) => (
  <div
    style={{
      display: 'flex',
      borderBottom: `1px solid ${COLORS.border}`,
      background: COLORS.surface,
    }}
  >
    <TabButton
      label="Directory"
      icon={<Users size={12} strokeWidth={2} />}
      active={active === 'directory'}
      onClick={() => onChange('directory')}
      count={CALL_DIRECTORY.length}
    />
    <TabButton
      label="Tasks"
      icon={<ListChecks size={12} strokeWidth={2} />}
      active={active === 'tasks'}
      onClick={() => onChange('tasks')}
      count={taskCount}
      pulseCount={pendingCount}
    />
    <TabButton
      label="Recent"
      icon={<History size={12} strokeWidth={2} />}
      active={active === 'recent'}
      onClick={() => onChange('recent')}
      count={recentCount}
    />
  </div>
);

const TabButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count?: number;
  pulseCount?: number;
}> = ({ label, icon, active, onClick, count, pulseCount }) => (
  <button
    type="button"
    onClick={onClick}
    aria-current={active ? 'page' : undefined}
    style={{
      position: 'relative',
      flex: 1,
      padding: `${SPACE.sm + 2}px ${SPACE.sm}px`,
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      color: active ? COLORS.textPrimary : COLORS.textMuted,
      fontFamily: FONTS.mono,
      fontSize: 11,
      letterSpacing: '0.14em',
      textTransform: 'uppercase',
      fontWeight: active ? 700 : 500,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACE.xs,
      minHeight: 44,
    }}
  >
    {icon}
    {label}
    {count !== undefined && count > 0 && (
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 10,
          fontWeight: 700,
          color: pulseCount && pulseCount > 0 ? COLORS.accent : COLORS.textSecondary,
          marginLeft: 2,
        }}
      >
        {count}
      </span>
    )}
    {active && (
      <motion.span
        layoutId="comms-tab-underline"
        aria-hidden
        transition={{ duration: MOTION.fast, ease: MOTION.ease }}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: -1,
          height: 2,
          background: COLORS.accent,
        }}
      />
    )}
  </button>
);

const TabPanel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: MOTION.fast, ease: MOTION.ease }}
  >
    {children}
  </motion.div>
);

// ════════════════════════════════════════════════════════════════
// Directory tab
// ════════════════════════════════════════════════════════════════

const DirectoryTab: React.FC<{
  activeCallId?: string;
  onCall: (id: CallTargetId) => void;
}> = ({ activeCallId, onCall }) => {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return CALL_DIRECTORY;
    return CALL_DIRECTORY.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.code.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.detail.toLowerCase().includes(q),
    );
  }, [query]);
  const favorites = filtered.filter((t) => FAVORITE_TARGETS.includes(t.id));
  const others = filtered.filter((t) => !FAVORITE_TARGETS.includes(t.id));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      <SearchInput value={query} onChange={setQuery} />
      {favorites.length > 0 && (
        <>
          <Mono tone="dim" size="xs" style={{ letterSpacing: '0.14em' }}>
            // FAVORITES
          </Mono>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
            {favorites.map((t) => (
              <DirectoryRow
                key={t.id}
                target={t}
                onCall={() => onCall(t.id)}
                dimmed={!!activeCallId}
                favorite
              />
            ))}
          </div>
        </>
      )}
      {others.length > 0 && (
        <>
          <Mono
            tone="dim"
            size="xs"
            style={{ letterSpacing: '0.14em', marginTop: favorites.length > 0 ? SPACE.sm : 0 }}
          >
            // ALL CONTACTS
          </Mono>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
            {others.map((t) => (
              <DirectoryRow
                key={t.id}
                target={t}
                onCall={() => onCall(t.id)}
                dimmed={!!activeCallId}
              />
            ))}
          </div>
        </>
      )}
      {filtered.length === 0 && (
        <Mono tone="dim" size="xs" style={{ textAlign: 'center', padding: SPACE.md }}>
          No matches
        </Mono>
      )}
    </div>
  );
};

const DirectoryRow: React.FC<{
  target: CallTargetInfo;
  onCall: () => void;
  dimmed?: boolean;
  favorite?: boolean;
}> = ({ target, onCall, dimmed, favorite }) => (
  <button
    type="button"
    onClick={onCall}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.sm,
      padding: `${SPACE.sm}px ${SPACE.md}px`,
      background: COLORS.bgDeep,
      border: `1px solid ${favorite ? COLORS.borderHover : COLORS.border}`,
      borderRadius: RADIUS.sm,
      cursor: 'pointer',
      opacity: dimmed ? 0.55 : 1,
      textAlign: 'left',
      fontFamily: FONTS.sans,
      transition: 'background 0.15s ease, border-color 0.15s ease',
      width: '100%',
    }}
    onMouseEnter={(e) => {
      if (dimmed) return;
      e.currentTarget.style.background = COLORS.surfaceHover;
      e.currentTarget.style.borderColor = COLORS.borderHover;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = COLORS.bgDeep;
      e.currentTarget.style.borderColor = favorite ? COLORS.borderHover : COLORS.border;
    }}
  >
    <PhoneCall size={12} strokeWidth={2} color={COLORS.accent} style={{ flexShrink: 0 }} />
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 13,
          fontWeight: 500,
          color: COLORS.textPrimary,
          letterSpacing: '-0.005em',
        }}
      >
        {target.label}
      </div>
      <Mono tone="dim" size="xs">
        LINK.{target.code} · {target.detail}
      </Mono>
    </div>
  </button>
);

// ════════════════════════════════════════════════════════════════
// Tasks tab
// ════════════════════════════════════════════════════════════════

const TasksTab: React.FC<{ tasks: ExtractedTask[] }> = ({ tasks }) => {
  const { approveTask, rejectTask, completeTask } = useCall();
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => {
    if (showAll) return tasks;
    return tasks.filter((t) => t.status !== 'rejected' && t.status !== 'done');
  }, [tasks, showAll]);

  const needsYou = visible.filter((t) => t.status === 'proposed');
  const running = visible.filter(
    (t) => t.status === 'approved' || t.status === 'edited' || t.status === 'in_progress',
  );
  const done = visible.filter((t) => t.status === 'done');
  const skipped = visible.filter((t) => t.status === 'rejected');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.xs,
        }}
      >
        <Mono tone="dim" size="xs" style={{ letterSpacing: '0.14em' }}>
          // {showAll ? 'ALL' : 'OPEN'} · {visible.length}
        </Mono>
        <div style={{ flex: 1 }} />
        <button
          type="button"
          onClick={() => setShowAll((s) => !s)}
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
          {showAll ? 'OPEN ONLY' : 'SHOW ALL'}
        </button>
      </div>

      {visible.length === 0 && (
        <Mono tone="dim" size="xs" style={{ textAlign: 'center', padding: SPACE.lg }}>
          {showAll ? 'NO TASKS YET' : 'ALL CLEAR'}
        </Mono>
      )}

      {needsYou.length > 0 && (
        <TaskGroup label="NEEDS YOU" color={COLORS.accent}>
          {needsYou.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onApprove={() => approveTask(t.id)}
              onReject={() => rejectTask(t.id)}
            />
          ))}
        </TaskGroup>
      )}

      {running.length > 0 && (
        <TaskGroup label="RUNNING" color={COLORS.info}>
          {running.map((t) => (
            <TaskCard
              key={t.id}
              task={t}
              onComplete={() => completeTask(t.id)}
            />
          ))}
        </TaskGroup>
      )}

      {done.length > 0 && (
        <TaskGroup label="DONE" color={COLORS.ok}>
          {done.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </TaskGroup>
      )}

      {skipped.length > 0 && (
        <TaskGroup label="REJECTED" color={COLORS.textMuted}>
          {skipped.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
        </TaskGroup>
      )}
    </div>
  );
};

const TaskGroup: React.FC<{
  label: string;
  color: string;
  children: React.ReactNode;
}> = ({ label, color, children }) => (
  <section>
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: SPACE.xs,
        marginBottom: SPACE.sm,
        paddingBottom: SPACE.xs,
        borderBottom: `1px solid ${color}30`,
      }}
    >
      <Mono size="xs" style={{ color, fontWeight: 700, letterSpacing: '0.16em' }}>
        {label}
      </Mono>
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>{children}</div>
  </section>
);

const priorityColor = (p: TaskPriority): string =>
  p === 'stat' ? COLORS.accent : p === 'routine' ? COLORS.warn : COLORS.textMuted;

const priorityLabel = (p: TaskPriority) =>
  p === 'stat' ? 'STAT' : p === 'routine' ? 'ROUTINE' : 'FYI';

const TaskCard: React.FC<{
  task: ExtractedTask;
  onApprove?: () => void;
  onReject?: () => void;
  onComplete?: () => void;
}> = ({ task, onApprove, onReject, onComplete }) => {
  const pColor = priorityColor(task.priority);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        padding: SPACE.sm,
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
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 13,
          fontWeight: 500,
          color: COLORS.textPrimary,
          lineHeight: 1.35,
          marginBottom: 4,
        }}
      >
        {task.text}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
        <UserIcon size={9} strokeWidth={2} color={COLORS.textMuted} />
        <Mono tone="muted" size="xs">
          @{task.assignee}
        </Mono>
      </div>
      {(onApprove || onReject || onComplete) && (
        <div style={{ display: 'flex', gap: 4, marginTop: SPACE.xs }}>
          {onApprove && (
            <TacticalButton
              variant="primary"
              size="sm"
              icon={<Check size={10} strokeWidth={2.5} />}
              onClick={onApprove}
            >
              Approve
            </TacticalButton>
          )}
          {onReject && (
            <TacticalButton
              variant="ghost"
              size="sm"
              icon={<X size={10} strokeWidth={2.5} />}
              onClick={onReject}
            >
              Reject
            </TacticalButton>
          )}
          {onComplete && (
            <TacticalButton
              variant="ghost"
              size="sm"
              icon={<Check size={10} strokeWidth={2.5} />}
              onClick={onComplete}
            >
              Mark done
            </TacticalButton>
          )}
        </div>
      )}
    </motion.div>
  );
};

// ════════════════════════════════════════════════════════════════
// Recent calls tab
// ════════════════════════════════════════════════════════════════

const formatRelative = (msAgo: number): string => {
  const sec = Math.floor(msAgo / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
};

const RecentTab: React.FC<{ history: CallRecord[] }> = ({ history }) => {
  if (history.length === 0) {
    return (
      <EmptyState
        compact
        icon={<History size={20} strokeWidth={1.5} color={COLORS.textDim} />}
        title="No call history yet"
        detail="Past calls (transcripts + extracted actions) appear here."
      />
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
      {history.slice(0, 10).map((r) => (
        <RecentCallRow key={r.id} record={r} />
      ))}
    </div>
  );
};

const RecentCallRow: React.FC<{ record: CallRecord }> = ({ record }) => {
  const info = TARGET_INFO[record.target];
  const dur = `${Math.floor(record.durationSec / 60)}:${(record.durationSec % 60).toString().padStart(2, '0')}`;
  const ago = formatRelative(Date.now() - record.endedAt);
  const { stat, routine, fyi, pendingReview } = record.taskSummary;
  return (
    <div
      style={{
        padding: SPACE.sm,
        background: COLORS.bgDeep,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: SPACE.xs,
          marginBottom: 4,
        }}
      >
        <PhoneCall size={10} strokeWidth={2} color={COLORS.textSecondary} style={{ flexShrink: 0 }} />
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.textPrimary,
            letterSpacing: '-0.005em',
          }}
        >
          {info.label}
        </span>
        <div style={{ flex: 1 }} />
        <Mono tone="muted" size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {dur} · {ago}
        </Mono>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, flexWrap: 'wrap' }}>
        {stat > 0    && <TaskChip count={stat}    label="STAT" color={COLORS.accent} />}
        {routine > 0 && <TaskChip count={routine} label="ROUT" color={COLORS.warn} />}
        {fyi > 0     && <TaskChip count={fyi}     label="FYI"  color={COLORS.textMuted} />}
        {pendingReview > 0 && (
          <Mono size="xs" style={{ color: COLORS.warn, fontWeight: 700, letterSpacing: '0.12em' }}>
            · {pendingReview} pending review
          </Mono>
        )}
        {stat + routine + fyi === 0 && (
          <Mono tone="dim" size="xs">
            no tasks extracted
          </Mono>
        )}
      </div>
    </div>
  );
};

const TaskChip: React.FC<{ count: number; label: string; color: string }> = ({
  count, label, color,
}) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 8px',
      background: `${color}14`,
      border: `1px solid ${color}40`,
      borderRadius: RADIUS.full,
      fontFamily: FONTS.mono,
      fontSize: 10,
      fontWeight: 700,
      color,
      letterSpacing: '0.1em',
    }}
  >
    {count} {label}
  </span>
);

// ════════════════════════════════════════════════════════════════
// Held queue chips
// ════════════════════════════════════════════════════════════════

const HeldQueue: React.FC<{
  heldCalls: ReturnType<typeof useCall>['heldCalls'];
  onResume: (id: string) => void;
  onEnd: (id: string) => void;
}> = ({ heldCalls, onResume, onEnd }) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.sm }}>
    <Mono tone="dim" size="xs" style={{ alignSelf: 'center', letterSpacing: '0.14em' }}>
      // HOLD ·
    </Mono>
    {heldCalls.map((h) => {
      const info = TARGET_INFO[h.target];
      return (
        <motion.div
          key={h.id}
          layout
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
            padding: `${SPACE.xs}px ${SPACE.sm}px`,
            background: COLORS.surface,
            border: `1px solid ${COLORS.warn}`,
            borderRadius: RADIUS.full,
          }}
        >
          <Pause size={10} strokeWidth={2.25} color={COLORS.warn} />
          <Mono size="xs" style={{ color: COLORS.warn, fontWeight: 700, letterSpacing: '0.12em' }}>
            HOLD
          </Mono>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 12,
              color: COLORS.textPrimary,
              fontWeight: 500,
            }}
          >
            {info.label}
          </span>
          <button
            type="button"
            onClick={() => onResume(h.id)}
            aria-label="Resume call"
            style={{
              background: 'transparent',
              border: 'none',
              color: COLORS.ok,
              cursor: 'pointer',
              padding: 4,
              margin: -4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PhoneCall size={12} strokeWidth={2.25} />
          </button>
          <button
            type="button"
            onClick={() => onEnd(h.id)}
            aria-label="End held call"
            style={{
              background: 'transparent',
              border: 'none',
              color: COLORS.textMuted,
              cursor: 'pointer',
              padding: 4,
              margin: -4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <PhoneOff size={12} strokeWidth={2.25} />
          </button>
        </motion.div>
      );
    })}
  </div>
);

// ════════════════════════════════════════════════════════════════
// Misc helpers
// ════════════════════════════════════════════════════════════════

const SearchInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({
  value, onChange,
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.xs,
      padding: `${SPACE.xs}px ${SPACE.sm}px`,
      background: COLORS.bgDeep,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
    }}
  >
    <Search size={12} strokeWidth={2} color={COLORS.textDim} style={{ flexShrink: 0 }} />
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Search contacts…"
      style={{
        flex: 1,
        background: 'transparent',
        border: 'none',
        outline: 'none',
        color: COLORS.textPrimary,
        fontFamily: FONTS.sans,
        fontSize: 12,
        letterSpacing: '-0.003em',
      }}
    />
    {value && (
      <button
        type="button"
        onClick={() => onChange('')}
        aria-label="Clear search"
        style={{
          background: 'transparent',
          border: 'none',
          color: COLORS.textMuted,
          cursor: 'pointer',
          padding: 0,
          fontFamily: FONTS.mono,
          fontSize: 11,
        }}
      >
        ✕
      </button>
    )}
  </div>
);

const EmptyState: React.FC<{
  icon: React.ReactNode;
  title: string;
  detail: string;
  compact?: boolean;
}> = ({ icon, title, detail, compact }) => (
  <div
    style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: compact ? SPACE.md : SPACE.xl,
      gap: SPACE.sm,
      textAlign: 'center',
      minHeight: compact ? 80 : 320,
    }}
  >
    {icon}
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: compact ? 13 : 15,
        fontWeight: 500,
        color: COLORS.textSecondary,
        marginTop: SPACE.xs,
        letterSpacing: '-0.005em',
      }}
    >
      {title}
    </div>
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: 12,
        color: COLORS.textDim,
        maxWidth: 360,
        lineHeight: 1.5,
      }}
    >
      {detail}
    </div>
  </div>
);
