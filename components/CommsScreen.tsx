import React from 'react';
import { PhoneCall, History, Users, Search } from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
} from './design';
import { useCall, CALL_TARGET_LABEL } from '../lib/callState';
import { CallPanel } from './CallPanel';

/**
 * CommsScreen — top-level Comms tab.
 *
 * Three regions:
 *   1. ACTIVE CALL   — renders the live in-the-moment CallPanel if a
 *                       call is in progress, otherwise an empty state.
 *   2. DIRECTORY     — list of every contact the operator can call.
 *                       Click → useCall().startCall(target). Phase-1
 *                       skeleton: two hardcoded entries to mirror the
 *                       sidebar quick-paging targets. The full N+
 *                       directory lands in a later phase.
 *   3. RECENT CALLS  — history of past calls (transcripts, extracted
 *                       actions). Phase-1 skeleton: empty state. Real
 *                       history persistence lands with the unified
 *                       Action type rework.
 */
export const CommsScreen: React.FC = () => {
  const { activeCall, startCall } = useCall();

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
        <StatusPill
          label={activeCall ? CALL_TARGET_LABEL[activeCall] : 'No active call'}
          tone={activeCall ? 'ok' : 'neutral'}
          pulse={!!activeCall}
          size="xs"
        />
      </div>

      {/* ── 3-COL ROW ─────────────────────────────────────────
          Live call (2 cols) · Directory + History stacked (1 col).
          On narrower viewports, falls back to single column. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: SPACE.lg,
          alignItems: 'start',
        }}
      >
        {/* Active call */}
        <TacticalCard padding="none" style={{ minHeight: 480, display: 'flex' }}>
          {activeCall ? (
            <CallPanel />
          ) : (
            <EmptyState
              icon={<PhoneCall size={24} strokeWidth={1.5} color={COLORS.textDim} />}
              title="No active call"
              detail="Pick a contact from the directory or use a sidebar quick-paging shortcut to start a call."
            />
          )}
        </TacticalCard>

        {/* Right column: directory + history stacked */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg, minWidth: 0 }}>
          {/* Directory */}
          <TacticalCard padding="md">
            <SectionHeader icon={<Users size={14} />} title="Directory" hint="Quick paging" />
            <Mono
              tone="dim"
              size="xs"
              style={{ display: 'block', marginBottom: SPACE.sm, lineHeight: 1.5 }}
            >
              Phase-1 skeleton. Full N+ contact directory (RT, Pharmacy, on-call
              physicians, social work, EVS, transfer center) lands in the next pass.
            </Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
              <DirectoryRow
                label="ER Charge Nurse"
                code="LINK.NURSE"
                onClick={() => startCall('nurse')}
                disabled={activeCall !== null}
              />
              <DirectoryRow
                label="Blood Bank"
                code="LINK.BLOOD_BANK"
                onClick={() => startCall('blood_bank')}
                disabled={activeCall !== null}
              />
            </div>
          </TacticalCard>

          {/* History */}
          <TacticalCard padding="md">
            <SectionHeader icon={<History size={14} />} title="Recent Calls" hint="Last 24h" />
            <EmptyState
              compact
              icon={<History size={20} strokeWidth={1.5} color={COLORS.textDim} />}
              title="No call history yet"
              detail="Past calls (transcripts and extracted actions) will appear here once the action queue lands."
            />
          </TacticalCard>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────

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

const DirectoryRow: React.FC<{
  label: string;
  code: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ label, code, onClick, disabled }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.sm,
      padding: `${SPACE.sm}px ${SPACE.md}px`,
      background: COLORS.bgDeep,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      textAlign: 'left',
      fontFamily: FONTS.sans,
      transition: 'background 0.15s ease, border-color 0.15s ease',
    }}
    onMouseEnter={(e) => {
      if (disabled) return;
      e.currentTarget.style.background = COLORS.surfaceHover;
      e.currentTarget.style.borderColor = COLORS.borderHover;
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = COLORS.bgDeep;
      e.currentTarget.style.borderColor = COLORS.border;
    }}
  >
    <PhoneCall size={12} strokeWidth={2} color={COLORS.accent} />
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
        {label}
      </div>
      <Mono tone="dim" size="xs">
        {code}
      </Mono>
    </div>
  </button>
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
