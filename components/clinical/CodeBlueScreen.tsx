/**
 * CodeBlueScreen — fullscreen overlay for Code Blue / Rapid Response
 *
 * The most dramatic screen in the app. Activates during a cardiac arrest,
 * presenting the real-time code management interface: running timer,
 * ACLS protocol tracker, medication log, event log, shock counter,
 * team roles, and resolution controls.
 *
 * Designed to feel urgent, precise, and military-grade — red-shifted
 * background, glow effects, flashing indicators, and heavy CTAs.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Zap,
  Heart,
  Clock,
  Syringe,
  Users,
  Plus,
  AlertTriangle,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION, cssTransition,
  Z,
  MOBILE_NAV_OVERLAY_INSET_BOTTOM,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
  TacticalButton,
  HudStrip,
  ScanningLine,
  Divider,
} from '../design';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface CodeBlueScreenProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  patientId?: string;
  location?: string;
}

type Rhythm = 'VFib' | 'VTach' | 'PEA' | 'Asystole';

interface MedEntry {
  id: string;
  name: string;
  dose: string;
  time: Date;
}

interface EventEntry {
  id: string;
  label: string;
  time: Date;
  type: 'system' | 'med' | 'shock' | 'rhythm' | 'manual' | 'resolution';
}

type TeamRole = 'Team Leader' | 'Airway' | 'Compressor' | 'Meds/Access' | 'Timer/Recorder';

type Resolution = 'rosc' | 'death' | null;

const RHYTHMS: Rhythm[] = ['VFib', 'VTach', 'PEA', 'Asystole'];

const QUICK_MEDS = [
  { name: 'Epinephrine', dose: '1mg' },
  { name: 'Amiodarone', dose: '300mg' },
  { name: 'Amiodarone', dose: '150mg' },
  { name: 'Atropine', dose: '1mg' },
  { name: 'Bicarb', dose: '50mEq' },
];

const TEAM_ROLES: TeamRole[] = ['Team Leader', 'Airway', 'Compressor', 'Meds/Access', 'Timer/Recorder'];

const MOCK_NAMES: Record<TeamRole, string | null> = {
  'Team Leader': 'Dr. Chen',
  Airway: 'RT Williams',
  Compressor: null,
  'Meds/Access': 'RN Torres',
  'Timer/Recorder': null,
};

const CODE_BG = '#0A0505';
const SHOCK_ENERGY = '200J';
const CYCLE_DURATION_S = 120; // 2-minute CPR cycles

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const fmtTime = (d: Date): string =>
  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

const fmtTimerShort = (d: Date): string =>
  d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

const fmtElapsed = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

let _eventId = 0;
const nextId = (): string => `evt-${++_eventId}`;

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const CodeBlueScreen: React.FC<CodeBlueScreenProps> = ({
  open,
  onClose,
  showToast,
  patientId = 'P001',
  location = 'ICU-3',
}) => {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [codeCalledAt] = useState(() => new Date());
  const [running, setRunning] = useState(true);
  const [rhythm, setRhythm] = useState<Rhythm>('VFib');
  const [cycle, setCycle] = useState(1);
  const [showPulseCheck, setShowPulseCheck] = useState(false);
  const [meds, setMeds] = useState<MedEntry[]>([]);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [shockCount, setShockCount] = useState(0);
  const [teamAssignments, setTeamAssignments] = useState<Record<TeamRole, string | null>>({ ...MOCK_NAMES });
  const [resolution, setResolution] = useState<Resolution>(null);
  const [confirmDeath, setConfirmDeath] = useState(false);
  const [nextAction, setNextAction] = useState('Begin compressions');

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastCycleRef = useRef(0);
  const lastEpiRef = useRef(-999);

  // ── Auto-log code called on mount ────────────────────────────────────
  useEffect(() => {
    if (open && events.length === 0) {
      setEvents([{ id: nextId(), label: 'Code Blue called', time: new Date(), type: 'system' }]);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Running timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open || !running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setElapsedSeconds((s) => s + 1);
    }, 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [open, running]);

  // ── Cycle and pulse-check logic ──────────────────────────────────────
  useEffect(() => {
    if (!running) return;
    const currentCycle = Math.floor(elapsedSeconds / CYCLE_DURATION_S) + 1;
    if (currentCycle !== cycle) {
      setCycle(currentCycle);
      setShowPulseCheck(true);
      logEvent(`Cycle ${currentCycle} — PULSE CHECK due`, 'system');
    }
    // Show pulse check at every 2-min boundary
    if (elapsedSeconds > 0 && elapsedSeconds % CYCLE_DURATION_S === 0 && elapsedSeconds !== lastCycleRef.current) {
      lastCycleRef.current = elapsedSeconds;
      setShowPulseCheck(true);
    }
    // Next action hints
    const sinceLastEpi = elapsedSeconds - lastEpiRef.current;
    const secondsInCycle = elapsedSeconds % CYCLE_DURATION_S;
    const timeToCheck = CYCLE_DURATION_S - secondsInCycle;

    if (sinceLastEpi >= 180 && sinceLastEpi < 240) {
      setNextAction('Epi due now');
    } else if (sinceLastEpi >= 120) {
      setNextAction(`Epi due in ${Math.max(0, 180 - sinceLastEpi)}s`);
    } else if (timeToCheck <= 15 && timeToCheck > 0) {
      setNextAction(`Pulse check in ${timeToCheck}s`);
    } else if (shockCount > 0 && shockCount < 3 && (rhythm === 'VFib' || rhythm === 'VTach')) {
      setNextAction('Consider Amiodarone');
    } else {
      setNextAction('Resume compressions');
    }
  }, [elapsedSeconds, running]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Event logging ────────────────────────────────────────────────────
  const logEvent = useCallback((label: string, type: EventEntry['type']) => {
    setEvents((prev) => [...prev, { id: nextId(), label, time: new Date(), type }]);
  }, []);

  // ── Med administration ───────────────────────────────────────────────
  const administerMed = useCallback((name: string, dose: string) => {
    const now = new Date();
    setMeds((prev) => [...prev, { id: nextId(), name, dose, time: now }]);
    logEvent(`${name} ${dose} administered`, 'med');
    if (name === 'Epinephrine') lastEpiRef.current = elapsedSeconds;
    showToast(`${name} ${dose} logged`);
  }, [logEvent, showToast, elapsedSeconds]);

  // ── Shock delivery ───────────────────────────────────────────────────
  const deliverShock = useCallback(() => {
    setShockCount((c) => c + 1);
    logEvent(`Shock delivered — ${SHOCK_ENERGY} biphasic (#${shockCount + 1})`, 'shock');
    showToast(`Shock #${shockCount + 1} delivered`);
  }, [logEvent, showToast, shockCount]);

  // ── Rhythm change ────────────────────────────────────────────────────
  const changeRhythm = useCallback((r: Rhythm) => {
    setRhythm(r);
    logEvent(`Rhythm changed to ${r}`, 'rhythm');
  }, [logEvent]);

  // ── Pulse check acknowledgement ──────────────────────────────────────
  const acknowledgePulseCheck = useCallback(() => {
    setShowPulseCheck(false);
    logEvent('Pulse check performed — no pulse', 'system');
    showToast('Pulse check logged');
  }, [logEvent, showToast]);

  // ── Team role assignment (mock toggle) ───────────────────────────────
  const toggleAssignment = useCallback((role: TeamRole) => {
    setTeamAssignments((prev) => ({
      ...prev,
      [role]: prev[role] ? null : MOCK_NAMES[role] ?? 'Staff',
    }));
  }, []);

  // ── Resolution handlers ──────────────────────────────────────────────
  const handleROSC = useCallback(() => {
    setResolution('rosc');
    setRunning(false);
    logEvent('ROSC ACHIEVED', 'resolution');
    showToast('ROSC achieved — code timer stopped');
  }, [logEvent, showToast]);

  const handleDeath = useCallback(() => {
    if (!confirmDeath) {
      setConfirmDeath(true);
      return;
    }
    setResolution('death');
    setRunning(false);
    const tod = new Date();
    logEvent(`Time of death: ${fmtTime(tod)}`, 'resolution');
    showToast('Time of death recorded');
    setConfirmDeath(false);
  }, [confirmDeath, logEvent, showToast]);

  const handleClose = () => {
    // Reset state on close
    setElapsedSeconds(0);
    setRunning(true);
    setRhythm('VFib');
    setCycle(1);
    setShowPulseCheck(false);
    setMeds([]);
    setEvents([]);
    setShockCount(0);
    setTeamAssignments({ ...MOCK_NAMES });
    setResolution(null);
    setConfirmDeath(false);
    setNextAction('Begin compressions');
    lastCycleRef.current = 0;
    lastEpiRef.current = -999;
    _eventId = 0;
    onClose();
  };

  // ── Flashing animation for CODE BLUE label ───────────────────────────
  const flashKeyframes = `
    @keyframes codeblue-flash {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `;

  // ─────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="code-blue-screen"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            // Stop above MobileView's bottom HUD nav so app tabs stay visible.
            bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM,
            zIndex: Z.modal,
            background: CODE_BG,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONTS.sans,
            color: COLORS.textPrimary,
            overflow: 'hidden',
            borderTop: `1px solid ${COLORS.borderStrong}`,
          }}
        >
          <style>{flashKeyframes}</style>

          {/* ── Header ──────────────────────────────────────────────── */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              height: `calc(48px + env(safe-area-inset-top))`,
              paddingTop: 'env(safe-area-inset-top)',
              display: 'flex',
              alignItems: 'center',
              paddingLeft: `max(${SPACE.base}px, env(safe-area-inset-left))`,
              paddingRight: `max(${SPACE.base}px, env(safe-area-inset-right))`,
              borderBottom: `1px solid ${COLORS.crit}40`,
              background: `linear-gradient(180deg, ${COLORS.crit}12 0%, ${CODE_BG} 100%)`,
              zIndex: Z.modal + 1,
              gap: SPACE.sm,
              fontFamily: FONTS.mono,
            }}
          >
            <button
              className="tap-target"
              onClick={handleClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                background: 'transparent',
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textSecondary,
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
            <span style={{ animation: 'codeblue-flash 1.2s ease-in-out infinite' }}>
              <BracketLabel tone="crit" size="sm">Code Blue</BracketLabel>
            </span>
            <div style={{ flex: 1 }} />
            <StatusPill label={patientId} tone="crit" pulse />
            <Mono tone="muted" size="xs">{location}</Mono>
          </div>

          {/* ── Scrollable body ─────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              paddingTop: 60,
              paddingBottom: 24,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* ── Timer Section ─────────────────────────────────────── */}
            <div style={{ padding: `${SPACE.base}px ${SPACE.base}px ${SPACE.md}px`, textAlign: 'center' }}>
              <TacticalCard
                padding="lg"
                highlight
                style={{
                  borderColor: `${COLORS.crit}50`,
                  background: `${COLORS.crit}08`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <ScanningLine color={COLORS.crit} duration={6} />
                <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: SPACE.sm }}>
                  Elapsed Time
                </Mono>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 52,
                    fontWeight: 600,
                    color: COLORS.crit,
                    textShadow: `0 0 24px ${COLORS.crit}80, 0 0 48px ${COLORS.crit}30`,
                    lineHeight: 1,
                    letterSpacing: '0.05em',
                    marginBottom: SPACE.md,
                  }}
                >
                  {fmtElapsed(elapsedSeconds)}
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: SPACE.xl }}>
                  <div>
                    <Mono tone="muted" size="xs">Code Called</Mono>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
                      {fmtTimerShort(codeCalledAt)}
                    </div>
                  </div>
                  <div>
                    <Mono tone="muted" size="xs">Cycle</Mono>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textSecondary, marginTop: 2 }}>
                      {cycle} / CPR
                    </div>
                  </div>
                  <div>
                    <Mono tone="muted" size="xs">Shocks</Mono>
                    <div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.crit, marginTop: 2 }}>
                      {shockCount}
                    </div>
                  </div>
                </div>
                {resolution && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                      marginTop: SPACE.base,
                      padding: SPACE.md,
                      background: resolution === 'rosc' ? `${COLORS.ok}15` : `${COLORS.textMuted}10`,
                      border: `1px solid ${resolution === 'rosc' ? COLORS.ok : COLORS.textMuted}`,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    <Mono tone={resolution === 'rosc' ? 'ok' : 'muted'} size="sm">
                      {resolution === 'rosc' ? 'ROSC ACHIEVED' : `TIME OF DEATH: ${fmtTime(new Date())}`}
                    </Mono>
                  </motion.div>
                )}
              </TacticalCard>
            </div>

            {/* ── Next Action + Pulse Check ─────────────────────────── */}
            <div style={{ padding: `0 ${SPACE.base}px ${SPACE.md}px` }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.sm,
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  background: `${COLORS.warn}0C`,
                  border: `1px solid ${COLORS.warn}30`,
                  borderRadius: RADIUS.sm,
                }}
              >
                <Activity size={14} color={COLORS.warn} />
                <Mono tone="warn" size="sm">{nextAction}</Mono>
              </div>
              <AnimatePresence>
                {showPulseCheck && !resolution && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ marginTop: SPACE.sm }}
                  >
                    <motion.button
                      onClick={acknowledgePulseCheck}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        width: '100%',
                        padding: `${SPACE.md}px`,
                        background: `${COLORS.warn}18`,
                        border: `2px solid ${COLORS.warn}`,
                        borderRadius: RADIUS.sm,
                        color: COLORS.warn,
                        fontFamily: FONTS.mono,
                        fontSize: 14,
                        fontWeight: 600,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        boxShadow: `0 0 20px ${COLORS.warn}40`,
                        animation: 'codeblue-flash 1s ease-in-out infinite',
                      }}
                    >
                      <Heart size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
                      Pulse Check
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── ACLS Rhythm Selector ──────────────────────────────── */}
            <div style={{ padding: `0 ${SPACE.base}px ${SPACE.md}px` }}>
              <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: SPACE.sm }}>
                Rhythm
              </Mono>
              <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                {RHYTHMS.map((r) => {
                  const isActive = rhythm === r;
                  const isShockable = r === 'VFib' || r === 'VTach';
                  return (
                    <motion.button
                      key={r}
                      onClick={() => changeRhythm(r)}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        flex: 1,
                        minWidth: 70,
                        padding: `${SPACE.sm}px ${SPACE.md}px`,
                        background: isActive
                          ? isShockable ? `${COLORS.crit}20` : `${COLORS.warn}15`
                          : COLORS.surface,
                        border: `1.5px solid ${isActive
                          ? isShockable ? COLORS.crit : COLORS.warn
                          : COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        color: isActive
                          ? isShockable ? COLORS.crit : COLORS.warn
                          : COLORS.textSecondary,
                        fontFamily: FONTS.mono,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: cssTransition(),
                      }}
                    >
                      {r}
                      {isShockable && isActive && (
                        <Zap size={10} style={{ marginLeft: 4, display: 'inline', verticalAlign: 'middle' }} />
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* ── Shock Delivered ────────────────────────────────────── */}
            {!resolution && (
              <div style={{ padding: `0 ${SPACE.base}px ${SPACE.md}px` }}>
                <motion.button
                  onClick={deliverShock}
                  whileTap={{ scale: 0.96 }}
                  style={{
                    width: '100%',
                    padding: `${SPACE.lg}px`,
                    background: `linear-gradient(180deg, ${COLORS.crit}25 0%, ${COLORS.crit}10 100%)`,
                    border: `2px solid ${COLORS.crit}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.crit,
                    fontFamily: FONTS.mono,
                    fontSize: 16,
                    fontWeight: 700,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    boxShadow: `0 0 30px ${COLORS.crit}50, inset 0 1px 0 ${COLORS.crit}30`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: SPACE.sm,
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <Zap size={20} />
                  Shock Delivered
                  <span
                    style={{
                      position: 'absolute',
                      right: SPACE.base,
                      fontFamily: FONTS.mono,
                      fontSize: 12,
                      opacity: 0.7,
                    }}
                  >
                    {SHOCK_ENERGY}
                  </span>
                </motion.button>
                {shockCount > 0 && (
                  <Mono tone="muted" size="xs" style={{ display: 'block', marginTop: SPACE.xs, textAlign: 'center' }}>
                    {shockCount} shock{shockCount !== 1 ? 's' : ''} delivered &middot; {SHOCK_ENERGY} biphasic
                  </Mono>
                )}
              </div>
            )}

            <Divider color={`${COLORS.crit}20`} style={{ margin: `0 ${SPACE.base}px ${SPACE.md}px` }} />

            {/* ── Medication Log ─────────────────────────────────────── */}
            <div style={{ padding: `0 ${SPACE.base}px ${SPACE.md}px` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                <Syringe size={12} color={COLORS.textMuted} />
                <Mono tone="secondary" size="xs">Medications</Mono>
                <div style={{ flex: 1 }} />
                <Mono tone="muted" size="xs">{meds.length} given</Mono>
              </div>

              {/* Quick-add buttons */}
              {!resolution && (
                <div style={{ display: 'flex', gap: SPACE.xs, flexWrap: 'wrap', marginBottom: SPACE.md }}>
                  {QUICK_MEDS.map((m, i) => (
                    <motion.button
                      key={`${m.name}-${m.dose}-${i}`}
                      onClick={() => administerMed(m.name, m.dose)}
                      whileTap={{ scale: 0.95 }}
                      style={{
                        padding: `${SPACE.xs}px ${SPACE.sm}px`,
                        background: COLORS.surface,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        color: COLORS.textSecondary,
                        fontFamily: FONTS.mono,
                        fontSize: 9,
                        fontWeight: 500,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {m.name} {m.dose}
                    </motion.button>
                  ))}
                </div>
              )}

              {/* Med list with timeline */}
              {meds.length > 0 && (
                <div style={{ position: 'relative', paddingLeft: SPACE.lg }}>
                  {/* Timeline bar */}
                  <div
                    style={{
                      position: 'absolute',
                      left: 5,
                      top: 4,
                      bottom: 4,
                      width: 2,
                      background: `${COLORS.crit}30`,
                      borderRadius: RADIUS.full,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
                    {meds.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: MOTION.fast }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACE.sm,
                          position: 'relative',
                        }}
                      >
                        {/* Timeline dot */}
                        <div
                          style={{
                            position: 'absolute',
                            left: -SPACE.lg + 2,
                            width: 8,
                            height: 8,
                            borderRadius: RADIUS.full,
                            background: COLORS.crit,
                            boxShadow: `0 0 6px ${COLORS.crit}`,
                          }}
                        />
                        <Mono tone="muted" size="xs" style={{ minWidth: 60 }}>
                          {fmtTime(m.time)}
                        </Mono>
                        <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textPrimary }}>
                          {m.name}
                        </span>
                        <Mono tone="crit" size="xs">{m.dose}</Mono>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}
              {meds.length === 0 && (
                <Mono tone="dim" size="xs" style={{ display: 'block', textAlign: 'center', padding: SPACE.sm }}>
                  No medications administered
                </Mono>
              )}
            </div>

            <Divider color={`${COLORS.crit}20`} style={{ margin: `0 ${SPACE.base}px ${SPACE.md}px` }} />

            {/* ── Event Log ──────────────────────────────────────────── */}
            <div style={{ padding: `0 ${SPACE.base}px ${SPACE.md}px` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                <Clock size={12} color={COLORS.textMuted} />
                <Mono tone="secondary" size="xs">Event Log</Mono>
                <div style={{ flex: 1 }} />
                {!resolution && (
                  <motion.button
                    onClick={() => {
                      logEvent('Manual note', 'manual');
                      showToast('Event logged');
                    }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: `2px ${SPACE.sm}px`,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      color: COLORS.textSecondary,
                      fontFamily: FONTS.mono,
                      fontSize: 9,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                    }}
                  >
                    <Plus size={10} />
                    Log Event
                  </motion.button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs, maxHeight: 180, overflow: 'auto' }}>
                {[...events].reverse().map((evt) => {
                  const typeColor =
                    evt.type === 'shock' ? COLORS.crit
                    : evt.type === 'med' ? COLORS.info
                    : evt.type === 'rhythm' ? COLORS.warn
                    : evt.type === 'resolution' ? COLORS.ok
                    : COLORS.textMuted;
                  return (
                    <motion.div
                      key={evt.id}
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: MOTION.fast }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: SPACE.sm,
                        padding: `${SPACE.xs}px 0`,
                      }}
                    >
                      <div
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: RADIUS.full,
                          background: typeColor,
                          boxShadow: `0 0 4px ${typeColor}`,
                          flexShrink: 0,
                          marginTop: 5,
                        }}
                      />
                      <Mono tone="muted" size="xs" style={{ minWidth: 60, flexShrink: 0 }}>
                        {fmtTime(evt.time)}
                      </Mono>
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: TYPE.bodySm.size,
                          color: evt.type === 'resolution' ? COLORS.ok : COLORS.textSecondary,
                          lineHeight: 1.35,
                        }}
                      >
                        {evt.label}
                      </span>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            <Divider color={`${COLORS.crit}20`} style={{ margin: `0 ${SPACE.base}px ${SPACE.md}px` }} />

            {/* ── Team Roles ─────────────────────────────────────────── */}
            <div style={{ padding: `0 ${SPACE.base}px ${SPACE.md}px` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                <Users size={12} color={COLORS.textMuted} />
                <Mono tone="secondary" size="xs">Team Roles</Mono>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                  gap: SPACE.sm,
                }}
              >
                {TEAM_ROLES.map((role) => {
                  const assigned = teamAssignments[role];
                  return (
                    <motion.button
                      key={role}
                      onClick={() => toggleAssignment(role)}
                      whileTap={{ scale: 0.97 }}
                      style={{
                        padding: `${SPACE.sm}px ${SPACE.md}px`,
                        background: assigned ? `${COLORS.ok}08` : COLORS.surface,
                        border: `1px solid ${assigned ? `${COLORS.ok}30` : COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: 2 }}>
                        {role}
                      </Mono>
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: TYPE.bodySm.size,
                          fontWeight: 500,
                          color: assigned ? COLORS.textPrimary : COLORS.crit,
                        }}
                      >
                        {assigned ?? 'UNASSIGNED'}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <Divider color={`${COLORS.crit}20`} style={{ margin: `0 ${SPACE.base}px ${SPACE.md}px` }} />

            {/* ── Resolution Controls ───────────────────────────────── */}
            {!resolution && (
              <div style={{ padding: `0 ${SPACE.base}px ${SPACE.lg}px` }}>
                <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: SPACE.sm }}>
                  Resolution
                </Mono>
                <div style={{ display: 'flex', gap: SPACE.sm }}>
                  <motion.button
                    onClick={handleROSC}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      flex: 1,
                      padding: `${SPACE.md}px`,
                      background: `${COLORS.ok}12`,
                      border: `2px solid ${COLORS.ok}`,
                      borderRadius: RADIUS.sm,
                      color: COLORS.ok,
                      fontFamily: FONTS.mono,
                      fontSize: 13,
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      boxShadow: `0 0 16px ${COLORS.ok}30`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: SPACE.sm,
                    }}
                  >
                    <CheckCircle2 size={16} />
                    ROSC
                  </motion.button>
                  <motion.button
                    onClick={handleDeath}
                    whileTap={{ scale: 0.97 }}
                    style={{
                      flex: 1,
                      padding: `${SPACE.md}px`,
                      background: confirmDeath ? `${COLORS.textMuted}15` : COLORS.surface,
                      border: `1.5px solid ${confirmDeath ? COLORS.textMuted : COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      color: COLORS.textMuted,
                      fontFamily: FONTS.mono,
                      fontSize: confirmDeath ? 12 : 11,
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: SPACE.sm,
                    }}
                  >
                    <AlertTriangle size={14} />
                    {confirmDeath ? 'Confirm TOD' : 'Time of Death'}
                  </motion.button>
                </div>
                {confirmDeath && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{ marginTop: SPACE.xs }}
                  >
                    <Mono tone="warn" size="xs" style={{ display: 'block', textAlign: 'center' }}>
                      Tap again to confirm time of death
                    </Mono>
                  </motion.div>
                )}
              </div>
            )}

            {/* ── Post-Resolution Summary ───────────────────────────── */}
            {resolution && (
              <div style={{ padding: `0 ${SPACE.base}px ${SPACE.lg}px` }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: MOTION.base, ease: MOTION.ease }}
                >
                  <TacticalCard
                    highlight
                    accentBar
                    padding="lg"
                    style={{
                      borderColor: resolution === 'rosc' ? COLORS.ok : COLORS.textMuted,
                    }}
                  >
                    <ScanningLine color={resolution === 'rosc' ? COLORS.ok : COLORS.textMuted} duration={8} />
                    <Mono
                      tone={resolution === 'rosc' ? 'ok' : 'muted'}
                      size="sm"
                      style={{ display: 'block', marginBottom: SPACE.md }}
                    >
                      {resolution === 'rosc' ? 'Return of Spontaneous Circulation' : 'Code Terminated'}
                    </Mono>
                    <Divider style={{ margin: `${SPACE.sm}px 0` }} />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, marginTop: SPACE.md }}>
                      <SummaryRow label="Patient" value={patientId} />
                      <SummaryRow label="Location" value={location} />
                      <SummaryRow label="Duration" value={fmtElapsed(elapsedSeconds)} />
                      <SummaryRow label="Cycles" value={String(cycle)} />
                      <SummaryRow label="Shocks" value={String(shockCount)} />
                      <SummaryRow label="Medications" value={String(meds.length)} />
                      <SummaryRow label="Final Rhythm" value={rhythm} />
                      <SummaryRow
                        label="Outcome"
                        value={resolution === 'rosc' ? 'ROSC' : 'Deceased'}
                        valueColor={resolution === 'rosc' ? COLORS.ok : COLORS.textMuted}
                      />
                    </div>
                  </TacticalCard>
                </motion.div>
                <div style={{ marginTop: SPACE.base }}>
                  <TacticalButton variant="secondary" fullWidth onClick={handleClose}>
                    Close
                  </TacticalButton>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

CodeBlueScreen.displayName = 'CodeBlueScreen';

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

const SummaryRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label,
  value,
  valueColor,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Mono tone="muted" size="xs">{label}</Mono>
    <span
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.bodySm.size,
        fontWeight: 500,
        color: valueColor ?? COLORS.textPrimary,
      }}
    >
      {value}
    </span>
  </div>
);
