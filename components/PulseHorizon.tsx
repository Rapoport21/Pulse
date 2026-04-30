import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Zap,
  Ambulance,
  ArrowRight,
  Sliders,
  Network,
  Building2,
  Wind,
  MapPin,
  AlertTriangle,
  X,
  Activity,
  ChevronRight,
  UserPlus,
  DoorOpen,
  ClipboardList,
  FileText,
  Pill,
  Siren,
  ArrowRightLeft,
  MessageSquare,
  Users,
  Bell,
  Network as NetworkIcon,
  BrainCircuit,
  Minus,
  Plus,
} from 'lucide-react';
import { Status, Tab, UserProfile, UserRole } from '../types';
import { ROLE_METRICS, getRoleMetrics } from '../data/userProfiles';
import {
  type ScenarioState,
  metricValue,
  useScenarioTick,
} from '../lib/scenario';
import { useEmsInbound } from '../lib/emsLive';
import {
  BedBoard,
  AdmitFlow,
  DischargeFlow,
  RoundingList,
  NoteComposer,
  OrderEntry,
  CodeBlueScreen,
  HandoffComposer,
  SecureMessaging,
  WorkforceCoverage,
  AlertsCenter,
  DeptCoordination,
  BriefMeScreen,
} from './clinical';
import { seedBedState, type BedUnit } from '../data/bedMock';
import { useRealtimeState } from '../lib/realtime';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION, cssTransition,
  SHADOW,
  Mono,
  BracketLabel,
  StatusPill,
  SectionTitle,
  TacticalCard,
  TacticalButton,
  CornerBracket,
  BracketFrame,
  Divider,
  MetricValue,
} from './design';

interface PulseHorizonProps {
  onActivatePlaybook: () => void;
  isSurgeActive: boolean;
  currentUser: UserProfile;
  systemStatus?: 'normal' | 'stale' | 'manual';
  setSystemStatus?: (status: 'normal' | 'stale' | 'manual') => void;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
  onNavigateToActionBoard?: (filter: string) => void;
  /** Navigate to a top-level tab (e.g. Tab.ADMISSIONS, Tab.PATIENTS). */
  onNavigateTab?: (tab: string) => void;
  loginCount?: number;
  /** Active 3-minute simulation scenario. Drives metric overlays and
   *  forecast curve shifts when set. Null = baseline. */
  activeScenario?: ScenarioState | null;
}

type SelectedDriver = {
  id: string;
  name: string;
  value: string;
  status: Status;
  impact: number;
  trend: string;
};

const nearbyHospitals = [
  { name: 'Memorial General', status: 'Open', time: '12m', load: 65 },
  { name: 'St. Mary Level 1', status: 'Divert', time: '25m', load: 98 },
  { name: 'County Trauma', status: 'Busy', time: '18m', load: 85 },
];

const statusToTone = (s: Status): 'ok' | 'warn' | 'crit' => {
  if (s === Status.CRITICAL) return 'crit';
  if (s === Status.WARNING) return 'warn';
  return 'ok';
};

const statusToColor = (s: Status): string => {
  if (s === Status.CRITICAL) return COLORS.crit;
  if (s === Status.WARNING) return COLORS.warn;
  return COLORS.ok;
};

/**
 * PulseHorizon — flagship predictive capacity horizon.
 * Tactical theme: rose accent forecast, HUD strip header, bracket labels,
 * tactical cards, status pills, scannable KPI band, modernized driver rail.
 */
