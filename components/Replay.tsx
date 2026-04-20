import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Activity,
  Zap,
  Target,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  User,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION, cssTransition,
  Mono,
  BracketLabel,
  StatusPill,
  SectionTitle,
  TacticalCard,
  TacticalButton,
  CornerBracket,
  ConfidenceBadge,
} from './design';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

type EventType = 'METRIC' | 'DECISION' | 'ACTION' | 'OUTCOME';

interface Snapshot {
  label: string;
  before: string;
  after: string;
}

interface ReplayEvent {
  id: string;
  /** Minutes ago from "now" — 360 = 6 hours ago, 0 = now. */
  minutesAgo: number;
  type: EventType;
  title: string;
  description: string;
  actor?: string;
  actorRole?: string;
  snapshot?: Snapshot;
  /** ED capacity % at this point in time. */
  capacityPct: number;
}

interface ReplayProps {
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────

const TIMELINE_HOURS = 6;
const TIMELINE_MINUTES = TIMELINE_HOURS * 60;

const EVENT_TYPE_META: Record<EventType, { color: string; label: string; Icon: React.FC<any> }> = {
  METRIC:   { color: COLORS.info,   label: 'METRIC',   Icon: Activity },
  DECISION: { color: COLORS.accent, label: 'DECISION', Icon: Target },
  ACTION:   { color: COLORS.warn,   label: 'ACTION',   Icon: Zap },
  OUTCOME:  { color: COLORS.ok,     label: 'OUTCOME',  Icon: CheckCircle2 },
};

// ─────────────────────────────────────────────────────────────────────────
// Mock data — realistic 6-hour hospital operations timeline
// ─────────────────────────────────────────────────────────────────────────

const MOCK_EVENTS: ReplayEvent[] = [
  {
    id: 'e01',
    minutesAgo: 360,
    type: 'METRIC',
    title: 'Normal operations begin',
    description: 'ED census at 72% capacity. Staffing nominal across all zones. Overnight shift handoff completed without escalation.',
    actor: 'PULSE System',
    actorRole: 'Automated',
    capacityPct: 72,
  },
  {
    id: 'e02',
    minutesAgo: 300,
    type: 'ACTION',
    title: 'EMS-003 STEMI inbound',
    description: 'Medic 7 reporting 68M chest pain onset 45 min ago, 12-lead confirms ST elevation V2-V4. Field: ASA 324 mg, NTG x 2, heparin bolus.',
    actor: 'EMS Dispatch',
    actorRole: 'Medic 7',
    snapshot: { label: 'Activation', before: 'No active alerts', after: 'STEMI ALERT activated' },
    capacityPct: 74,
  },
  {
    id: 'e03',
    minutesAgo: 295,
    type: 'DECISION',
    title: 'Cath lab activated for STEMI',
    description: 'Door-to-balloon timer started. Interventional cardiology notified. Bed assigned: Cath Lab 2. Target D2B < 90 min.',
    actor: 'Dr. James Rivera',
    actorRole: 'ED Attending',
    snapshot: { label: 'Bed assignment', before: 'Cath Lab 2: Available', after: 'Cath Lab 2: Reserved EMS-003' },
    capacityPct: 75,
  },
  {
    id: 'e04',
    minutesAgo: 240,
    type: 'METRIC',
    title: 'Census rising across zones',
    description: 'ED acute at 78%, step-down at 82%. Staffing gap detected on step-down unit: 1 RN short for next shift. Charge nurse notified.',
    actor: 'PULSE System',
    actorRole: 'Automated',
    snapshot: { label: 'Staffing', before: 'Step-down: 6/6 RN', after: 'Step-down: 5/6 RN (gap)' },
    capacityPct: 78,
  },
  {
    id: 'e05',
    minutesAgo: 180,
    type: 'METRIC',
    title: 'ED saturation crosses 85%',
    description: 'First warning threshold breached. 3 patients boarding in hallway beds. EMS offload time trending up to 22 min average.',
    actor: 'PULSE System',
    actorRole: 'Automated',
    snapshot: { label: 'Capacity', before: 'ED: 78% (normal)', after: 'ED: 85% (warning)' },
    capacityPct: 85,
  },
  {
    id: 'e06',
    minutesAgo: 120,
    type: 'DECISION',
    title: 'Surge protocol proposed',
    description: 'PULSE flags high-confidence risk of saturation >95% within 2 hours. Recommends Surge Playbook Level 2. Awaiting Ops Director review.',
    actor: 'PULSE System',
    actorRole: 'AI Recommendation',
    snapshot: { label: 'Forecast', before: 'Predicted peak: 88%', after: 'Predicted peak: 97% without intervention' },
    capacityPct: 89,
  },
  {
    id: 'e07',
    minutesAgo: 90,
    type: 'DECISION',
    title: 'Surge confirmed by Ops Director',
    description: 'Sarah Chen reviews PULSE recommendation and confirms Surge Playbook Level 2 activation. 5 tasks auto-distributed to zone leads.',
    actor: 'Sarah Chen',
    actorRole: 'Operations Director',
    snapshot: { label: 'Surge status', before: 'Normal operations', after: 'SURGE LEVEL 2 ACTIVE' },
    capacityPct: 91,
  },
  {
    id: 'e08',
    minutesAgo: 60,
    type: 'ACTION',
    title: '3/5 surge tasks acknowledged',
    description: 'Overflow beds online in Zone C. Float RN assigned to step-down. Discharge coordinator expediting 2 pending discharges. 2 tasks pending: radiology hold, dietary staffing.',
    actor: 'Multiple',
    actorRole: 'Zone Leads',
    snapshot: { label: 'Task progress', before: '0/5 complete', after: '3/5 acknowledged' },
    capacityPct: 88,
  },
  {
    id: 'e09',
    minutesAgo: 30,
    type: 'OUTCOME',
    title: 'Saturation drops to 68%',
    description: 'Surge measures taking effect. 2 discharges completed, overflow absorbed 4 boarders. EMS offload time back to 8 min. Risk resolved.',
    actor: 'PULSE System',
    actorRole: 'Automated',
    snapshot: { label: 'Capacity', before: 'ED: 91% (critical)', after: 'ED: 68% (normal)' },
    capacityPct: 68,
  },
  {
    id: 'e10',
    minutesAgo: 15,
    type: 'OUTCOME',
    title: 'All surge tasks completed',
    description: 'All 5 tasks marked complete. After-action review flagged for shift debrief. STEMI patient EMS-003 successfully reperfused, D2B 67 min.',
    actor: 'Sarah Chen',
    actorRole: 'Operations Director',
    snapshot: { label: 'Task progress', before: '3/5 complete', after: '5/5 complete' },
    capacityPct: 65,
  },
  {
    id: 'e11',
    minutesAgo: 0,
    type: 'METRIC',
    title: 'Normal operations resumed',
    description: 'All zones green. Census stable at 62%. Surge playbook deactivated. System confidence 94%. Next shift handoff in 2h 15m.',
    actor: 'PULSE System',
    actorRole: 'Automated',
    capacityPct: 62,
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Convert minutesAgo to a formatted clock time string. */
function minutesAgoToTime(minutesAgo: number): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - minutesAgo);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/** Convert minutesAgo to a human-readable relative label. */
function minutesAgoToLabel(minutesAgo: number): string {
  if (minutesAgo === 0) return 'NOW';
  if (minutesAgo < 60) return `T-${minutesAgo}m`;
  const h = Math.floor(minutesAgo / 60);
  const m = minutesAgo % 60;
  if (m === 0) return `T-${h}h`;
  return `T-${h}h${m}m`;
}

/** Interpolate capacity at a given scrub position using the event data. */
function interpolateCapacity(minutesAgo: number, events: ReplayEvent[]): number {
  // Sort events by minutesAgo descending (most distant first)
  const sorted = [...events].sort((a, b) => b.minutesAgo - a.minutesAgo);

  // If before all events, return the first event's capacity
  if (minutesAgo >= sorted[0].minutesAgo) return sorted[0].capacityPct;
  // If after all events, return the last event's capacity
  if (minutesAgo <= sorted[sorted.length - 1].minutesAgo) return sorted[sorted.length - 1].capacityPct;

  // Find the two bracketing events and interpolate
  for (let i = 0; i < sorted.length - 1; i++) {
    const high = sorted[i];
    const low = sorted[i + 1];
    if (minutesAgo <= high.minutesAgo && minutesAgo >= low.minutesAgo) {
      const range = high.minutesAgo - low.minutesAgo;
      if (range === 0) return high.capacityPct;
      const t = (high.minutesAgo - minutesAgo) / range;
      return Math.round(high.capacityPct + t * (low.capacityPct - high.capacityPct));
    }
  }

  return 72; // fallback
}

/** Get capacity tone based on percentage. */
function capacityTone(pct: number): 'ok' | 'warn' | 'crit' {
  if (pct >= 85) return 'crit';
  if (pct >= 75) return 'warn';
  return 'ok';
}

function capacityColor(pct: number): string {
  if (pct >= 85) return COLORS.crit;
  if (pct >= 75) return COLORS.warn;
  return COLORS.ok;
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const Replay: React.FC<ReplayProps> = ({ showToast }) => {
  // Scrub position: 0 = 6h ago, TIMELINE_MINUTES = now
  const [scrubMinutes, setScrubMinutes] = useState(TIMELINE_MINUTES);
  const [isPlaying, setIsPlaying] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const feedRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  // The minutesAgo value that the scrub head represents
  const scrubMinutesAgo = TIMELINE_MINUTES - scrubMinutes;

  // Filter events: only those that have "happened" by the scrub point
  const visibleEvents = useMemo(
    () => MOCK_EVENTS.filter((e) => e.minutesAgo >= scrubMinutesAgo),
    [scrubMinutesAgo],
  );

  const futureEvents = useMemo(
    () => MOCK_EVENTS.filter((e) => e.minutesAgo < scrubMinutesAgo),
    [scrubMinutesAgo],
  );

  const currentCapacity = useMemo(
    () => interpolateCapacity(scrubMinutesAgo, MOCK_EVENTS),
    [scrubMinutesAgo],
  );

  const isLive = scrubMinutes === TIMELINE_MINUTES;

  // Autoplay
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setScrubMinutes((prev) => {
        const next = prev + 2;
        if (next >= TIMELINE_MINUTES) {
          setIsPlaying(false);
          return TIMELINE_MINUTES;
        }
        return next;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [isPlaying]);

  // ── Timeline pointer/touch handlers ──

  const handleTimelineInteraction = useCallback(
    (clientX: number) => {
      const el = timelineRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setScrubMinutes(Math.round(pct * TIMELINE_MINUTES));
    },
    [],
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      isDragging.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      handleTimelineInteraction(e.clientX);
      setIsPlaying(false);
    },
    [handleTimelineInteraction],
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      handleTimelineInteraction(e.clientX);
    },
    [handleTimelineInteraction],
  );

  const handlePointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ── Event position helpers ──

  const eventToPercent = useCallback(
    (minutesAgo: number) => ((TIMELINE_MINUTES - minutesAgo) / TIMELINE_MINUTES) * 100,
    [],
  );

  const scrubPercent = (scrubMinutes / TIMELINE_MINUTES) * 100;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.bg,
        overflow: 'hidden',
      }}
    >
      {/* ── Header ── */}
      <div
        style={{
          padding: `${SPACE.lg}px ${SPACE['2xl']}px ${SPACE.md}px`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: SPACE.lg,
          flexShrink: 0,
        }}
      >
        <div>
          <SectionTitle
            id="REPLAY.TIMELINE"
            label="Replay"
            divider={false}
            style={{ marginBottom: 4 }}
          />
          <Mono tone="muted" size="xs">
            // DVR for hospital operations &mdash; scrub to review decisions, actions, and outcomes
          </Mono>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flexShrink: 0 }}>
          <ConfidenceBadge confidence={94} ageMinutes={0} />
          <StatusPill
            label={isLive ? 'LIVE' : minutesAgoToLabel(scrubMinutesAgo)}
            tone={isLive ? 'ok' : 'warn'}
            pulse={isLive}
          />
        </div>
      </div>

      {/* ── Timeline strip ── */}
      <TacticalCard
        padding="none"
        style={{
          margin: `0 ${SPACE['2xl']}px`,
          flexShrink: 0,
          overflow: 'visible',
        }}
      >
        {/* Capacity readout bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: `${SPACE.sm}px ${SPACE.lg}px`,
            borderBottom: `1px solid ${COLORS.border}`,
            background: COLORS.surfaceElev,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
            <Activity size={13} strokeWidth={2} color={COLORS.textMuted} />
            <Mono tone="muted" size="xs">
              ED Capacity at Scrub Point
            </Mono>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 20,
                fontWeight: 600,
                letterSpacing: '-0.02em',
                color: capacityColor(currentCapacity),
              }}
            >
              {currentCapacity}%
            </span>
            {currentCapacity >= 85 ? (
              <TrendingUp size={14} color={COLORS.crit} />
            ) : currentCapacity >= 75 ? (
              <TrendingUp size={14} color={COLORS.warn} />
            ) : (
              <TrendingDown size={14} color={COLORS.ok} />
            )}
            <Mono tone="muted" size="xs">
              {minutesAgoToTime(scrubMinutesAgo)}
            </Mono>
          </div>
        </div>

        {/* Timeline rail + controls */}
        <div style={{ padding: `${SPACE.md}px ${SPACE.lg}px ${SPACE.sm}px` }}>
          {/* Transport controls */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: SPACE.sm,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
              {/* Play / Pause */}
              <button
                type="button"
                onClick={() => {
                  if (isLive) {
                    setScrubMinutes(0);
                    setIsPlaying(true);
                  } else {
                    setIsPlaying(!isPlaying);
                  }
                }}
                style={{
                  width: 36,
                  height: 36,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isPlaying ? COLORS.accent : COLORS.surfaceElev,
                  border: `1px solid ${isPlaying ? COLORS.accent : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: isPlaying ? COLORS.textPrimary : COLORS.textSecondary,
                  cursor: 'pointer',
                  transition: cssTransition(),
                  boxShadow: isPlaying ? `0 0 16px ${COLORS.accent}60` : 'none',
                }}
              >
                {isPlaying ? <Pause size={14} strokeWidth={2} /> : <Play size={14} strokeWidth={2} style={{ marginLeft: 1 }} />}
              </button>

              {/* Skip controls */}
              <IconBtn onClick={() => setScrubMinutes(Math.max(0, scrubMinutes - 30))} label="Back 30m">
                <SkipBack size={13} strokeWidth={2} />
              </IconBtn>
              <IconBtn onClick={() => setScrubMinutes(Math.min(TIMELINE_MINUTES, scrubMinutes + 30))} label="Forward 30m">
                <SkipForward size={13} strokeWidth={2} />
              </IconBtn>

              {/* Reset to live */}
              {!isLive && (
                <TacticalButton
                  variant="ghost"
                  size="sm"
                  icon={<RotateCcw size={12} strokeWidth={2} />}
                  onClick={() => {
                    setScrubMinutes(TIMELINE_MINUTES);
                    setIsPlaying(false);
                  }}
                >
                  Live
                </TacticalButton>
              )}
            </div>

            {/* Time display */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.sm }}>
              <span
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 18,
                  fontWeight: 600,
                  color: COLORS.textPrimary,
                  letterSpacing: '0.02em',
                }}
              >
                {minutesAgoToTime(scrubMinutesAgo)}
              </span>
              <Mono tone={isLive ? 'ok' : 'warn'} size="xs">
                {isLive ? 'LIVE' : minutesAgoToLabel(scrubMinutesAgo)}
              </Mono>
            </div>
          </div>

          {/* ── The scrubbable timeline rail ── */}
          <div
            ref={timelineRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              position: 'relative',
              height: 56,
              cursor: 'pointer',
              touchAction: 'none',
              userSelect: 'none',
            }}
          >
            {/* Background rail */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                height: 2,
                background: COLORS.border,
                borderRadius: 1,
              }}
            />

            {/* Filled (past) segment */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: '50%',
                transform: 'translateY(-50%)',
                height: 2,
                width: `${scrubPercent}%`,
                background: `linear-gradient(90deg, ${COLORS.info}40, ${COLORS.info})`,
                borderRadius: 1,
                transition: isDragging.current ? 'none' : 'width 80ms linear',
              }}
            />

            {/* Capacity area fill — mini sparkline behind the rail */}
            <svg
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
              }}
              viewBox={`0 0 ${TIMELINE_MINUTES} 100`}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="replay-cap-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COLORS.info} stopOpacity={0.12} />
                  <stop offset="100%" stopColor={COLORS.info} stopOpacity={0} />
                </linearGradient>
              </defs>
              <path
                d={buildCapacityPath(MOCK_EVENTS)}
                fill="url(#replay-cap-fill)"
                stroke={COLORS.info}
                strokeWidth={0.8}
                strokeOpacity={0.3}
                vectorEffect="non-scaling-stroke"
              />
            </svg>

            {/* Hour markers */}
            {Array.from({ length: TIMELINE_HOURS + 1 }, (_, i) => {
              const pct = (i / TIMELINE_HOURS) * 100;
              const minutesAgo = TIMELINE_MINUTES - i * 60;
              return (
                <div key={i} style={{ position: 'absolute', left: `${pct}%`, top: 0, bottom: 0, pointerEvents: 'none' }}>
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: 1,
                      height: 10,
                      background: COLORS.borderStrong,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      bottom: 0,
                      transform: 'translateX(-50%)',
                      fontFamily: FONTS.mono,
                      fontSize: 8,
                      fontWeight: 500,
                      letterSpacing: '0.1em',
                      color: COLORS.textMuted,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {minutesAgo === 0 ? 'NOW' : `${minutesAgo / 60}H`}
                  </div>
                </div>
              );
            })}

            {/* Event dots */}
            {MOCK_EVENTS.map((evt) => {
              const pct = eventToPercent(evt.minutesAgo);
              const meta = EVENT_TYPE_META[evt.type];
              const isPast = evt.minutesAgo >= scrubMinutesAgo;
              return (
                <div
                  key={evt.id}
                  style={{
                    position: 'absolute',
                    left: `${pct}%`,
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 10,
                    height: 10,
                    borderRadius: RADIUS.full,
                    background: isPast ? meta.color : COLORS.borderStrong,
                    border: `2px solid ${COLORS.bg}`,
                    boxShadow: isPast ? `0 0 6px ${meta.color}80` : 'none',
                    transition: `background ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease`,
                    zIndex: 5,
                    pointerEvents: 'none',
                  }}
                />
              );
            })}

            {/* Scrub playhead */}
            <div
              style={{
                position: 'absolute',
                left: `${scrubPercent}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 3,
                height: 32,
                background: COLORS.textPrimary,
                borderRadius: 2,
                boxShadow: `0 0 8px ${COLORS.textPrimary}40`,
                zIndex: 10,
                pointerEvents: 'none',
                transition: isDragging.current ? 'none' : 'left 80ms linear',
              }}
            />

            {/* Corner brackets on the rail */}
            <CornerBracket position="tl" color={COLORS.borderStrong} size={6} thickness={1} inset={0} />
            <CornerBracket position="tr" color={COLORS.borderStrong} size={6} thickness={1} inset={0} />
            <CornerBracket position="bl" color={COLORS.borderStrong} size={6} thickness={1} inset={0} />
            <CornerBracket position="br" color={COLORS.borderStrong} size={6} thickness={1} inset={0} />
          </div>

          {/* Legend */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.lg,
              marginTop: SPACE.xs,
              paddingTop: SPACE.xs,
            }}
          >
            {Object.entries(EVENT_TYPE_META).map(([type, meta]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: RADIUS.full,
                    background: meta.color,
                    boxShadow: `0 0 4px ${meta.color}60`,
                  }}
                />
                <Mono tone="muted" size="xs">{meta.label}</Mono>
              </div>
            ))}
          </div>
        </div>
      </TacticalCard>

      {/* ── Event feed ── */}
      <div
        ref={feedRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: `${SPACE.md}px ${SPACE['2xl']}px ${SPACE['2xl']}px`,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.sm,
        }}
      >
        {/* Active events heading */}
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm }}>
          <Mono tone="secondary" size="xs">
            Events at {minutesAgoToTime(scrubMinutesAgo)}
          </Mono>
          <div style={{ flex: 1, height: 1, background: COLORS.border }} />
          <Mono tone="muted" size="xs">
            {visibleEvents.length} of {MOCK_EVENTS.length}
          </Mono>
        </div>

        {/* Visible (past) events */}
        <AnimatePresence initial={false}>
          {visibleEvents
            .sort((a, b) => a.minutesAgo - b.minutesAgo) // most recent first
            .map((evt) => (
              <motion.div
                key={evt.id}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8, transition: { duration: MOTION.fast } }}
                transition={{ duration: MOTION.base, ease: MOTION.ease }}
              >
                <EventCard
                  event={evt}
                  isExpanded={expandedEvent === evt.id}
                  onToggle={() => setExpandedEvent(expandedEvent === evt.id ? null : evt.id)}
                  isFuture={false}
                />
              </motion.div>
            ))}
        </AnimatePresence>

        {/* Future (greyed out) events */}
        {futureEvents.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm }}>
              <Mono tone="dim" size="xs">
                Not yet occurred
              </Mono>
              <div style={{ flex: 1, height: 1, background: COLORS.border, opacity: 0.4 }} />
            </div>
            {futureEvents
              .sort((a, b) => a.minutesAgo - b.minutesAgo)
              .map((evt) => (
                <motion.div
                  key={evt.id}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 0.3 }}
                  transition={{ duration: MOTION.fast }}
                >
                  <EventCard
                    event={evt}
                    isExpanded={false}
                    onToggle={() => {}}
                    isFuture={true}
                  />
                </motion.div>
              ))}
          </>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// EventCard — a single event in the vertical feed
