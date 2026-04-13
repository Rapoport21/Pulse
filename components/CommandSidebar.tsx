import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Radio,
  ShieldAlert,
  PhoneCall,
  PhoneOff,
  Bot,
  Activity,
  User,
  CheckCircle2,
  Clock,
  Siren,
} from 'lucide-react';
import type { UrgentTask } from '../lib/surgeTaskTemplates';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  CHROME,
  Mono,
  BracketLabel,
  StatusPill,
  CornerBracket,
  TacticalCard,
  TacticalButton,
  KbdKey,
  ScanningLine,
  Divider,
} from './design';

interface TranscriptLine {
  speaker: 'me' | 'them' | 'ai';
  text: string;
}

interface ActionTask {
  task: string;
  assignee: string;
}

interface CommandSidebarProps {
  isSurgeActive: boolean;
  surgeActivatedAt: number | null;
  urgentTasks: UrgentTask[];
  onActivateSurge: () => void;
  onDeactivateSurge: () => void;
}

const formatActivatedTime = (ts: number | null) => {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// ─────────────────────────────────────────────────────────────────────────
// Category header — "// SECTION · ID" mono row
// ─────────────────────────────────────────────────────────────────────────
const CategoryHeader: React.FC<{
  id: string;
  label: string;
  meta?: React.ReactNode;
}> = ({ id, label, meta }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACE.sm,
      padding: `${SPACE.sm}px ${SPACE.md}px`,
      borderBottom: `1px solid ${COLORS.border}`,
      background: COLORS.bgDeep,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
      <Mono tone="dim" size="xs">
        //
      </Mono>
      <BracketLabel tone="secondary" size="xs">
        {id}
      </BracketLabel>
      <Mono tone="secondary" size="xs" style={{ whiteSpace: 'nowrap' }}>
        {label}
      </Mono>
    </div>
    {meta && <div style={{ flexShrink: 0 }}>{meta}</div>}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Quick command row — hoverable tactical tree entry with keybinding hint
// ─────────────────────────────────────────────────────────────────────────
const CommandRow: React.FC<{
  icon: React.ReactNode;
  iconColor: string;
  label: string;
  code: string;
  hint: string;
  onClick: () => void;
}> = ({ icon, iconColor, label, code, hint, onClick }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.sm,
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        background: hovered ? COLORS.surfaceElev : 'transparent',
        borderLeft: `2px solid ${hovered ? COLORS.borderStrong : 'transparent'}`,
        cursor: 'pointer',
        transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
        outline: 'none',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: 22,
          height: 22,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${iconColor}1a`,
          border: `1px solid ${iconColor}55`,
          borderRadius: RADIUS.sm,
          color: iconColor,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 12,
            fontWeight: 500,
            color: hovered ? COLORS.textPrimary : COLORS.textSecondary,
            letterSpacing: '-0.005em',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
        <Mono tone="dim" size="xs">
          {code}
        </Mono>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
        {hint.split('+').map((k, i, arr) => (
          <React.Fragment key={i}>
            <KbdKey>{k}</KbdKey>
            {i < arr.length - 1 && (
              <Mono tone="dim" size="xs">
                +
              </Mono>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Feed entry — compact tactical packet for the live feed
// ─────────────────────────────────────────────────────────────────────────
const FeedEntry: React.FC<{
  sourceId: string;
  source: string;
  sourceTone: 'info' | 'warn' | 'crit' | 'ok';
  text: string;
  time: string;
  critical?: boolean;
}> = ({ sourceId, source, sourceTone, text, time, critical }) => {
  const sourceColor =
    sourceTone === 'info'
      ? COLORS.info
      : sourceTone === 'warn'
      ? COLORS.warn
      : sourceTone === 'crit'
      ? COLORS.crit
      : COLORS.ok;

  return (
    <div
      style={{
        position: 'relative',
        padding: `${SPACE.sm}px ${SPACE.md}px`,
        background: critical ? `${COLORS.accent}0f` : COLORS.surface,
        border: `1px solid ${critical ? COLORS.accent : COLORS.border}`,
        borderRadius: RADIUS.sm,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.sm,
          marginBottom: 4,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, minWidth: 0 }}>
          <span
            style={{
              width: 5,
              height: 5,
              borderRadius: RADIUS.full,
              background: sourceColor,
              boxShadow: `0 0 6px ${sourceColor}`,
              flexShrink: 0,
            }}
          />
          <Mono tone="dim" size="xs">
            {sourceId}
          </Mono>
          <Mono
            size="xs"
            style={{
              color: sourceColor,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {source}
          </Mono>
        </div>
        <Mono tone="dim" size="xs" style={{ flexShrink: 0 }}>
          {time}
        </Mono>
      </div>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 12,
          color: critical ? COLORS.textPrimary : COLORS.textSecondary,
          lineHeight: 1.4,
          letterSpacing: '-0.003em',
        }}
      >
        {text}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Transcript line — tactical data packet styling
// ─────────────────────────────────────────────────────────────────────────
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
          fontSize: 12,
          color: COLORS.textPrimary,
          lineHeight: 1.45,
          letterSpacing: '-0.003em',
        }}
      >
        {line.text}
      </div>
    </motion.div>
  );
};

export const CommandSidebar = ({
  isSurgeActive,
  surgeActivatedAt,
  urgentTasks,
  onActivateSurge,
  onDeactivateSurge,
}: CommandSidebarProps) => {
  const [showStandDownConfirm, setShowStandDownConfirm] = useState(false);
  const [activeCall, setActiveCall] = useState<'nurse' | 'blood_bank' | null>(null);
  const [callState, setCallState] = useState<
    'calling' | 'connected' | 'ai_speaking' | 'ended'
  >('ended');
  const [callDuration, setCallDuration] = useState(0);
  const [transcript, setTranscript] = useState<TranscriptLine[]>([]);
  const [actionTasks, setActionTasks] = useState<ActionTask[]>([]);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === 'connected' || callState === 'ai_speaking') {
      interval = setInterval(() => setCallDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
    }
  }, [transcript]);

  // Mock call simulation
  useEffect(() => {
    if (callState === 'connected') {
      let sequence: {
        t: number;
        speaker: 'me' | 'them' | 'ai';
        text: string;
        task?: { task: string; assignee: string };
      }[] = [];

      if (activeCall === 'nurse') {
        sequence = [
          { t: 1000, speaker: 'them', text: 'ER Charge Nurse, go ahead.' },
          {
            t: 3000,
            speaker: 'me',
            text: 'We have 4 criticals inbound. Need 2 beds in Med/Surg immediately.',
          },
          {
            t: 6000,
            speaker: 'them',
            text: 'Understood. I will expedite discharges for room 204 and 206.',
          },
          {
            t: 9000,
            speaker: 'ai',
            text: '[AI Note] Action identified: Expedite discharges for rooms 204, 206.',
            task: {
              task: 'Expedite discharges (204, 206)',
              assignee: 'ER Charge Nurse',
            },
          },
          {
            t: 12000,
            speaker: 'me',
            text: 'Also need respiratory therapy down here.',
          },
          { t: 15000, speaker: 'them', text: 'Paging RT now.' },
          {
            t: 17000,
            speaker: 'ai',
            text: '[AI Note] Action identified: Page Respiratory Therapy to ER.',
            task: { task: 'Page RT to ER', assignee: 'ER Charge Nurse' },
          },
        ];
      } else if (activeCall === 'blood_bank') {
        sequence = [
          { t: 1000, speaker: 'them', text: 'Blood Bank, this is Sarah.' },
          {
            t: 3000,
            speaker: 'me',
            text: 'Sarah, we have a massive transfusion protocol initiating in Trauma 1.',
          },
          {
            t: 6000,
            speaker: 'them',
            text: 'Copy that. MTP for Trauma 1. Preparing first cooler now.',
          },
          {
            t: 9000,
            speaker: 'ai',
            text: '[AI Note] Action identified: Prepare MTP cooler for Trauma 1.',
            task: {
              task: 'Prepare MTP cooler (Trauma 1)',
              assignee: 'Blood Bank',
            },
          },
          {
            t: 12000,
            speaker: 'me',
            text: 'We also need 4 units of O-negative sent down immediately.',
          },
          {
            t: 15000,
            speaker: 'them',
            text: 'Sending 4 units O-negative via pneumatic tube.',
          },
          {
            t: 17000,
            speaker: 'ai',
            text: '[AI Note] Action identified: Send 4 units O-negative via tube.',
            task: { task: 'Send 4 units O-negative', assignee: 'Blood Bank' },
          },
        ];
      }

      const timeouts = sequence.map((step) =>
        setTimeout(() => {
          setTranscript((prev) => [...prev, { speaker: step.speaker, text: step.text }]);
          if (step.task) {
            setActionTasks((prev) => [...prev, step.task!]);
          }
        }, step.t),
      );

      return () => timeouts.forEach(clearTimeout);
    }
  }, [callState, activeCall]);

  const endCall = () => {
    setCallState('ended');
    setTimeout(() => setActiveCall(null), 500);
  };

  // Auto-end call when AI takes over
  useEffect(() => {
    if (callState === 'ai_speaking') {
      const timeout = setTimeout(() => {
        endCall();
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [callState]);

  const handleCall = (type: 'nurse' | 'blood_bank') => {
    setActiveCall(type);
    setCallState('calling');
    setCallDuration(0);
    setTranscript([]);
    setActionTasks([]);
    setTimeout(() => {
      if (callState !== 'ended') setCallState('connected');
    }, 2000);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const ackedCount = urgentTasks.filter((t) => t.acknowledged).length;

  return (
    <aside
      style={{
        width: '100%',
        maxWidth: CHROME.sidebarWidth,
        borderLeft: `1px solid ${isSurgeActive ? COLORS.accent : COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
        background: isSurgeActive
          ? `linear-gradient(180deg, ${COLORS.accent}0a 0%, ${COLORS.bg} 100%)`
          : COLORS.bg,
        transition: `background ${MOTION.base}s ease, border-color ${MOTION.base}s ease`,
        fontFamily: FONTS.sans,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {isSurgeActive && <ScanningLine />}

      {/* ── Header strip ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.sm,
          padding: `${SPACE.md}px ${SPACE.md}px`,
          borderBottom: `1px solid ${COLORS.border}`,
          background: COLORS.surface,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
          <Radio
            size={12}
            strokeWidth={2}
            color={isSurgeActive ? COLORS.accent : COLORS.textMuted}
          />
          <BracketLabel tone={isSurgeActive ? 'accent' : 'secondary'} size="xs">
            CMD.NET
          </BracketLabel>
        </div>
        <StatusPill
          label={isSurgeActive ? 'Active' : 'Standby'}
          tone={isSurgeActive ? 'crit' : 'ok'}
          pulse={isSurgeActive}
          size="xs"
        />
      </div>

      {/* ── Scrollable body ───────────────────────────────────── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!activeCall && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: SPACE.md,
              gap: SPACE.md,
            }}
          >
            {/* ═══ Surge activation trigger ═══ */}
            {!isSurgeActive ? (
              <TacticalCard
                interactive
                role="button"
                tabIndex={0}
                onClick={onActivateSurge}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onActivateSurge();
                  }
                }}
                padding="none"
                style={{
                  cursor: 'pointer',
                  padding: `${SPACE.md}px ${SPACE.md}px`,
                  borderColor: `${COLORS.accent}55`,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: 6,
                  }}
                >
                  <Mono tone="dim" size="xs">
                    // TRIGGER.SURGE_L2
                  </Mono>
                  <BracketLabel tone="accent" size="xs">
                    ARM
                  </BracketLabel>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.sm,
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `${COLORS.accent}14`,
                      border: `1px solid ${COLORS.accent}`,
                      borderRadius: RADIUS.sm,
                      color: COLORS.accent,
                      flexShrink: 0,
                    }}
                  >
                    <ShieldAlert size={16} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 13,
                        fontWeight: 600,
                        color: COLORS.textPrimary,
                        letterSpacing: '-0.01em',
                        marginBottom: 2,
                      }}
                    >
                      Activate Surge Mode
                    </div>
                    <Mono tone="muted" size="xs">
                      Protocol Level 2 · All hands
                    </Mono>
                  </div>
                </div>
              </TacticalCard>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: MOTION.base, ease: MOTION.ease }}
              >
                <TacticalCard
                  highlight
                  padding="none"
                  style={{
                    padding: `${SPACE.md}px ${SPACE.md}px`,
                    borderColor: COLORS.accent,
                    background: `${COLORS.accent}12`,
                    boxShadow: `0 0 24px ${COLORS.accent}33`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: 6,
                    }}
                  >
                    <Mono tone="dim" size="xs">
                      // STATE.SURGE_L2
                    </Mono>
                    <StatusPill label="Armed" tone="crit" pulse size="xs" />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.sm,
                    }}
                  >
                    <motion.div
                      animate={{ opacity: [0.6, 1, 0.6] }}
                      transition={{ duration: 1.8, repeat: Infinity }}
                      style={{
                        width: 32,
                        height: 32,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: COLORS.accent,
                        borderRadius: RADIUS.sm,
                        color: COLORS.textPrimary,
                        flexShrink: 0,
                      }}
                    >
                      <Siren size={16} strokeWidth={2.5} />
                    </motion.div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 13,
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                          letterSpacing: '-0.01em',
                          marginBottom: 2,
                        }}
                      >
                        Surge Mode Active
                      </div>
                      <Mono tone="accent" size="xs">
                        T+ {formatActivatedTime(surgeActivatedAt)}
                      </Mono>
                    </div>
                  </div>
                  {/* ── Stand Down button ── */}
                  <AnimatePresence>
                    {!showStandDownConfirm ? (
                      <motion.button
                        key="standdown-trigger"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setShowStandDownConfirm(true)}
                        style={{
                          marginTop: SPACE.sm,
                          width: '100%',
                          padding: `${SPACE.xs}px 0`,
                          background: 'transparent',
                          border: `1px solid ${COLORS.accent}44`,
                          borderRadius: RADIUS.sm,
                          color: COLORS.accent,
                          fontFamily: FONTS.mono,
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase' as const,
                          cursor: 'pointer',
                          transition: `all ${MOTION.base}s ease`,
                        }}
                        onMouseEnter={(e) => {
                          (e.target as HTMLButtonElement).style.background = `${COLORS.accent}1a`;
                          (e.target as HTMLButtonElement).style.borderColor = COLORS.accent;
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLButtonElement).style.background = 'transparent';
                          (e.target as HTMLButtonElement).style.borderColor = `${COLORS.accent}44`;
                        }}
                      >
                        Stand Down
                      </motion.button>
                    ) : (
                      <motion.div
                        key="standdown-confirm"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          marginTop: SPACE.sm,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: SPACE.xs,
                        }}
                      >
                        <Mono tone="accent" size="xs" style={{ textAlign: 'center' }}>
                          Confirm surge deactivation?
                        </Mono>
                        <div style={{ display: 'flex', gap: SPACE.xs }}>
                          <button
                            onClick={() => {
                              onDeactivateSurge();
                              setShowStandDownConfirm(false);
                            }}
                            style={{
                              flex: 1,
                              padding: `${SPACE.xs}px 0`,
                              background: COLORS.accent,
                              border: 'none',
                              borderRadius: RADIUS.sm,
                              color: COLORS.bg,
                              fontFamily: FONTS.mono,
                              fontSize: 11,
                              fontWeight: 700,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase' as const,
                              cursor: 'pointer',
                            }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => setShowStandDownConfirm(false)}
                            style={{
                              flex: 1,
                              padding: `${SPACE.xs}px 0`,
                              background: 'transparent',
                              border: `1px solid ${COLORS.border}`,
                              borderRadius: RADIUS.sm,
                              color: COLORS.textSecondary,
                              fontFamily: FONTS.mono,
                              fontSize: 11,
                              fontWeight: 500,
                              letterSpacing: '0.06em',
                              textTransform: 'uppercase' as const,
                              cursor: 'pointer',
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TacticalCard>
              </motion.div>
            )}

            {/* ═══ Urgent tasks feed ═══ */}
            {isSurgeActive && urgentTasks.length > 0 && (
              <div
                style={{
                  border: `1px solid ${COLORS.accent}55`,
                  borderRadius: RADIUS.sm,
                  background: `${COLORS.accent}0a`,
                  overflow: 'hidden',
                }}
              >
                <CategoryHeader
                  id="TASKS"
                  label="Urgent Ops"
                  meta={
                    <Mono tone="accent" size="xs">
                      {ackedCount}/{urgentTasks.length}
                    </Mono>
                  }
                />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: SPACE.sm,
                    gap: SPACE.xs,
                  }}
                >
                  {urgentTasks.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        padding: `${SPACE.xs}px ${SPACE.sm}px`,
                        background: t.acknowledged
                          ? `${COLORS.ok}0f`
                          : COLORS.surface,
                        border: `1px solid ${
                          t.acknowledged ? `${COLORS.ok}4d` : COLORS.border
                        }`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 6,
                        }}
                      >
                        {t.acknowledged ? (
                          <CheckCircle2
                            size={12}
                            strokeWidth={2}
                            color={COLORS.ok}
                            style={{ marginTop: 2, flexShrink: 0 }}
                          />
                        ) : (
                          <Clock
                            size={12}
                            strokeWidth={2}
                            color={COLORS.warn}
                            style={{ marginTop: 2, flexShrink: 0 }}
                          />
                        )}
                        <span
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 11,
                            color: t.acknowledged
                              ? COLORS.textMuted
                              : COLORS.textPrimary,
                            textDecoration: t.acknowledged
                              ? 'line-through'
                              : undefined,
                            lineHeight: 1.4,
                            letterSpacing: '-0.003em',
                          }}
                        >
                          {t.title}
                        </span>
                      </div>
                      {t.acknowledged && t.acknowledgedBy && (
                        <div style={{ paddingLeft: 18 }}>
                          <Mono tone="ok" size="xs">
                            ACK · {t.acknowledgedBy.slice(0, 8)}
                            {t.acknowledgedAt && (
                              <span style={{ color: `${COLORS.ok}80` }}>
                                {' '}
                                @{' '}
                                {new Date(t.acknowledgedAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                })}
                              </span>
                            )}
                          </Mono>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ Quick comms ═══ */}
            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                background: COLORS.surface,
                overflow: 'hidden',
              }}
            >
              <CategoryHeader
                id="COMMS"
                label="Quick Paging"
                meta={
                  <Mono tone="dim" size="xs">
                    2 targets
                  </Mono>
                }
              />
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <CommandRow
                  icon={<PhoneCall size={11} strokeWidth={2} />}
                  iconColor={COLORS.info}
                  label="Page Charge Nurse"
                  code="CMD.PAGE.NURSE"
                  hint="G+N"
                  onClick={() => handleCall('nurse')}
                />
                <Divider color={COLORS.border} />
                <CommandRow
                  icon={<PhoneCall size={11} strokeWidth={2} />}
                  iconColor={COLORS.ok}
                  label="Call Blood Bank"
                  code="CMD.PAGE.BLOOD"
                  hint="G+B"
                  onClick={() => handleCall('blood_bank')}
                />
              </div>
            </div>

            {/* ═══ Live feed ═══ */}
            <div
              style={{
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                background: COLORS.surface,
                overflow: 'hidden',
              }}
            >
              <CategoryHeader
                id="FEED"
                label="Live Telemetry"
                meta={<StatusPill label="Live" tone="ok" pulse size="xs" />}
              />
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACE.xs,
                  padding: SPACE.sm,
                }}
              >
                <FeedEntry
                  sourceId="ER-01"
                  source="ER Charge"
                  sourceTone="info"
                  text="Holding 4 admissions. Need beds."
                  time="T-2m"
                />
                <FeedEntry
                  sourceId="LAB-02"
                  source="Lab"
                  sourceTone="warn"
                  text="Analyzer 2 back online."
                  time="T-15m"
                />
                {isSurgeActive && (
                  <FeedEntry
                    sourceId="SYS-00"
                    source="System"
                    sourceTone="crit"
                    text="Surge Protocol Activated. All non-essential actions suspended."
                    time="T-0s"
                    critical
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ═══ Inline call UI ═══ */}
        <AnimatePresence>
          {activeCall && (
            <motion.div
              key="call"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: MOTION.base, ease: MOTION.ease }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                borderTop: `1px solid ${COLORS.border}`,
                background: COLORS.bgDeep,
              }}
            >
              {/* Call header */}
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
                    background:
                      callState === 'ai_speaking'
                        ? `${COLORS.warn}14`
                        : callState === 'calling'
                        ? `${COLORS.info}14`
                        : `${COLORS.ok}14`,
                    border: `1px solid ${
                      callState === 'ai_speaking'
                        ? COLORS.warn
                        : callState === 'calling'
                        ? COLORS.info
                        : COLORS.ok
                    }`,
                    borderRadius: RADIUS.sm,
                    flexShrink: 0,
                  }}
                >
                  {callState === 'ai_speaking' ? (
                    <Bot size={16} color={COLORS.warn} strokeWidth={2} />
                  ) : (
                    <PhoneCall
                      size={16}
                      color={callState === 'calling' ? COLORS.info : COLORS.ok}
                      strokeWidth={2}
                    />
                  )}
                  <CornerBracket
                    position="tl"
                    color={
                      callState === 'ai_speaking'
                        ? COLORS.warn
                        : callState === 'calling'
                        ? COLORS.info
                        : COLORS.ok
                    }
                    size={4}
                    thickness={1}
                  />
                  <CornerBracket
                    position="br"
                    color={
                      callState === 'ai_speaking'
                        ? COLORS.warn
                        : callState === 'calling'
                        ? COLORS.info
                        : COLORS.ok
                    }
                    size={4}
                    thickness={1}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Mono tone="dim" size="xs">
                    // LINK.{activeCall === 'nurse' ? 'NURSE' : 'BLOOD_BANK'}
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
                    {activeCall === 'nurse' ? 'Charge Nurse · ER' : 'Blood Bank'}
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
                          fontSize: 11,
                          color: COLORS.textPrimary,
                          lineHeight: 1.45,
                          letterSpacing: '-0.003em',
                        }}
                      >
                        AI is taking over. "I have logged the requested actions.
                        You may disconnect. Thank you."
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
                            fontSize: 11,
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
                          <User size={9} strokeWidth={2} color={COLORS.textMuted} />
                          <Mono tone="muted" size="xs">
                            @{task.assignee}
                          </Mono>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Call controls */}
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
                    onClick={() => setCallState('ai_speaking')}
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
};