export const PulseHorizon: React.FC<PulseHorizonProps> = ({
  onActivatePlaybook,
  isSurgeActive,
  currentUser,
  systemStatus = 'normal',
  setSystemStatus,
  showToast,
  onNavigateTab,
  loginCount = 1,
  activeScenario = null,
}) => {
  // Scenario tick drives phase-aware re-renders. When the scenario's
  // phase changes (e.g. climb → peak), everything downstream — KPIs,
  // situation copy, forecast curve — picks up the new metrics without
  // a prop change. Components memoize on `phase` so we don't thrash
  // every second.
  const scenarioTick = useScenarioTick(activeScenario);

  // Live EMS feed — same source of truth as the Live Ops / EmsInboundBoard.
  // When the scenario engine publishes `ems-inject` runs, they flow through
  // useEmsInbound and show up here automatically.
  const { inbound: liveEms } = useEmsInbound();
  const liveEmsActive = useMemo(() => liveEms.filter((r) => !r.arrived), [liveEms]);
  const liveEmsTotal = liveEmsActive.length;
  const liveEmsCrit = useMemo(() => {
    const critLevels = new Set(['TRAUMA_1', 'STEMI', 'STROKE']);
    return liveEmsActive.filter(
      (r) => critLevels.has(r.activationLevel ?? 'NONE') && r.etaMinutes <= 5,
    ).length;
  }, [liveEmsActive]);
  const liveEmsStable = Math.max(0, liveEmsTotal - liveEmsCrit);
  // Saturation: 10 runs = 100%. Gives the progress rail something to
  // actually do while the scenario injects more EMS.
  const liveEmsSat = Math.min(100, liveEmsTotal * 10);

  const [simState, setSimState] = useState({
    addedStaff: 0,
    openBeds: 0,
    expeditedDischarges: 0,
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<SelectedDriver | null>(null);
  const [bedUnits] = useRealtimeState<BedUnit[]>('bed-units', seedBedState());
  const [showBedBoard, setShowBedBoard] = useState(false);
  const [showAdmitFlow, setShowAdmitFlow] = useState(false);
  const [showDischargeFlow, setShowDischargeFlow] = useState(false);
  const [showRoundingList, setShowRoundingList] = useState(false);
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [showOrderEntry, setShowOrderEntry] = useState(false);
  const [showCodeBlue, setShowCodeBlue] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showWorkforce, setShowWorkforce] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showDeptCoord, setShowDeptCoord] = useState(false);
  const [showBriefMe, setShowBriefMe] = useState(false);

  const drivers = useMemo(() => {
    // Scenario wins — when a scenario is running the role metrics helper
    // overlays live values from the phase timeline. Baseline otherwise.
    const baseDrivers = getRoleMetrics(currentUser.role, activeScenario);
    // First-login "things are fine" override only applies when we're NOT
    // mid-scenario — scenario data always wins.
    if (loginCount > 1 && !activeScenario) {
      return baseDrivers.map((driver) => {
        if (currentUser.role === UserRole.MANAGER) {
          if (driver.id === '1') return { ...driver, value: '4 Admitted', status: Status.NORMAL, impact: 25, trend: 'down' as const };
          if (driver.id === '2') return { ...driver, value: '15m Avg', status: Status.NORMAL, impact: 15, trend: 'down' as const };
          if (driver.id === '3') return { ...driver, value: 'Fully Staffed', status: Status.NORMAL, impact: 5, trend: 'stable' as const };
        }
        if (currentUser.role === UserRole.NURSE) {
          if (driver.id === 'n1') return { ...driver, value: '0 Overdue', status: Status.NORMAL, impact: 10, trend: 'down' as const };
          if (driver.id === 'n2') return { ...driver, value: '0 Patients', status: Status.NORMAL, impact: 5, trend: 'down' as const };
          if (driver.id === 'n3') return { ...driver, value: '1 Waiting', status: Status.NORMAL, impact: 15, trend: 'stable' as const };
        }
        if (currentUser.role === UserRole.ER_PERSONNEL) {
          if (driver.id === 'e1') return { ...driver, value: '2 Available', status: Status.NORMAL, impact: 20, trend: 'stable' as const };
          if (driver.id === 'e2') return { ...driver, value: '15 mins', status: Status.NORMAL, impact: 15, trend: 'down' as const };
          if (driver.id === 'e3') return { ...driver, value: '0 Inbound', status: Status.NORMAL, impact: 5, trend: 'down' as const };
        }
        return { ...driver, status: Status.NORMAL, impact: Math.floor(driver.impact * 0.3), trend: 'down' as const };
      });
    }
    return baseDrivers;
  }, [currentUser.role, loginCount, activeScenario, scenarioTick.phase]);

  const chartData = useMemo(() => {
    let baseLoad = { now: 92, plus30: 98, plus60: 105, plus90: 112 };
    let prevLoad = 85; // -30m anchor
    if (activeScenario) {
      // Scenario drives the curve. Each severity has its OWN trajectory
      // shape — they don't share a "things get worse, then recover"
      // model. S1 is a calm shift (drop below baseline), S2 is moderate
      // pressure (rise + plateau elevated), S3 is disaster (rise sharp).
      //
      //   sev | ramp/climb | peak/hold     | windDown/closing
      //   ----|------------|---------------|------------------
      //   S1  | settle low | flat-low      | drift back to baseline
      //   S2  | rise mod   | flat-elevated | decay toward baseline
      //   S3  | rise hard  | flat-high     | decay toward baseline
      const now = metricValue('nedocsScore', activeScenario);
      const phase = scenarioTick.phase;
      const sev = activeScenario.severity;
      const baseline = 112; // NEDOCS baseline anchor

      if (sev === 1) {
        // S1 is a CALM shift. We override the chart with explicit low
        // load% values rather than passing NEDOCS through, because the
        // chart axis is 0–100% and NEDOCS values (still 80–95 for S1)
        // would read as "high load" even on the calm trajectory.
        // Reference lines: WARN 85, CAPACITY 100. S1 sits well below.
        if (phase === 'ramp' || phase === 'climb') {
          // We were running normal-busy; now visibly calming down.
          baseLoad = { now: 42, plus30: 38, plus60: 34, plus90: 32 };
          prevLoad = 78;
        } else if (phase === 'peak' || phase === 'hold') {
          // Settled into the calm plateau — far below WARN line.
          baseLoad = { now: 30, plus30: 30, plus60: 32, plus90: 34 };
          prevLoad = 36;
        } else {
          // windDown / closing — drifting back up toward baseline.
          baseLoad = { now: 38, plus30: 50, plus60: 65, plus90: 78 };
          prevLoad = 32;
        }
      } else if (sev === 2) {
        if (phase === 'ramp' || phase === 'climb') {
          baseLoad = { now, plus30: now + 5, plus60: now + 9, plus90: now + 12 };
          prevLoad = Math.max(60, now - 6);
        } else if (phase === 'peak' || phase === 'hold') {
          baseLoad = { now, plus30: now + 2, plus60: now + 3, plus90: now + 1 };
          prevLoad = Math.max(60, now - 3);
        } else {
          baseLoad = { now, plus30: now - 4, plus60: now - 9, plus90: now - 13 };
          prevLoad = now + 3;
        }
      } else {
        // S3 — disaster trajectory (original aggressive curve)
        if (phase === 'ramp' || phase === 'climb') {
          baseLoad = { now, plus30: now + 8, plus60: now + 14, plus90: now + 18 };
          prevLoad = Math.max(60, now - 10);
        } else if (phase === 'peak' || phase === 'hold') {
          baseLoad = { now, plus30: now + 3, plus60: now + 4, plus90: now + 2 };
          prevLoad = Math.max(60, now - 4);
        } else {
          baseLoad = { now, plus30: now - 6, plus60: now - 14, plus90: now - 20 };
          prevLoad = now + 4;
        }
      }
    } else if (isSurgeActive) {
      baseLoad = { now: 32, plus30: 30, plus60: 28, plus90: 25 };
      prevLoad = 85;
    } else if (loginCount > 1) {
      baseLoad = { now: 32, plus30: 34, plus60: 35, plus90: 38 };
      prevLoad = 32;
    }
    const staffImpact = simState.addedStaff * 2.5;
    const bedImpact = simState.openBeds * 1.5;
    const dischargeImpact = simState.expeditedDischarges * 3.0;
    const totalReduction = staffImpact + bedImpact + dischargeImpact;
    const r30 = totalReduction * 0.3;
    const r60 = totalReduction * 0.7;
    const r90 = totalReduction * 1.0;

    return [
      { time: '-30m', load: prevLoad, capacity: 100 },
      { time: 'NOW', load: systemStatus === 'manual' ? 85 : baseLoad.now, capacity: 100 },
      { time: '+30m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus30 - r30), capacity: 100 },
      { time: '+60m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus60 - r60), capacity: 100 },
      { time: '+90m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus90 - r90), capacity: 100 },
    ];
  }, [simState, isSurgeActive, systemStatus, loginCount, activeScenario, scenarioTick.phase]);

  // Bed state is now synced via useRealtimeState — surge escalation
  // is handled centrally in App.tsx activateSurge/deactivateSurge.

  const currentLoad = chartData[1].load;
  const projectedLoad = chartData[4].load;
  const isSafe = projectedLoad < 100;
  const delta = projectedLoad - currentLoad;
  const isRising = delta > 0;

  // NEDOCS-style severity classification for the forecast number.
  // When a scenario is running, severity wins over numerical thresholds
  // so the screen telegraphs the scenario unambiguously: S1 = ok, S2 =
  // warn, S3 = crit — even if the projected number is mid-band.
  const forecastTone: 'ok' | 'warn' | 'crit' = (() => {
    if (activeScenario && scenarioTick.remainingMs > 0) {
      const sev = activeScenario.severity;
      if (sev === 3) return 'crit';
      if (sev === 2) return 'warn';
      return 'ok';
    }
    return projectedLoad >= 100 ? 'crit' : projectedLoad >= 85 ? 'warn' : 'ok';
  })();

  // Chart accent — drives the saturation-forecast line stroke + fill
  // gradient so the visual color tracks scenario severity, not just the
  // data values. Without this, S1/S2/S3 only re-shape the curve and the
  // line stays the same blue, making the screen feel unresponsive.
  const chartAccent =
    forecastTone === 'crit'
      ? COLORS.crit
      : forecastTone === 'warn'
      ? COLORS.warn
      : activeScenario && scenarioTick.remainingMs > 0
      ? COLORS.ok      // S1 — explicitly green to read "calm"
      : COLORS.info;   // baseline (no scenario, sub-warn) — neutral blue

  const getDriverTitle = () => {
    switch (currentUser.role) {
      case UserRole.NURSE:
        return 'My Patient Alerts';
      case UserRole.ER_PERSONNEL:
        return 'Trauma & Triage Status';
      default:
        return 'Pressure Drivers';
    }
  };

  const handleSwitchToManual = () => {
    if (setSystemStatus) setSystemStatus('manual');
    setShowManualModal(false);
  };

  // ─── Styles (reusable) ────────────────────────────────────────────────
  const labelRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACE.sm,
  };
  const sliderStyle: React.CSSProperties = {
    width: '100%',
    height: 2,
    background: COLORS.borderStrong,
    outline: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    cursor: 'pointer',
    accentColor: COLORS.accent,
  };

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: COLORS.bg,
        // 2026-04-17 (pass 3): 40px bottom HudStrip ticker eats viewport
        // the previous passes didn't account for. Tightened outer frame
        // again — padding SPACE.xl→SPACE.md (−24px) and gap
        // SPACE.lg→SPACE.md (−32px across 4 section gaps). This plus the
        // Forecast chart drop 280→220 buys ~115px. Density is still
        // generous; cards keep their own internal SPACE.lg padding so
        // the HUD doesn't feel cramped, just less wasteful.
        padding: SPACE.md,
        fontFamily: FONTS.sans,
        color: COLORS.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
      }}
    >
      {/* Page Header — HUD strip (full width so both columns below start on
          the same baseline: "Saturation Forecast" and "Inbound EMS" are
          visually aligned at the top of the grid). */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: SPACE.lg,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <SectionTitle
            id="HORIZON.4H"
            label="Predictive Capacity Horizon"
            divider={false}
            style={{ marginBottom: 4 }}
          />
          <Mono tone="muted" size="xs">
            // 4-hour forecast · Role view: {currentUser.role.replace('_', ' ')} ·{' '}
            {isSimulating ? 'SIMULATION MODE' : 'Live telemetry'}
          </Mono>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flexShrink: 0 }}>
          <StatusPill
            label={
              systemStatus === 'manual'
                ? 'MANUAL'
                : systemStatus === 'stale'
                ? 'DEGRADED'
                : activeScenario && scenarioTick.remainingMs > 0
                ? activeScenario.severity === 3
                  ? 'CRITICAL'
                  : activeScenario.severity === 2
                  ? 'ELEVATED'
                  : 'NORMAL OPS'
                : isSafe
                ? 'NOMINAL'
                : 'CRITICAL'
            }
            tone={
              systemStatus === 'manual'
                ? 'crit'
                : systemStatus === 'stale'
                ? 'warn'
                : activeScenario && scenarioTick.remainingMs > 0
                ? activeScenario.severity === 3
                  ? 'crit'
                  : activeScenario.severity === 2
                  ? 'warn'
                  : 'ok'
                : isSafe
                ? 'ok'
                : 'crit'
            }
            pulse={systemStatus === 'normal' && !isSafe}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)',
          gap: SPACE.xl,
          // alignItems default (stretch) — RIGHT column's Drivers card has
          // flex:1 so it expands to match the LEFT column's chart-driven
          // height. Previously `alignItems: 'start'` locked both columns to
          // their intrinsic content heights, which created a deep negative-
          // space void under the LEFT column after the dense sub-widgets
          // were moved out of the RIGHT column below.
        }}
      >
        {/* ══════════════════════════════ LEFT COLUMN ══════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, minWidth: 0 }}>
          {/* Stale Data Banner */}
          <AnimatePresence>
            {systemStatus === 'stale' && (
              <motion.div
                key="stale"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              >
                <TacticalCard
                  padding="sm"
                  onClick={() => setShowManualModal(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowManualModal(true)}
                  style={{
                    borderColor: COLORS.warn,
                    cursor: 'pointer',
                    boxShadow: `0 0 20px ${COLORS.warn}22`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: SPACE.md,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                      <AlertTriangle size={16} strokeWidth={2} color={COLORS.warn} />
                      <div>
                        <Mono tone="warn" size="sm">
                          [ DATA FRESHNESS WARNING ]
                        </Mono>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 14,
                            color: COLORS.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          EHR sync delayed by 14 minutes · Confidence: Partial
                        </div>
                      </div>
                    </div>
                    <TacticalButton variant="secondary" size="sm">
                      Switch to Manual
                    </TacticalButton>
                  </div>
                </TacticalCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Manual Mode Banner */}
          <AnimatePresence>
            {systemStatus === 'manual' && (
              <motion.div
                key="manual"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              >
                <TacticalCard
                  padding="sm"
                  style={{
                    borderColor: COLORS.accent,
                    boxShadow: `0 0 20px ${COLORS.accentGlow}`,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: SPACE.md,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                      <ShieldAlert size={16} strokeWidth={2} color={COLORS.accent} />
                      <div>
                        <Mono tone="accent" size="sm">
                          [ MANUAL OVERRIDE ACTIVE ]
                        </Mono>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 14,
                            color: COLORS.textSecondary,
                            marginTop: 2,
                          }}
                        >
                          Forecast disabled — insufficient telemetry
                        </div>
                      </div>
                    </div>
                    <TacticalButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        if (setSystemStatus) setSystemStatus('normal');
                        if (showToast) showToast('EHR Sync Restored. Telemetry is live.', 'success');
                      }}
                    >
                      Restore EHR
                    </TacticalButton>
                  </div>
                </TacticalCard>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main Forecast Card ── */}
          <TacticalCard
            padding="none"
            highlight={!isSafe && systemStatus === 'normal'}
            style={{
              display: 'flex',
              flexDirection: 'column',
              opacity: systemStatus === 'manual' ? 0.75 : 1,
              transition: `opacity ${MOTION.base}s ease`,
            }}
          >
            {/* Chart header strip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceElev,
                gap: SPACE.md,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                <Activity size={16} strokeWidth={2} color={COLORS.textSecondary} />
                <Mono tone="primary" size="sm">
                  Saturation Forecast
                </Mono>
                <BracketLabel tone={isSimulating ? 'info' : 'ok'} size="xs">
                  {isSimulating ? 'SIM' : 'LIVE'}
                </BracketLabel>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
                <Mono tone="muted" size="xs">
                  RANGE: -30M → +90M · RES: 30M
                </Mono>
                <TacticalButton
                  variant={isSimulating ? 'primary' : 'secondary'}
                  size="sm"
                  icon={<Sliders size={12} strokeWidth={2} />}
                  onClick={() => {
                    setIsSimulating(!isSimulating);
                    if (isSimulating) setSimState({ addedStaff: 0, openBeds: 0, expeditedDischarges: 0 });
                  }}
                >
                  {isSimulating ? 'Reset Sim' : 'What-If Sim'}
                </TacticalButton>
              </div>
            </div>

            {/* Chart — 220px on pass 3 (was 280). The 40px bottom HudStrip
                ticker takes viewport room that wasn't accounted for in the
                first trim pass; this shrinks the tallest single element on
                the page to claw it back. Still legible, still shows the
                -30m → +90m range clearly. */}
            <div
              style={{
                position: 'relative',
                height: 220,
                padding: SPACE.md,
                overflow: 'hidden',
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 16, right: 20, left: -8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="horizonFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartAccent} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={chartAccent} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="horizonFillSim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={chartAccent} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={chartAccent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={COLORS.border} vertical={false} />
                  <XAxis
                    dataKey="time"
                    stroke={COLORS.textMuted}
                    fontSize={11}
                    fontFamily={FONTS.mono}
                    tickMargin={8}
                    axisLine={{ stroke: COLORS.border }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke={COLORS.textMuted}
                    fontSize={11}
                    fontFamily={FONTS.mono}
                    domain={[0, 130]}
                    ticks={[0, 50, 100]}
                    axisLine={false}
                    tickLine={false}
                    width={32}
                  />
                  <Tooltip
                    cursor={{ stroke: COLORS.borderStrong, strokeDasharray: '2 3' }}
                    contentStyle={{
                      backgroundColor: COLORS.surface,
                      border: `1px solid ${COLORS.borderStrong}`,
                      borderRadius: RADIUS.sm,
                      color: COLORS.textPrimary,
                      fontFamily: FONTS.mono,
                      fontSize: 13,
                      textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}
                    itemStyle={{ color: chartAccent }}
                    labelStyle={{ color: COLORS.textMuted }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'LOAD']}
                  />
                  <ReferenceLine
                    y={100}
                    stroke={COLORS.crit}
                    strokeDasharray="3 3"
                    strokeWidth={1}
                    label={{
                      value: 'CAPACITY 100%',
                      position: 'insideTopRight',
                      fill: COLORS.crit,
                      fontSize: 11,
                      fontFamily: FONTS.mono,
                      letterSpacing: '0.14em',
                    }}
                  />
                  <ReferenceLine
                    y={85}
                    stroke={COLORS.warn}
                    strokeDasharray="2 4"
                    strokeWidth={1}
                    label={{
                      value: 'WARN 85%',
                      position: 'insideTopRight',
                      fill: COLORS.warn,
                      fontSize: 11,
                      fontFamily: FONTS.mono,
                      letterSpacing: '0.14em',
                    }}
                  />
                  <ReferenceLine
                    x="NOW"
                    stroke={COLORS.textSecondary}
                    strokeDasharray="2 3"
                    strokeWidth={1}
                  />
                  <Area
                    type="monotone"
                    dataKey="load"
                    stroke={chartAccent}
                    strokeWidth={2}
                    fill="url(#horizonFill)"
                    isAnimationActive
                    animationDuration={500}
                  />
                  {isSimulating && (
                    <Area
                      type="monotone"
                      dataKey="load"
                      strokeDasharray="4 4"
                      stroke={chartAccent}
                      strokeWidth={1.5}
                      fill="url(#horizonFillSim)"
                      isAnimationActive={false}
                    />
                  )}
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* KPI footer band */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                borderTop: `1px solid ${COLORS.border}`,
                background: COLORS.bgDeep,
              }}
            >
              <KpiCell label="Current" value={`${currentLoad.toFixed(0)}%`} tone="primary" />
              <KpiCell
                label="Forecast +90m"
                value={`${projectedLoad.toFixed(0)}%`}
                tone={forecastTone}
              />
              <KpiCell
                label={isRising ? 'Rising' : 'Falling'}
                value={`${delta >= 0 ? '+' : ''}${delta.toFixed(0)}%`}
                tone={isRising ? 'crit' : 'ok'}
                icon={
                  isRising ? (
                    <TrendingUp size={14} strokeWidth={2} color={COLORS.crit} />
                  ) : (
                    <TrendingDown size={14} strokeWidth={2} color={COLORS.ok} />
                  )
                }
              />
              <KpiCell
                label="Status"
                value={projectedLoad > 100 ? 'SAT' : 'SAFE'}
                tone={projectedLoad > 100 ? 'crit' : 'ok'}
                isLast
              />
            </div>
          </TacticalCard>

          {/* ── Simulator / Recommendation + Network ── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: SPACE.lg,
            }}
          >
            {/* Simulator controls OR recommendation */}
            {isSimulating ? (
              <TacticalCard padding="md" accentBar style={{ padding: SPACE.lg }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.sm,
                    marginBottom: SPACE.md,
                  }}
                >
                  <Zap size={16} strokeWidth={2} color={COLORS.info} />
                  <Mono tone="primary" size="sm">
                    Operational Levers
                  </Mono>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
                  <LeverSlider
                    label="Add Nursing Staff"
                    unit="FTE"
                    value={simState.addedStaff}
                    max={5}
                    onChange={(v) => setSimState({ ...simState, addedStaff: v })}
                  />
                  <LeverSlider
                    label="Open Surge Beds"
                    unit="BEDS"
                    value={simState.openBeds}
                    max={10}
                    onChange={(v) => setSimState({ ...simState, openBeds: v })}
                  />
                  <LeverSlider
                    label="Expedite Discharges"
                    unit="PTS"
                    value={simState.expeditedDischarges}
                    max={8}
                    onChange={(v) => setSimState({ ...simState, expeditedDischarges: v })}
                  />
                </div>
                <Divider variant="dashed" style={{ marginTop: SPACE.lg, marginBottom: SPACE.md }} />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACE.md,
                  }}
                >
                  <Mono tone="muted" size="xs">
                    // Impact reflected in forecast
                  </Mono>
                  {isSafe && !isSurgeActive && (
                    <TacticalButton
                      variant="primary"
                      size="sm"
                      icon={<ArrowRight size={13} strokeWidth={2} />}
                      onClick={onActivatePlaybook}
                    >
                      Apply & Activate
                    </TacticalButton>
                  )}
                </div>
              </TacticalCard>
            ) : (
              <TacticalCard
                padding="md"
                highlight={!isSurgeActive && loginCount <= 1}
                accentBar={!isSurgeActive && loginCount <= 1}
                style={{
                  padding: SPACE.lg,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  // 220 (was 260) as part of the 2026-04-17 single-viewport
                  // pass — still leaves enough vertical room for the two-line
                  // recommendation copy + CTA + status pill.
                  minHeight: 220,
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.sm,
                      marginBottom: SPACE.sm,
                    }}
                  >
                    {(() => {
                      // Scenario drives tone first — when a scenario is
                      // running, the recommendation tracks its severity +
                      // phase rather than loginCount heuristics.
                      if (activeScenario) {
                        const sev = activeScenario.severity;
                        const icon =
                          sev === 3 ? (
                            <ShieldAlert size={14} strokeWidth={2} color={COLORS.crit} />
                          ) : sev === 2 ? (
                            <AlertTriangle size={14} strokeWidth={2} color={COLORS.warn} />
                          ) : (
                            <CheckCircle2 size={14} strokeWidth={2} color={COLORS.ok} />
                          );
                        const tone: 'ok' | 'warn' | 'crit' =
                          sev === 3 ? 'crit' : sev === 2 ? 'warn' : 'ok';
                        const label =
                          sev === 3
                            ? 'MCI · INTERVENTION REQ'
                            : sev === 2
                            ? 'ELEVATED · MONITOR'
                            : 'NORMAL OPS';
                        return (
                          <>
                            {icon}
                            <Mono tone={tone} size="sm">
                              [ {label} ]
                            </Mono>
                          </>
                        );
                      }
                      return isSurgeActive ? (
                        <>
                          <CheckCircle2 size={14} strokeWidth={2} color={COLORS.ok} />
                          <Mono tone="ok" size="sm">[ PROTOCOL ACTIVE ]</Mono>
                        </>
                      ) : loginCount > 1 ? (
                        <>
                          <CheckCircle2 size={14} strokeWidth={2} color={COLORS.textMuted} />
                          <Mono tone="muted" size="sm">[ NO ACTION REQ ]</Mono>
                        </>
                      ) : (
                        <>
                          <ShieldAlert size={14} strokeWidth={2} color={COLORS.accent} />
                          <Mono tone="accent" size="sm">[ INTERVENTION REQ ]</Mono>
                        </>
                      );
                    })()}
                  </div>
                  <p
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 15,
                      lineHeight: 1.55,
                      color: COLORS.textSecondary,
                      margin: 0,
                    }}
                  >
                    {(() => {
                      if (activeScenario) {
                        const sev = activeScenario.severity;
                        const phase = scenarioTick.phase;
                        const census = Math.round(metricValue('census', activeScenario));
                        const er = Math.round(metricValue('erWaitMinutes', activeScenario));
                        const codes = Math.round(metricValue('activeCodes', activeScenario));
                        const ems = liveEmsTotal;
                        const easing = phase === 'windDown' || phase === 'closing';
                        if (sev === 3) {
                          return easing
                            ? `MCI stabilizing. Census ${census}. ER wait ${er}m. ${codes} active code${codes === 1 ? '' : 's'}. ${ems} EMS inbound. MTP winding down — maintain float coverage through closing.`
                            : `MASS CASUALTY INCIDENT. Census ${census} (+${census - 284}). ER wait ${er}m. ${codes} active code${codes === 1 ? '' : 's'}. ${ems} EMS inbound, ${liveEmsCrit} critical. Overflow Hall C open, divert posted. Hold all discharges.`;
                        }
                        if (sev === 2) {
                          return easing
                            ? `Pressure easing. Census ${census}. ER wait ${er}m. ${ems} EMS inbound. Float pool standing down. No surge required.`
                            : `Elevated load. Census ${census} (+${census - 284}). ER wait ${er}m. ${ems} EMS inbound, ${liveEmsCrit} critical. Float pool on standby. Monitor for escalation.`;
                        }
                        return `Normal operations. Census ${census}, ER wait ${er}m. ${ems} EMS inbound — baseline throughput. All metrics within target.`;
                      }
                      return isSurgeActive
                        ? 'Surge Level 2 active. Census 312 (+28). Float pool deployed. Overflow Hall C open — 2 occupied, 2 ready. ER wait 125m, divert recommended. 3 active codes. Risk trajectory stabilizing — monitor fast-track throughput.'
                        : loginCount > 1
                        ? 'Capacity is stable. Census 284, ER wait 45m. ICU at 83%. Staffing ratio 1:4.2 — optimal. No surge protocols required.'
                        : 'Forecast exceeds safety thresholds. Census trending +28 over 2h. Activate Surge Protocol Level 2 immediately.';
                    })()}
                  </p>
                </div>
                {!isSurgeActive && (() => {
                  // CTA mirrors the recommendation tone:
                  //   S1   → calm-ops action (Schedule Discharges)
                  //   S2   → mid-action (Request Float Pool)
                  //   S3   → escalate (Activate Surge Playbook)
                  //   no scenario, first login (intervention req) → Activate Surge
                  //   no scenario, returning login                 → no CTA
                  if (activeScenario && scenarioTick.remainingMs > 0) {
                    const sev = activeScenario.severity;
                    if (sev === 1) {
                      return (
                        <TacticalButton
                          variant="secondary"
                          size="md"
                          fullWidth
                          icon={<ArrowRight size={14} strokeWidth={2} />}
                          onClick={() => {
                            if (showToast) {
                              showToast('Discharge sweep requested · porters paged', 'success');
                            }
                          }}
                          style={{ marginTop: SPACE.md }}
                        >
                          Schedule Discharges
                        </TacticalButton>
                      );
                    }
                    if (sev === 2) {
                      return (
                        <TacticalButton
                          variant="primary"
                          size="md"
                          fullWidth
                          icon={<ArrowRight size={14} strokeWidth={2} />}
                          onClick={() => {
                            if (showToast) {
                              showToast('Float pool requested · ETA 20m', 'info');
                            }
                          }}
                          style={{ marginTop: SPACE.md }}
                        >
                          Request Float Pool
                        </TacticalButton>
                      );
                    }
                    // S3
                    return (
                      <TacticalButton
                        variant="primary"
                        size="md"
                        fullWidth
                        icon={<ArrowRight size={14} strokeWidth={2} />}
                        onClick={onActivatePlaybook}
                        style={{ marginTop: SPACE.md }}
                      >
                        Activate Surge Playbook
                      </TacticalButton>
                    );
                  }
                  if (loginCount <= 1) {
                    return (
                      <TacticalButton
                        variant="primary"
                        size="md"
                        fullWidth
                        icon={<ArrowRight size={14} strokeWidth={2} />}
                        onClick={onActivatePlaybook}
                        style={{ marginTop: SPACE.md }}
                      >
                        Activate Surge Playbook
                      </TacticalButton>
                    );
                  }
                  return null;
                })()}
              </TacticalCard>
            )}

            {/* Regional Network */}
            <TacticalCard padding="md" style={{ padding: SPACE.lg }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: SPACE.md,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                  <Network size={16} strokeWidth={2} color={COLORS.textSecondary} />
                  <Mono tone="primary" size="sm">
                    Regional Network
                  </Mono>
                </div>
                <RefreshCw size={13} strokeWidth={2} color={COLORS.textMuted} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                {nearbyHospitals.map((h, idx) => {
                  const tone: 'ok' | 'warn' | 'crit' =
                    h.status === 'Open' ? 'ok' : h.status === 'Divert' ? 'crit' : 'warn';
                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: SPACE.sm,
                        background: COLORS.bgDeep,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                        <StatusPill label="" tone={tone} size="xs" />
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: FONTS.sans,
                              fontSize: 15,
                              color: COLORS.textPrimary,
                              fontWeight: 500,
                              letterSpacing: '-0.005em',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {h.name}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              marginTop: 2,
                            }}
                          >
                            <MapPin size={11} strokeWidth={2} color={COLORS.textMuted} />
                            <Mono tone="muted" size="xs">
                              {h.time} TRANSFER
                            </Mono>
                          </div>
                        </div>
                      </div>
                      <BracketLabel tone={tone === 'ok' ? 'muted' : tone === 'crit' ? 'accent' : 'secondary'} size="xs">
                        {h.status.toUpperCase()}
                      </BracketLabel>
                    </div>
                  );
                })}
              </div>
            </TacticalCard>
          </div>
        </div>

        {/* ══════════════════════════════ RIGHT COLUMN ══════════════════════════════ */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.md,
            minWidth: 0,
          }}
        >
          {/* Inbound EMS */}
          <TacticalCard padding="md" style={{ padding: SPACE.lg, overflow: 'hidden', position: 'relative' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: SPACE.md,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <Ambulance size={16} strokeWidth={2} color={COLORS.textSecondary} />
                <Mono tone="primary" size="sm">
                  Inbound EMS
                </Mono>
              </div>
              <StatusPill label="LIVE FEED" tone="info" pulse size="xs" />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: SPACE.sm,
                marginBottom: SPACE.md,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 56,
                  fontWeight: 600,
                  letterSpacing: '-0.04em',
                  lineHeight: 0.9,
                  color: COLORS.textPrimary,
                }}
              >
                {liveEmsTotal}
              </span>
              <Mono tone="muted" size="xs">
                TOTAL EN ROUTE
              </Mono>
            </div>
            {/* Progress rail — reflects live EMS saturation. Turns accent
                when any critical is inbound, ok when all stable. */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 3,
                background: COLORS.borderStrong,
                borderRadius: RADIUS.full,
                overflow: 'hidden',
                marginBottom: SPACE.md,
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${liveEmsSat}%` }}
                transition={{ duration: MOTION.slow, ease: MOTION.ease }}
                style={{
                  height: '100%',
                  background: liveEmsCrit > 0 ? COLORS.accent : COLORS.ok,
                  boxShadow: `0 0 8px ${liveEmsCrit > 0 ? COLORS.accent : COLORS.ok}`,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {liveEmsCrit > 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldAlert size={13} strokeWidth={2} color={COLORS.accent} />
                  <Mono tone="accent" size="xs">
                    {liveEmsCrit} CRIT {'<'} 5M
                  </Mono>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={13} strokeWidth={2} color={COLORS.ok} />
                  <Mono tone="ok" size="xs">
                    0 CRIT
                  </Mono>
                </div>
              )}
              <Mono tone="muted" size="xs">
                {liveEmsStable} STABLE
              </Mono>
            </div>
          </TacticalCard>

          {/* Drivers */}
          <TacticalCard
            padding="md"
            style={{
              padding: SPACE.lg,
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                marginBottom: SPACE.md,
                flexShrink: 0,
              }}
            >
              <Wind size={16} strokeWidth={2} color={COLORS.textSecondary} />
              <Mono tone="primary" size="sm">
                {getDriverTitle()}
              </Mono>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: `linear-gradient(90deg, ${COLORS.border}, transparent)`,
                }}
              />
              <Mono tone="muted" size="xs">
                {drivers.length}
              </Mono>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.md,
                overflowY: 'auto',
                paddingRight: 2,
                flex: 1,
              }}
              className="pulse-horizon-drivers"
            >
              {drivers.map((driver, idx) => {
                const isExpanded = expandedDriverId === driver.id;
                const driverColor = statusToColor(driver.status);
                return (
                  <div
                    key={driver.id}
                    role="button"
                    tabIndex={0}
                    onClick={() =>
                      setExpandedDriverId(isExpanded ? null : driver.id)
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedDriverId(isExpanded ? null : driver.id);
                      }
                    }}
                    style={{
                      position: 'relative',
                      padding: SPACE.sm,
                      background: isExpanded ? COLORS.surfaceElev : 'transparent',
                      border: `1px solid ${isExpanded ? COLORS.borderStrong : COLORS.border}`,
                      borderLeft: `2px solid ${driverColor}`,
                      borderRadius: RADIUS.sm,
                      cursor: 'pointer',
                      transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: SPACE.sm,
                        marginBottom: SPACE.sm,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACE.sm,
                          minWidth: 0,
                        }}
                      >
                        <Mono tone="dim" size="xs" style={{ flexShrink: 0 }}>
                          {String(idx + 1).padStart(2, '0')}
                        </Mono>
                        <span
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 15,
                            fontWeight: 500,
                            color: COLORS.textPrimary,
                            letterSpacing: '-0.005em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {driver.name}
                        </span>
                      </div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACE.sm,
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: FONTS.mono,
                            fontSize: 13,
                            fontWeight: 600,
                            letterSpacing: '0.08em',
                            color: driverColor,
                          }}
                        >
                          {driver.value}
                        </span>
                        <ChevronRight
                          size={12}
                          strokeWidth={2}
                          color={COLORS.textMuted}
                          style={{
                            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                            transition: `transform ${MOTION.fast}s ease`,
                          }}
                        />
                      </div>
                    </div>
                    {/* Impact bar */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.sm,
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          flex: 1,
                          height: 2,
                          background: COLORS.borderStrong,
                          overflow: 'hidden',
                        }}
                      >
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${driver.impact}%` }}
                          transition={{ duration: MOTION.slow, ease: MOTION.ease }}
                          style={{
                            height: '100%',
                            background: driverColor,
                            boxShadow:
                              driver.status === Status.CRITICAL
                                ? `0 0 8px ${driverColor}`
                                : 'none',
                          }}
                        />
                      </div>
                      <Mono
                        tone={statusToTone(driver.status)}
                        size="xs"
                        style={{ width: 32, textAlign: 'right' }}
                      >
                        {driver.impact}%
                      </Mono>
                    </div>

                    <AnimatePresence initial={false}>
                      {isExpanded && (
                        <motion.div
                          key="expanded"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                          onClick={(e) => e.stopPropagation()}
                          style={{ overflow: 'hidden' }}
                        >
                          <div
                            style={{
                              marginTop: SPACE.md,
                              padding: SPACE.md,
                              background: COLORS.bgDeep,
                              border: `1px solid ${COLORS.border}`,
                              borderRadius: RADIUS.sm,
                            }}
                          >
                            <p
                              style={{
                                fontFamily: FONTS.sans,
                                fontSize: 14,
                                lineHeight: 1.5,
                                color: COLORS.textSecondary,
                                margin: 0,
                                marginBottom: SPACE.md,
                              }}
                            >
                              {driver.status === Status.CRITICAL
                                ? `Critical pressure detected. Immediate intervention required to stabilize ${driver.name.toLowerCase()} metrics.`
                                : `Monitoring ${driver.name.toLowerCase()}. Current levels within acceptable thresholds — observation required.`}
                            </p>
                            <div style={{ display: 'flex', gap: SPACE.sm }}>
                              <TacticalButton
                                variant="primary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedDriverDetails(driver);
                                }}
                                style={{ flex: 1 }}
                              >
                                View Details
                              </TacticalButton>
                              <TacticalButton
                                variant="secondary"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (showToast) showToast('Driver acknowledged. Monitoring adjusted.', 'info');
                                  setExpandedDriverId(null);
                                }}
                                style={{ flex: 1 }}
                              >
                                Acknowledge
                              </TacticalButton>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>

            {/* House status */}
            <div style={{ marginTop: SPACE.md, flexShrink: 0 }}>
              <Divider variant="dashed" style={{ marginBottom: SPACE.md }} />
              <div
                style={{
                  padding: SPACE.md,
                  background: COLORS.bgDeep,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.sm,
                    marginBottom: SPACE.sm,
                  }}
                >
                  <Building2 size={13} strokeWidth={2} color={COLORS.textSecondary} />
                  <Mono tone="secondary" size="xs">
                    HOUSE STATUS
                  </Mono>
                </div>
                <HouseRow label="Med/Surg Beds">
                  {loginCount > 1 && !isSurgeActive ? (
                    <Mono tone="ok" size="xs">4 AVAIL</Mono>
                  ) : (
                    <Mono tone="crit" size="xs">0 AVAIL</Mono>
                  )}
                </HouseRow>
                <HouseRow label="ICU Beds">
                  {loginCount > 1 && !isSurgeActive ? (
                    <Mono tone="ok" size="xs">2 AVAIL</Mono>
                  ) : (
                    <Mono tone="warn" size="xs">1 AVAIL</Mono>
                  )}
                </HouseRow>
                <HouseRow label="Psych Hold" last>
                  <Mono tone="primary" size="xs">
                    {loginCount > 1 && !isSurgeActive ? '1 PT' : '4 PTS'}
                  </Mono>
                </HouseRow>
              </div>
            </div>
          </TacticalCard>
        </div>
      </div>

      {/* ══════════════════════════════ FULL-WIDTH OPERATIONS ROW ══════════════════════════════
          These were originally stacked inside the RIGHT column, but their
          combined height ran 800+px deeper than the LEFT column's chart
          stack — creating a huge negative-space void to the left of the
          census/alerts/pipeline widgets. Hoisting them out of the grid
          and laying them horizontally below the forecast returns to a
          standard HUD rhythm: wide-scan forecast up top, operations
          density below. (2026-04-17)                                       */}

      {/* Bed Board — compact dashboard tile (full-width; its mini bed grid
          flex-wraps naturally so extra horizontal room just spreads the
          per-unit rows rather than padding the chrome.) */}
      <BedBoard
        display="card"
        units={bedUnits}
        surgeActive={isSurgeActive}
        onExpand={() => setShowBedBoard(true)}
      />

      {/* 3-col operations row: Command Actions | Census & Throughput | Active Alerts.
          Equal 1fr columns — each card's internal density (4-col button
          grid, 3-tile KPI strip, vertical alert stack) is self-contained
          and balances visually at ~1/3 widths on desktop. */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: SPACE.md,
          alignItems: 'stretch',
        }}
      >
        {/* ── Operational Quick Actions ── */}
        <TacticalCard padding="md" style={{ padding: SPACE.lg, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
            <Zap size={16} strokeWidth={2} color={COLORS.textSecondary} />
            <Mono tone="primary" size="sm">Command Actions</Mono>
            <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${COLORS.border}, transparent)` }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gridAutoRows: 'min-content', gap: SPACE.sm, flex: 1, alignContent: 'start' }}>
            {[
              { label: 'Activate Surge', icon: <ShieldAlert size={16} />, color: COLORS.crit, onClick: () => showToast?.('Surge activation requires confirmation', 'info') },
              { label: 'Divert EMS', icon: <Ambulance size={16} />, color: COLORS.warn, onClick: () => showToast?.('Ambulance diversion toggled', 'info') },
              { label: 'Lock Unit', icon: <Building2 size={16} />, color: '#F97316', onClick: () => showToast?.('Select unit to lock/unlock', 'info') },
              { label: 'Page On-Call', icon: <Bell size={16} />, color: COLORS.info, onClick: () => showToast?.('Paging on-call team', 'info') },
              { label: 'Request Float', icon: <Users size={16} />, color: 'rgba(139,92,246,0.9)', onClick: () => onNavigateTab?.(Tab.STAFFING) },
              { label: 'EVS Stat', icon: <Wind size={16} />, color: COLORS.ok, onClick: () => showToast?.('EVS stat request sent', 'success') },
              { label: 'Capacity Alert', icon: <AlertTriangle size={16} />, color: COLORS.crit, onClick: () => onNavigateTab?.(Tab.ALERTS) },
              { label: 'Open Overflow', icon: <MapPin size={16} />, color: COLORS.warn, onClick: () => showToast?.('Overflow unit activation requires surge mode', 'info') },
            ].map((action) => (
              <div
                key={action.label}
                role="button"
                tabIndex={0}
                onClick={action.onClick}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && action.onClick()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.sm,
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  background: COLORS.bgDeep,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  cursor: 'pointer',
                  transition: cssTransition(),
                  minWidth: 0,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.borderHover; e.currentTarget.style.background = COLORS.surfaceElev; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.background = COLORS.bgDeep; }}
              >
                <span style={{ color: action.color, flexShrink: 0 }}>{action.icon}</span>
                <span style={{ fontFamily: FONTS.sans, fontSize: 14, fontWeight: 500, color: COLORS.textPrimary, letterSpacing: '-0.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {action.label}
                </span>
              </div>
            ))}
          </div>
        </TacticalCard>

        {/* ── Census & Throughput KPI Strip ──
            2026-04-17: tightened tile padding SPACE.md→SPACE.sm and hero
            fontSize 40→30 for the single-viewport pass. This was the
            tallest card in the 3-col ops row; trimming it lets the whole
            row settle ~50px shorter without reflowing its siblings. */}
        <TacticalCard padding="md" style={{ padding: SPACE.lg, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
            <Activity size={16} strokeWidth={2} color={COLORS.textSecondary} />
            <Mono tone="primary" size="sm">Census & Throughput</Mono>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, flex: 1 }}>
            {(() => {
              // When a scenario is running, metricValue() overlays baseline
              // with per-phase deltas. Baseline numbers (284 census, 45m ER,
              // 4.2 staff) are the MANAGER-calm case; scenarios push them up
              // through ramp→climb→peak, then relax on windDown→closing.
              const census = Math.round(metricValue('census', activeScenario));
              const erWait = Math.round(metricValue('erWaitMinutes', activeScenario));
              const staff = metricValue('staffingRatio', activeScenario);
              const censusDelta = census - 284; // vs baseline
              const calm = loginCount > 1 && !isSurgeActive && !activeScenario;
              const censusTone: 'ok' | 'warn' | 'crit' =
                calm ? 'ok' : censusDelta >= 25 ? 'crit' : censusDelta >= 10 ? 'warn' : 'ok';
              const erTone: 'ok' | 'warn' | 'crit' =
                calm ? 'ok' : erWait >= 90 ? 'crit' : erWait >= 60 ? 'warn' : 'ok';
              const staffTone: 'ok' | 'warn' | 'crit' =
                calm ? 'ok' : staff >= 5.5 ? 'crit' : staff >= 4.8 ? 'warn' : 'ok';
              const toneColor = (t: 'ok' | 'warn' | 'crit') =>
                t === 'crit' ? COLORS.crit : t === 'warn' ? COLORS.warn : COLORS.ok;
              const censusLabel = calm
                ? '▼ 14 FROM 6H AGO'
                : censusDelta === 0
                ? '● STEADY 6H'
                : censusDelta > 0
                ? `▲ ${censusDelta} FROM 6H AGO`
                : `▼ ${Math.abs(censusDelta)} FROM 6H AGO`;
              const erLabel = calm
                ? 'WITHIN TARGET'
                : erWait >= 90
                ? 'EXCEEDS THRESHOLD'
                : erWait >= 60
                ? 'NEAR THRESHOLD'
                : 'WITHIN TARGET';
              const staffLabel = calm
                ? 'OPTIMAL'
                : staff >= 5.5
                ? 'ABOVE SAFE LIMIT'
                : staff >= 4.8
                ? 'MONITOR'
                : 'OPTIMAL';
              return (
                <>
                  <div style={{ padding: SPACE.sm, background: COLORS.bgDeep, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, flex: 1 }}>
                    <Mono tone="muted" size="xs">TOTAL CENSUS</Mono>
                    <div style={{ fontFamily: FONTS.sans, fontSize: 30, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: COLORS.textPrimary, marginTop: 4 }}>
                      {census}
                    </div>
                    <Mono tone={censusTone} size="xs" style={{ marginTop: 4 }}>
                      {censusLabel}
                    </Mono>
                  </div>
                  <div style={{ padding: SPACE.sm, background: COLORS.bgDeep, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, flex: 1 }}>
                    <Mono tone="muted" size="xs">ER WAIT TIME</Mono>
                    <div style={{ fontFamily: FONTS.sans, fontSize: 30, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: toneColor(erTone), marginTop: 4 }}>
                      {erWait}m
                    </div>
                    <Mono tone={erTone} size="xs" style={{ marginTop: 4 }}>
                      {erLabel}
                    </Mono>
                  </div>
                  <div style={{ padding: SPACE.sm, background: COLORS.bgDeep, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm, flex: 1 }}>
                    <Mono tone="muted" size="xs">STAFF RATIO</Mono>
                    <div style={{ fontFamily: FONTS.sans, fontSize: 30, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: toneColor(staffTone), marginTop: 4 }}>
                      1:{staff.toFixed(1)}
                    </div>
                    <Mono tone={staffTone} size="xs" style={{ marginTop: 4 }}>
                      {staffLabel}
                    </Mono>
                  </div>
                </>
              );
            })()}
          </div>
        </TacticalCard>

        {/* ── Active Alerts Feed ── */}
        <TacticalCard padding="md" style={{ padding: SPACE.lg, display: 'flex', flexDirection: 'column' }}>
          {(() => {
            // Scenario-aware alert feed. Count is driven by metricValue
            // so it ticks with the phase. The list rotates copy by phase
            // so the feed feels like it's breathing, not stuck on mock.
            const alertCount = Math.round(metricValue('activeAlerts', activeScenario));
            const tone: 'ok' | 'warn' | 'crit' =
              alertCount >= 6 ? 'crit' : alertCount >= 3 ? 'warn' : 'ok';
            const label = `${alertCount} ACTIVE`;
            const sev = activeScenario?.severity;
            const phase = scenarioTick.phase;
            type Alert = { level: 'crit' | 'warn'; msg: string; time: string };
            const alerts: Alert[] = (() => {
              if (!activeScenario) {
                return [
                  { level: 'crit', msg: 'ICU bed capacity at 83% — 1 bed available', time: '2m ago' },
                  { level: 'warn', msg: 'ED wait time exceeds 90min threshold', time: '8m ago' },
                  { level: 'crit', msg: 'Nurse:patient ratio 1:6.1 in 2-West (target 1:4)', time: '15m ago' },
                  { level: 'warn', msg: 'EVS turnover backlog: 4 beds pending clean', time: '22m ago' },
                ];
              }
              if (sev === 1) {
                return [
                  { level: 'warn', msg: 'Routine EMS inbound — no activation', time: 'now' },
                  { level: 'warn', msg: 'Discharge lounge steady — 3 pending transport', time: '1m ago' },
                  { level: 'warn', msg: 'Staffing ratio within target across units', time: '2m ago' },
                  { level: 'warn', msg: 'Bed board: normal churn, no flags', time: '4m ago' },
                ];
              }
              if (sev === 2) {
                if (phase === 'ramp' || phase === 'climb') {
                  return [
                    { level: 'warn', msg: 'ER load climbing — 90% saturation crossed', time: 'now' },
                    { level: 'crit', msg: 'Trauma 2 inbound — crush injury, ETA 8m', time: '1m ago' },
                    { level: 'warn', msg: 'Float pool on standby — 2 RNs warming', time: '2m ago' },
                    { level: 'warn', msg: 'Admissions queue: 6 pending floor assignment', time: '3m ago' },
                  ];
                }
                if (phase === 'peak' || phase === 'hold') {
                  return [
                    { level: 'crit', msg: 'Boarding pressure sustained — 6 ER→floor holds', time: 'now' },
                    { level: 'crit', msg: 'Stroke inbound — CT suite pre-warmed', time: '1m ago' },
                    { level: 'warn', msg: 'Blood bank: O- down to 3 units', time: '2m ago' },
                    { level: 'warn', msg: 'Staffing gap Med-Surg 4W — charge covering', time: '4m ago' },
                  ];
                }
                return [
                  { level: 'warn', msg: 'Pressure easing — hold throughput steady', time: 'now' },
                  { level: 'warn', msg: '3 discharges clearing through 14:45', time: '1m ago' },
                  { level: 'warn', msg: 'EMS load returning to baseline', time: '2m ago' },
                  { level: 'warn', msg: 'NEDOCS trending down — monitor shift change', time: '3m ago' },
                ];
              }
              // Severity 3 — MCI
              if (phase === 'ramp' || phase === 'climb') {
                return [
                  { level: 'crit', msg: 'MASS CASUALTY INCIDENT — Surge Level 2 active', time: 'now' },
                  { level: 'crit', msg: 'Medic 41 inbound — penetrating trauma, ETA 4m', time: '1m ago' },
                  { level: 'crit', msg: 'Overflow Hall C opening — EVS dispatched', time: '2m ago' },
                  { level: 'warn', msg: 'Ambulance divert posted to regional grid', time: '3m ago' },
                ];
              }
              if (phase === 'peak' || phase === 'hold') {
                return [
                  { level: 'crit', msg: '3 ACTIVE CODES — trauma bays saturated', time: 'now' },
                  { level: 'crit', msg: 'MTP active — O- and FFP continuous release', time: '1m ago' },
                  { level: 'crit', msg: 'RN shortfall -4 FTE — call-back initiated', time: '2m ago' },
                  { level: 'warn', msg: 'St. Mary / County on divert — transfers held', time: '4m ago' },
                ];
              }
              return [
                { level: 'warn', msg: 'Peak passed — incident stabilizing', time: 'now' },
                { level: 'warn', msg: 'EMS offload easing — last bay freed', time: '1m ago' },
                { level: 'warn', msg: 'NEDOCS falling — MTP wind-down in progress', time: '2m ago' },
                { level: 'warn', msg: 'After-action review queued for 16:00', time: '3m ago' },
              ];
            })();
            return (
          <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
              <Bell size={16} strokeWidth={2} color={tone === 'crit' ? COLORS.crit : tone === 'warn' ? COLORS.warn : COLORS.ok} />
              <Mono tone="primary" size="sm">Active Alerts</Mono>
              <StatusPill label={label} tone={tone} pulse={tone !== 'ok'} />
            </div>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onNavigateTab?.(Tab.ALERTS)}
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}
            >
              <Mono tone="accent" size="xs">VIEW ALL</Mono>
              <ChevronRight size={12} color={COLORS.accent} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, flex: 1 }}>
            {alerts.map((alert, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: SPACE.md,
                padding: `${SPACE.sm}px ${SPACE.md}px`,
                background: alert.level === 'crit' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                border: `1px solid ${alert.level === 'crit' ? COLORS.crit : COLORS.warn}20`,
                borderLeft: `3px solid ${alert.level === 'crit' ? COLORS.crit : COLORS.warn}`,
                borderRadius: RADIUS.sm,
                flex: 1,
                minHeight: 0,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: RADIUS.full, flexShrink: 0,
                  background: alert.level === 'crit' ? COLORS.crit : COLORS.warn,
                  boxShadow: `0 0 6px ${alert.level === 'crit' ? COLORS.crit : COLORS.warn}`,
                }} />
                <span style={{ flex: 1, fontFamily: FONTS.sans, fontSize: 13, color: COLORS.textPrimary, minWidth: 0 }}>
                  {alert.msg}
                </span>
                <Mono tone="muted" size="xs" style={{ flexShrink: 0 }}>{alert.time}</Mono>
              </div>
            ))}
          </div>
          </>
            );
          })()}
        </TacticalCard>
      </div>

      {/* Patient Flow Pipeline removed 2026-04-17: its 5 stage counts
          (WAITING / IN ED / BOARDING / ADMITTED / DC READY) duplicated
          signal already surfaced by Census & Throughput (wait time,
          total census), Bed Board (availability), and Active Alerts
          (boarding threshold, ED wait ≥ 90m). Horizon is the forecast
          tab; current-state ED throughput belongs on an Operations tab
          if we add one. Strip had also become the consistent overflow
          offender at the bottom of the viewport. See docs/decisions.md. */}

      {/* Bed Board fullscreen overlay */}
      <BedBoard
        display="full"
        units={bedUnits}
        surgeActive={isSurgeActive}
        open={showBedBoard}
        onClose={() => setShowBedBoard(false)}
        role={currentUser.role}
      />

      {/* Admit Flow fullscreen overlay */}
      <AdmitFlow
        open={showAdmitFlow}
        onClose={() => setShowAdmitFlow(false)}
        showToast={(msg: string) => showToast?.(msg, 'success')}
      />

      {/* Discharge Flow fullscreen overlay */}
      <DischargeFlow
        open={showDischargeFlow}
        onClose={() => setShowDischargeFlow(false)}
        showToast={(msg: string) => showToast?.(msg, 'success')}
      />

      {/* Rounding List fullscreen overlay */}
      <RoundingList
        open={showRoundingList}
        onClose={() => setShowRoundingList(false)}
        showToast={(msg: string) => showToast?.(msg, 'info')}
        role={currentUser.role}
      />

      {/* Note Composer overlay */}
      <NoteComposer
        open={showNoteComposer}
        onClose={() => setShowNoteComposer(false)}
        showToast={(msg: string) => showToast?.(msg, 'success')}
      />

      {/* Order Entry (CPOE) overlay */}
      <OrderEntry
        open={showOrderEntry}
        onClose={() => setShowOrderEntry(false)}
        showToast={(msg: string) => showToast?.(msg, 'success')}
      />

      {/* Code Blue overlay */}
      <CodeBlueScreen
        open={showCodeBlue}
        onClose={() => setShowCodeBlue(false)}
        showToast={(msg: string) => showToast?.(msg, 'error')}
        location="ICU-3"
      />

      {/* Handoff Composer overlay */}
      <HandoffComposer
        open={showHandoff}
        onClose={() => setShowHandoff(false)}
        showToast={(msg: string) => showToast?.(msg, 'success')}
      />

      {/* Secure Messaging overlay */}
      <SecureMessaging
        open={showMessaging}
        onClose={() => setShowMessaging(false)}
        showToast={(msg: string) => showToast?.(msg, 'info')}
      />

      {/* Workforce Coverage overlay */}
      <WorkforceCoverage
        open={showWorkforce}
        onClose={() => setShowWorkforce(false)}
        showToast={(msg: string) => showToast?.(msg, 'info')}
        role={currentUser.role}
      />

      {/* Alerts Center overlay */}
      <AlertsCenter
        open={showAlerts}
        onClose={() => setShowAlerts(false)}
        showToast={(msg: string) => showToast?.(msg, 'info')}
        role={currentUser.role}
      />

      {/* Dept Coordination overlay */}
      <DeptCoordination
        open={showDeptCoord}
        onClose={() => setShowDeptCoord(false)}
        showToast={(msg: string) => showToast?.(msg, 'info')}
      />

      {/* Brief Me overlay */}
      <BriefMeScreen
        open={showBriefMe}
        onClose={() => setShowBriefMe(false)}
        showToast={(msg: string) => showToast?.(msg, 'info')}
      />

      {/* ── Manual Mode Modal ── */}
      <AnimatePresence>
        {showManualModal && (
          <motion.div
            key="manual-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(6px)',
              padding: SPACE.lg,
            }}
            onClick={() => setShowManualModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: MOTION.base, ease: MOTION.ease }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 440, width: '100%' }}
            >
              <TacticalCard
                padding="md"
                style={{
                  padding: SPACE.xl,
                  borderColor: COLORS.warn,
                  boxShadow: `0 16px 48px rgba(0,0,0,0.8), 0 0 24px ${COLORS.warn}33`,
                }}
              >
                <BracketFrame color={COLORS.warn} />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.sm,
                    marginBottom: SPACE.md,
                  }}
                >
                  <AlertTriangle size={16} strokeWidth={2} color={COLORS.warn} />
                  <Mono tone="warn" size="sm">
                    [ EHR CONNECTION UNSTABLE ]
                  </Mono>
                </div>
                <p
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 15,
                    lineHeight: 1.6,
                    color: COLORS.textSecondary,
                    marginBottom: SPACE.lg,
                  }}
                >
                  The HL7 feed from the EHR has not sent an update in 14 minutes.
                  Predictive models may be inaccurate. Switch to Manual Override
                  to update census and bed states directly.
                </p>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: SPACE.sm,
                  }}
                >
                  <TacticalButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowManualModal(false)}
                  >
                    Cancel
                  </TacticalButton>
                  <TacticalButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      handleSwitchToManual();
                      if (showToast) showToast('Switched to Manual Override Mode', 'error');
                    }}
                  >
                    Switch to Manual
                  </TacticalButton>
                </div>
              </TacticalCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Driver Details Modal ── */}
      <AnimatePresence>
        {selectedDriverDetails && (
          <motion.div
            key="driver-modal"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 50,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(0,0,0,0.8)',
              backdropFilter: 'blur(6px)',
              padding: SPACE.lg,
            }}
            onClick={() => setSelectedDriverDetails(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: MOTION.base, ease: MOTION.ease }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 680, width: '100%' }}
            >
              <TacticalCard
                padding="none"
                style={{
                  boxShadow: SHADOW.modal,
                  borderColor: statusToColor(selectedDriverDetails.status),
                }}
              >
                <BracketFrame color={statusToColor(selectedDriverDetails.status)} />
                {/* Header */}
                <div
                  style={{
                    padding: SPACE.xl,
                    borderBottom: `1px solid ${COLORS.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: SPACE.md,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.sm,
                        marginBottom: SPACE.xs,
                      }}
                    >
                      <StatusPill
                        label={selectedDriverDetails.status.toUpperCase()}
                        tone={statusToTone(selectedDriverDetails.status)}
                        pulse={selectedDriverDetails.status === Status.CRITICAL}
                      />
                      <Mono tone="muted" size="xs">
                        // DRIVER.DETAIL
                      </Mono>
                    </div>
                    <h2
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: TYPE.h2.size,
                        fontWeight: TYPE.h2.weight,
                        letterSpacing: TYPE.h2.tracking,
                        color: COLORS.textPrimary,
                        margin: 0,
                        marginBottom: SPACE.xs,
                      }}
                    >
                      {selectedDriverDetails.name}
                    </h2>
                    <div
                      style={{
                        display: 'flex',
                        gap: SPACE.lg,
                      }}
                    >
                      <div>
                        <Mono tone="muted" size="xs">
                          CURRENT
                        </Mono>
                        <div
                          style={{
                            fontFamily: FONTS.mono,
                            fontSize: 15,
                            color: COLORS.textPrimary,
                            fontWeight: 600,
                            marginTop: 2,
                          }}
                        >
                          {selectedDriverDetails.value}
                        </div>
                      </div>
                      <div>
                        <Mono tone="muted" size="xs">
                          IMPACT
                        </Mono>
                        <div
                          style={{
                            fontFamily: FONTS.mono,
                            fontSize: 15,
                            color: statusToColor(selectedDriverDetails.status),
                            fontWeight: 600,
                            marginTop: 2,
                          }}
                        >
                          {selectedDriverDetails.impact}%
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDriverDetails(null)}
                    aria-label="Close"
                    style={{
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      color: COLORS.textMuted,
                      cursor: 'pointer',
                    }}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </div>

                {/* Body */}
                <div
                  style={{
                    padding: SPACE.xl,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.lg,
                  }}
                >
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: SPACE.md,
                    }}
                  >
                    <div
                      style={{
                        padding: SPACE.md,
                        background: COLORS.bgDeep,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.sm, display: 'block' }}>
                        [ ROOT CAUSES ]
                      </Mono>
                      <ul
                        style={{
                          listStyle: 'none',
                          padding: 0,
                          margin: 0,
                          fontFamily: FONTS.sans,
                          fontSize: 14,
                          color: COLORS.textSecondary,
                          lineHeight: 1.6,
                        }}
                      >
                        <li style={{ paddingLeft: 12, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 0, color: COLORS.textMuted }}>›</span>
                          High influx of trauma patients (last 2h)
                        </li>
                        <li style={{ paddingLeft: 12, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 0, color: COLORS.textMuted }}>›</span>
                          Delayed discharges from Med/Surg
                        </li>
                        <li style={{ paddingLeft: 12, position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 0, color: COLORS.textMuted }}>›</span>
                          Staffing shortage in Triage
                        </li>
                      </ul>
                    </div>
                    <div
                      style={{
                        padding: SPACE.md,
                        background: COLORS.bgDeep,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.sm, display: 'block' }}>
                        [ PREDICTED TRAJECTORY ]
                      </Mono>
                      <p
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 14,
                          color: COLORS.textSecondary,
                          lineHeight: 1.6,
                          margin: 0,
                        }}
                      >
                        Without intervention, metric is expected to worsen by{' '}
                        <span style={{ color: COLORS.crit, fontWeight: 600 }}>+15%</span> in
                        the next 45 minutes.
                      </p>
                    </div>
                  </div>

                  <div>
                    <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.sm, display: 'block' }}>
                      [ RECOMMENDED ACTIONS ]
                    </Mono>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                      {[
                        'Deploy float pool nurse to Triage',
                        'Escalate pending discharges to Attending',
                      ].map((action) => (
                        <div
                          key={action}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: SPACE.sm,
                            background: COLORS.bgDeep,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: RADIUS.sm,
                            gap: SPACE.md,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                            <CheckCircle2 size={12} strokeWidth={2} color={COLORS.ok} />
                            <span
                              style={{
                                fontFamily: FONTS.sans,
                                fontSize: 14,
                                color: COLORS.textPrimary,
                                letterSpacing: '-0.005em',
                              }}
                            >
                              {action}
                            </span>
                          </div>
                          <TacticalButton variant="primary" size="sm">
                            Execute
                          </TacticalButton>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div
                  style={{
                    padding: SPACE.md,
                    borderTop: `1px solid ${COLORS.border}`,
                    background: COLORS.bgDeep,
                    display: 'flex',
                    justifyContent: 'flex-end',
                  }}
                >
                  <TacticalButton
                    variant="secondary"
                    size="sm"
                    onClick={() => setSelectedDriverDetails(null)}
                  >
                    Dismiss
                  </TacticalButton>
                </div>
              </TacticalCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>
        {`
          .pulse-horizon-drivers::-webkit-scrollbar { width: 4px; }
          .pulse-horizon-drivers::-webkit-scrollbar-track { background: transparent; }
          .pulse-horizon-drivers::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 2px; }
          .pulse-horizon-drivers::-webkit-scrollbar-thumb:hover { background: ${COLORS.borderStrong}; }
        `}
      </style>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// KpiCell — single cell of the chart footer KPI band
// ─────────────────────────────────────────────────────────────────────────
const KpiCell: React.FC<{
  label: string;
  value: string;
  tone: 'primary' | 'ok' | 'warn' | 'crit';
  icon?: React.ReactNode;
  isLast?: boolean;
}> = ({ label, value, tone, icon, isLast }) => {
  const color =
    tone === 'ok'
      ? COLORS.ok
      : tone === 'warn'
      ? COLORS.warn
      : tone === 'crit'
      ? COLORS.crit
      : COLORS.textPrimary;
  return (
    <div
      style={{
        padding: `${SPACE.md}px ${SPACE.lg}px`,
        borderRight: isLast ? undefined : `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <Mono tone="muted" size="xs">
        {label}
      </Mono>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {icon}
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: '0.02em',
            color,
            lineHeight: 1,
          }}
        >
          {value}
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// LeverSlider — stepper + segmented bar used inside the simulator
//
// 2026-04-17 · Rewritten from native <input type="range">. The native
// range input was effectively broken in the Capacitor iOS WebView — the
// thumb wasn't visible on the dark surface and touch drags often failed
// to register. Replaced with a ± stepper + segmented fill bar:
//   - Tap targets are real 44px buttons (iOS HIG minimum)
//   - Segmented fill shows position discretely, legible at a glance
//   - No drag gestures — works on every input surface
// ─────────────────────────────────────────────────────────────────────────
const LeverSlider: React.FC<{
  label: string;
  unit: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ label, unit, value, max, onChange }) => {
  const clamp = (v: number) => Math.max(0, Math.min(max, v));
  const dec = () => onChange(clamp(value - 1));
  const inc = () => onChange(clamp(value + 1));

  // Segmented fill — one cell per step so the active count is readable.
  const segments = Array.from({ length: max }, (_, i) => i < value);

  const stepBtn: React.CSSProperties = {
    appearance: 'none',
    WebkitAppearance: 'none',
    background: COLORS.surfaceHover,
    border: `1px solid ${COLORS.borderStrong}`,
    borderRadius: RADIUS.sm,
    color: COLORS.textSecondary,
    cursor: 'pointer',
    width: 44,
    height: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    touchAction: 'manipulation',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    WebkitTapHighlightColor: 'transparent',
    transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: SPACE.sm,
        }}
      >
        <Mono tone="secondary" size="xs">
          {label}
        </Mono>
        <Mono tone={value > 0 ? 'info' : 'muted'} size="xs">
          + {value} {unit}
        </Mono>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
        <button
          type="button"
          onClick={dec}
          disabled={value === 0}
          aria-label={`Decrease ${label}`}
          style={{
            ...stepBtn,
            opacity: value === 0 ? 0.35 : 1,
            cursor: value === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <Minus size={15} strokeWidth={2.5} />
        </button>
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${max}, minmax(0, 1fr))`,
            gap: 3,
            height: 12,
          }}
        >
          {segments.map((active, i) => (
            <div
              key={i}
              style={{
                background: active ? COLORS.accent : COLORS.borderStrong,
                boxShadow: active ? `0 0 8px ${COLORS.accentGlow}` : undefined,
                borderRadius: 1,
                transition: `background ${MOTION.fast}s ease`,
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={inc}
          disabled={value === max}
          aria-label={`Increase ${label}`}
          style={{
            ...stepBtn,
            opacity: value === max ? 0.35 : 1,
            cursor: value === max ? 'not-allowed' : 'pointer',
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// HouseRow — two-column row inside the house status panel
// ─────────────────────────────────────────────────────────────────────────
const HouseRow: React.FC<{
  label: string;
  children: React.ReactNode;
  last?: boolean;
}> = ({ label, children, last }) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingBottom: last ? 0 : 4,
      marginBottom: last ? 0 : 4,
      borderBottom: last ? undefined : `1px dashed ${COLORS.border}`,
    }}
  >
    <span
      style={{
        fontFamily: FONTS.sans,
        fontSize: 14,
        color: COLORS.textSecondary,
        letterSpacing: '-0.005em',
      }}
    >
      {label}
    </span>
    {children}
  </div>
);