// ─────────────────────────────────────────────────────────────────────────

const EventCard: React.FC<{
  event: ReplayEvent;
  isExpanded: boolean;
  onToggle: () => void;
  isFuture: boolean;
}> = ({ event, isExpanded, onToggle, isFuture }) => {
  const meta = EVENT_TYPE_META[event.type];
  const { Icon } = meta;

  return (
    <TacticalCard
      interactive={!isFuture}
      padding="none"
      style={{
        cursor: isFuture ? 'default' : 'pointer',
        opacity: isFuture ? 0.35 : 1,
      }}
      onClick={isFuture ? undefined : onToggle}
    >
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Type accent bar */}
        <div
          style={{
            width: 3,
            flexShrink: 0,
            background: meta.color,
            borderRadius: `${RADIUS.sm}px 0 0 ${RADIUS.sm}px`,
            opacity: isFuture ? 0.3 : 1,
          }}
        />

        {/* Content */}
        <div style={{ flex: 1, padding: `${SPACE.md}px ${SPACE.base}px` }}>
          {/* Top row: timestamp + type badge + capacity */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: SPACE.sm,
              marginBottom: SPACE.xs,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
              <Clock size={11} strokeWidth={2} color={COLORS.textMuted} />
              <Mono tone="muted" size="xs">
                {minutesAgoToTime(event.minutesAgo)}
              </Mono>
              <BracketLabel tone={meta.color === COLORS.accent ? 'accent' : meta.color === COLORS.ok ? 'ok' : meta.color === COLORS.warn ? 'warn' : 'info'} size="xs">
                {meta.label}
              </BracketLabel>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
              <Mono
                tone={capacityTone(event.capacityPct) as any}
                size="xs"
              >
                {event.capacityPct}% CAP
              </Mono>
              {!isFuture && (
                <motion.div
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: MOTION.fast }}
                >
                  <ChevronDown size={12} color={COLORS.textMuted} />
                </motion.div>
              )}
            </div>
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.sm,
              marginBottom: SPACE.xs,
            }}
          >
            <Icon size={14} strokeWidth={2} color={meta.color} />
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: TYPE.body.size,
                fontWeight: 600,
                letterSpacing: TYPE.body.tracking,
                color: COLORS.textPrimary,
                lineHeight: 1.3,
              }}
            >
              {event.title}
            </span>
          </div>

          {/* Description — always visible as single line, expanded shows full */}
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: TYPE.bodySm.size,
              fontWeight: TYPE.bodySm.weight,
              letterSpacing: TYPE.bodySm.tracking,
              lineHeight: TYPE.bodySm.lineHeight,
              color: COLORS.textSecondary,
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: isExpanded ? 999 : 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {event.description}
          </div>

          {/* Expanded details */}
          <AnimatePresence initial={false}>
            {isExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: MOTION.base, ease: MOTION.ease }}
                style={{ overflow: 'hidden' }}
              >
                <div style={{ paddingTop: SPACE.md }}>
                  {/* Actor */}
                  {event.actor && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                      <User size={11} strokeWidth={2} color={COLORS.textMuted} />
                      <Mono tone="secondary" size="xs">
                        {event.actor}
                      </Mono>
                      {event.actorRole && (
                        <Mono tone="muted" size="xs">
                          / {event.actorRole}
                        </Mono>
                      )}
                    </div>
                  )}

                  {/* Before/after snapshot */}
                  {event.snapshot && (
                    <div
                      style={{
                        background: COLORS.bgDeep,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        padding: SPACE.md,
                        marginTop: SPACE.xs,
                      }}
                    >
                      <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.sm, display: 'block' }}>
                        {event.snapshot.label}
                      </Mono>
                      <div style={{ display: 'flex', gap: SPACE.md }}>
                        {/* Before */}
                        <div style={{ flex: 1 }}>
                          <Mono tone="dim" size="xs" style={{ marginBottom: 4, display: 'block' }}>
                            Before
                          </Mono>
                          <div
                            style={{
                              fontFamily: FONTS.mono,
                              fontSize: 11,
                              color: COLORS.textSecondary,
                              lineHeight: 1.5,
                              padding: `${SPACE.xs}px ${SPACE.sm}px`,
                              background: `${COLORS.crit}08`,
                              borderLeft: `2px solid ${COLORS.crit}40`,
                              borderRadius: RADIUS.sm,
                            }}
                          >
                            {event.snapshot.before}
                          </div>
                        </div>
                        {/* After */}
                        <div style={{ flex: 1 }}>
                          <Mono tone="dim" size="xs" style={{ marginBottom: 4, display: 'block' }}>
                            After
                          </Mono>
                          <div
                            style={{
                              fontFamily: FONTS.mono,
                              fontSize: 11,
                              color: COLORS.textSecondary,
                              lineHeight: 1.5,
                              padding: `${SPACE.xs}px ${SPACE.sm}px`,
                              background: `${COLORS.ok}08`,
                              borderLeft: `2px solid ${COLORS.ok}40`,
                              borderRadius: RADIUS.sm,
                            }}
                          >
                            {event.snapshot.after}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Relative time tag */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginTop: SPACE.sm }}>
                    <AlertTriangle size={10} strokeWidth={2} color={COLORS.textDim} />
                    <Mono tone="dim" size="xs">
                      {minutesAgoToLabel(event.minutesAgo)} &middot; ED {event.capacityPct}%
                    </Mono>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </TacticalCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Capacity sparkline path builder
