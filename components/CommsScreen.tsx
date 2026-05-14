/**
 * CommsScreen — the full Comms surface.
 *
 * Two-column desktop layout:
 *
 *   LEFT (2 cols)             RIGHT (1 col, stacked)
 *   ┌─────────────────┐       ┌──────────────────┐
 *   │ Held queue chip │       │ Directory        │
 *   │ (if any)        │       │  Favorites       │
 *   ├─────────────────┤       │  All contacts    │
 *   │                 │       └──────────────────┘
 *   │  Active call    │       ┌──────────────────┐
 *   │  (CallPanel)    │       │ Recent calls     │
 *   │  or empty state │       │  with task summary
 *   │                 │       └──────────────────┘
 *   └─────────────────┘
 *
 * On narrower viewports the columns stack.
 */

import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  PhoneCall,
  History,
  Users,
  Search,
  PhoneOff,
  Pause,
  ListChecks,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
  TacticalButton,
} from './design';
import {
  useCall,
  CALL_DIRECTORY,
  FAVORITE_TARGETS,
  TARGET_INFO,
  type CallTargetId,
  type CallTargetInfo,
  type CallRecord,
} from '../lib/callState';
import { CallPanel } from './CallPanel';

export const CommsScreen: React.FC = () => {
  const {
    activeCall,
    heldCalls,
    history,
    pendingReviewCount,
    openTaskCount,
    startCall,
    resumeCall,
    endCall,
  } = useCall();

  const [query, setQuery] = useState('');

  const filteredDirectory = useMemo(() => {
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

  const favorites = useMemo(
    () => filteredDirectory.filter((t) => FAVORITE_TARGETS.includes(t.id)),
    [filteredDirectory],
  );
  const others = useMemo(
    () => filteredDirectory.filter((t) => !FAVORITE_TARGETS.includes(t.id)),
    [filteredDirectory],
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
      {/* ── HEADER ───────────────────────────────────────────── */}
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
          // CALL CONSOLE · DIRECTORY · HISTORY
        </Mono>
        <div style={{ flex: 1 }} />
        {pendingReviewCount > 0 && (
          <StatusPill
            label={`${pendingReviewCount} task${pendingReviewCount === 1 ? '' : 's'} pending review`}
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

      {/* ── HELD QUEUE (if any) ──────────────────────────────── */}
      {heldCalls.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: SPACE.sm,
          }}
        >
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
                  onClick={() => resumeCall(h.id)}
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
                  onClick={() => endCall(h.id)}
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
      )}

      {/* ── 2-COL ROW ────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(400px, 2fr) minmax(320px, 1fr)',
          gap: SPACE.lg,
          alignItems: 'start',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* LEFT — Active call panel */}
        <TacticalCard padding="none" style={{ minHeight: 520, display: 'flex' }}>
          {activeCall ? (
            <CallPanel />
          ) : (
            <EmptyState
              icon={<PhoneCall size={28} strokeWidth={1.5} color={COLORS.textDim} />}
              title="No active call"
              detail="Tap a contact in the directory to start a call. PULSE will transcribe, extract action items, and gate execution behind your approval."
            />
          )}
        </TacticalCard>

        {/* RIGHT — Directory + history */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.lg,
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <TacticalCard padding="md">
            <SectionHeader
              icon={<Users size={14} strokeWidth={1.75} />}
              title="Directory"
              hint={`${CALL_DIRECTORY.length} contacts`}
            />
            <SearchInput value={query} onChange={setQuery} />
            <DirectoryList
              favorites={favorites}
              others={others}
              activeCallId={activeCall?.id}
              onCall={(id) => startCall(id)}
            />
          </TacticalCard>

          <TacticalCard padding="md">
            <SectionHeader
              icon={<History size={14} strokeWidth={1.75} />}
              title="Recent calls"
              hint={history.length === 0 ? 'No history yet' : `${history.length} call${history.length === 1 ? '' : 's'}`}
            />
            {history.length === 0 ? (
              <EmptyState
                compact
                icon={<History size={20} strokeWidth={1.5} color={COLORS.textDim} />}
                title="No call history yet"
                detail="Past calls (transcripts + extracted actions) appear here."
              />
            ) : (
              <RecentCallsList records={history.slice(0, 8)} />
            )}
          </TacticalCard>
        </div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Directory
// ════════════════════════════════════════════════════════════════

const DirectoryList: React.FC<{
  favorites: CallTargetInfo[];
  others: CallTargetInfo[];
  activeCallId?: string;
  onCall: (id: CallTargetId) => void;
}> = ({ favorites, others, activeCallId, onCall }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
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
    {favorites.length === 0 && others.length === 0 && (
      <Mono tone="dim" size="xs" style={{ textAlign: 'center', padding: SPACE.md }}>
        No matches
      </Mono>
    )}
  </div>
);

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
// Recent calls
// ════════════════════════════════════════════════════════════════

const RecentCallsList: React.FC<{ records: CallRecord[] }> = ({ records }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
    {records.map((r) => (
      <RecentCallRow key={r.id} record={r} />
    ))}
  </div>
);

const formatRelative = (msAgo: number): string => {
  const sec = Math.floor(msAgo / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m ago`;
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
        {stat > 0 && (
          <TaskChip count={stat} label="STAT" color={COLORS.accent} />
        )}
        {routine > 0 && (
          <TaskChip count={routine} label="ROUT" color={COLORS.warn} />
        )}
        {fyi > 0 && (
          <TaskChip count={fyi} label="FYI" color={COLORS.textMuted} />
        )}
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
  count,
  label,
  color,
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
// Helpers
// ════════════════════════════════════════════════════════════════

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  hint?: string;
}> = ({ icon, title, hint }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.sm,
      marginBottom: SPACE.sm,
      paddingBottom: SPACE.sm,
      borderBottom: `1px solid ${COLORS.border}`,
    }}
  >
    <span style={{ color: COLORS.textSecondary }}>{icon}</span>
    <BracketLabel tone="primary" size="xs">
      {title}
    </BracketLabel>
    {hint && (
      <>
        <div style={{ flex: 1 }} />
        <Mono tone="dim" size="xs">
          {hint}
        </Mono>
      </>
    )}
  </div>
);

const SearchInput: React.FC<{ value: string; onChange: (v: string) => void }> = ({
  value,
  onChange,
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
      marginBottom: SPACE.sm,
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