// ─────────────────────────────────────────────────────────────────────────

function buildCapacityPath(events: ReplayEvent[]): string {
  const sorted = [...events].sort((a, b) => b.minutesAgo - a.minutesAgo);
  // Map minutesAgo to x (0 = left = 6h ago, TIMELINE_MINUTES = right = now)
  // Map capacity to y (inverted: 100% at top = y:0, 0% at bottom = y:100)
  const points = sorted.map((e) => ({
    x: TIMELINE_MINUTES - e.minutesAgo,
    y: 100 - e.capacityPct,
  }));

  if (points.length === 0) return '';

  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    // Smooth curve using quadratic bezier
    const prev = points[i - 1];
    const curr = points[i];
    const cx = (prev.x + curr.x) / 2;
    d += ` Q ${cx} ${prev.y} ${curr.x} ${curr.y}`;
  }
  // Close the area
  d += ` L ${points[points.length - 1].x} 100 L ${points[0].x} 100 Z`;
  return d;
}

// ─────────────────────────────────────────────────────────────────────────
// Tiny icon button — reused for skip controls
// ─────────────────────────────────────────────────────────────────────────

const IconBtn: React.FC<{
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}> = ({ onClick, label, children }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hovered ? COLORS.surface : 'transparent',
        border: `1px solid ${hovered ? COLORS.border : 'transparent'}`,
        borderRadius: RADIUS.sm,
        color: hovered ? COLORS.textPrimary : COLORS.textSecondary,
        cursor: 'pointer',
        transition: cssTransition(),
      }}
    >
      {children}
    </button>
  );
};
