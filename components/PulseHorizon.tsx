import React, { useState, useMemo, useEffect } from 'react';
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
} from 'lucide-react';
import { Status, Tab, UserProfile, UserRole } from '../types';
import { ROLE_METRICS } from '../data/userProfiles';
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
import { seedBedState, escalateBedState, deescalateBedState, type BedUnit } from '../data/bedMock';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
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
}) => {
  const [simState, setSimState] = useState({
    addedStaff: 0,
    openBeds: 0,
    expeditedDischarges: 0,
  });
  const [isSimulating, setIsSimulating] = useState(false);
  const [showManualModal, setShowManualModal] = useState(false);
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);
  const [selectedDriverDetails, setSelectedDriverDetails] = useState<SelectedDriver | null>(null);
  const [bedUnits, setBedUnits] = useState<BedUnit[]>(() => seedBedState());
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
    const baseDrivers = ROLE_METRICS[currentUser.role];
    if (loginCount > 1) {
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
  }, [currentUser.role, loginCount]);

  const chartData = useMemo(() => {
    let baseLoad = { now: 92, plus30: 98, plus60: 105, plus90: 112 };
    if (isSurgeActive) {
      baseLoad = { now: 32, plus30: 30, plus60: 28, plus90: 25 };
    } else if (loginCount > 1) {
      baseLoad = { now: 32, plus30: 34, plus60: 35, plus90: 38 };
    }
    const staffImpact = simState.addedStaff * 2.5;
    const bedImpact = simState.openBeds * 1.5;
    const dischargeImpact = simState.expeditedDischarges * 3.0;
    const totalReduction = staffImpact + bedImpact + dischargeImpact;
    const r30 = totalReduction * 0.3;
    const r60 = totalReduction * 0.7;
    const r90 = totalReduction * 1.0;

    return [
      { time: '-30m', load: isSurgeActive ? 85 : loginCount > 1 ? 32 : 85, capacity: 100 },
      { time: 'NOW', load: systemStatus === 'manual' ? 85 : baseLoad.now, capacity: 100 },
      { time: '+30m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus30 - r30), capacity: 100 },
      { time: '+60m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus60 - r60), capacity: 100 },
      { time: '+90m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus90 - r90), capacity: 100 },
    ];
  }, [simState, isSurgeActive, systemStatus, loginCount]);

  // Bed state reacts to surge activation
  useEffect(() => {
    setBedUnits(isSurgeActive ? escalateBedState(seedBedState()) : deescalateBedState());
  }, [isSurgeActive]);

  const currentLoad = chartData[1].load;
  const projectedLoad = chartData[4].load;
  const isSafe = projectedLoad < 100;
  const delta = projectedLoad - currentLoad;
  const isRising = delta > 0;

  // NEDOCS-style severity classification for the forecast number
  const forecastTone: 'ok' | 'warn' | 'crit' =
    projectedLoad >= 100 ? 'crit' : projectedLoad >= 85 ? 'warn' : 'ok';

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
        padding: SPACE['3xl'],
        fontFamily: FONTS.sans,
        color: COLORS.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.xl,
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
                : isSafe
                ? 'NOMINAL'
                : 'CRITICAL'
            }
            tone={
              systemStatus === 'manual'
                ? 'crit'
                : systemStatus === 'stale'
                ? 'warn'
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
          alignItems: 'start',
        }}
      >
        {/* ══════════════════════════════ LEFT COLUMN ══════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xl, minWidth: 0 }}>
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

            {/* Chart */}
            <div
              style={{
                position: 'relative',
                height: 340,
                padding: SPACE.md,
                overflow: 'hidden',
              }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 16, right: 20, left: -8, bottom: 8 }}>
                  <defs>
                    <linearGradient id="horizonFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.info} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={COLORS.info} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="horizonFillSim" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.info} stopOpacity={0.25} />
                      <stop offset="95%" stopColor={COLORS.info} stopOpacity={0} />
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
                    itemStyle={{ color: COLORS.info }}
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
                    stroke={COLORS.info}
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
                      stroke={COLORS.info}
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
                  minHeight: 260,
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
                    {isSurgeActive ? (
                      <CheckCircle2 size={14} strokeWidth={2} color={COLORS.ok} />
                    ) : loginCount > 1 ? (
                      <CheckCircle2 size={14} strokeWidth={2} color={COLORS.textMuted} />
                    ) : (
                      <ShieldAlert size={14} strokeWidth={2} color={COLORS.accent} />
                    )}
                    <Mono
                      tone={isSurgeActive ? 'ok' : loginCount > 1 ? 'muted' : 'accent'}
                      size="sm"
                    >
                      [{' '}
                      {isSurgeActive
                        ? 'PROTOCOL ACTIVE'
                        : loginCount > 1
                        ? 'NO ACTION REQ'
                        : 'INTERVENTION REQ'}{' '}
                      ]
                    </Mono>
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
                    {isSurgeActive
                      ? 'Surge Level 2 active. Census 312 (+28). Float pool deployed. Overflow Hall C open — 2 occupied, 2 ready. ER wait 125m, divert recommended. 3 active codes. Risk trajectory stabilizing — monitor fast-track throughput.'
                      : loginCount > 1
                      ? 'Capacity is stable. Census 284, ER wait 45m. ICU at 83%. Staffing ratio 1:4.2 — optimal. No surge protocols required.'
                      : 'Forecast exceeds safety thresholds. Census trending +28 over 2h. Activate Surge Protocol Level 2 immediately.'}
                  </p>
                </div>
                {!isSurgeActive && loginCount <= 1 && (
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
                )}
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
            gap: SPACE.xl,
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
                {loginCount > 1 && !isSurgeActive ? '2' : '8'}
              </span>
              <Mono tone="muted" size="xs">
                TOTAL EN ROUTE
              </Mono>
            </div>
            {/* Progress rail */}
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
                animate={{ width: loginCount > 1 && !isSurgeActive ? '10%' : '40%' }}
                transition={{ duration: MOTION.slow, ease: MOTION.ease }}
                style={{
                  height: '100%',
                  background:
                    loginCount > 1 && !isSurgeActive ? COLORS.ok : COLORS.accent,
                  boxShadow: `0 0 8px ${
                    loginCount > 1 && !isSurgeActive ? COLORS.ok : COLORS.accent
                  }`,
                }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {loginCount > 1 && !isSurgeActive ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <CheckCircle2 size={13} strokeWidth={2} color={COLORS.ok} />
                    <Mono tone="ok" size="xs">
                      0 CRIT
                    </Mono>
                  </div>
                  <Mono tone="muted" size="xs">
                    2 STABLE
                  </Mono>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldAlert size={13} strokeWidth={2} color={COLORS.accent} />
                    <Mono tone="accent" size="xs">
                      3 CRIT {'<'} 5M
                    </Mono>
                  </div>
                  <Mono tone="muted" size="xs">
                    5 STABLE
                  </Mono>
                </>
              )}
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

          {/* Bed Board — compact dashboard tile */}
          <BedBoard
            display="card"
            units={bedUnits}
            surgeActive={isSurgeActive}
            onExpand={() => setShowBedBoard(true)}
          />

          {/* ── Clinical Quick Actions ── */}
          <TacticalCard padding="md" style={{ padding: SPACE.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
              <Zap size={16} strokeWidth={2} color={COLORS.textSecondary} />
              <Mono tone="primary" size="sm">Quick Actions</Mono>
              <div style={{ flex: 1, height: 1, background: `linear-gradient(90deg, ${COLORS.border}, transparent)` }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: SPACE.sm }}>
              {[
                { label: 'Admit', icon: <UserPlus size={16} />, color: COLORS.ok, onClick: () => onNavigateTab?.(Tab.ADMISSIONS) || setShowAdmitFlow(true) },
                { label: 'Discharge', icon: <DoorOpen size={16} />, color: COLORS.warn, onClick: () => onNavigateTab?.(Tab.PATIENTS) || setShowDischargeFlow(true) },
                { label: 'Rounding', icon: <ClipboardList size={16} />, color: 'rgba(139,92,246,0.9)', onClick: () => onNavigateTab?.(Tab.PATIENTS) || setShowRoundingList(true) },
                { label: 'Notes', icon: <FileText size={16} />, color: COLORS.info, onClick: () => onNavigateTab?.(Tab.PATIENTS) || setShowNoteComposer(true) },
                { label: 'Orders', icon: <Pill size={16} />, color: COLORS.ok, onClick: () => onNavigateTab?.(Tab.PATIENTS) || setShowOrderEntry(true) },
                { label: 'Code Blue', icon: <Siren size={16} />, color: COLORS.crit, onClick: () => onNavigateTab?.(Tab.PATIENTS) || setShowCodeBlue(true) },
                { label: 'Handoff', icon: <ArrowRightLeft size={16} />, color: 'rgba(139,92,246,0.9)', onClick: () => onNavigateTab?.(Tab.PATIENTS) || setShowHandoff(true) },
                { label: 'Comms', icon: <MessageSquare size={16} />, color: COLORS.info, onClick: () => setShowMessaging(true) },
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
                    transition: `all ${MOTION.fast}s ease`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = COLORS.borderHover; e.currentTarget.style.background = COLORS.surfaceElev; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.background = COLORS.bgDeep; }}
                >
                  <span style={{ color: action.color, flexShrink: 0 }}>{action.icon}</span>
                  <span style={{ fontFamily: FONTS.sans, fontSize: 14, fontWeight: 500, color: COLORS.textPrimary, letterSpacing: '-0.005em' }}>
                    {action.label}
                  </span>
                </div>
              ))}
            </div>
          </TacticalCard>

          {/* ── Census & Throughput KPI Strip ── */}
          <TacticalCard padding="md" style={{ padding: SPACE.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
              <Activity size={16} strokeWidth={2} color={COLORS.textSecondary} />
              <Mono tone="primary" size="sm">Census & Throughput</Mono>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: SPACE.md }}>
              <div style={{ padding: SPACE.md, background: COLORS.bgDeep, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm }}>
                <Mono tone="muted" size="xs">TOTAL CENSUS</Mono>
                <div style={{ fontFamily: FONTS.sans, fontSize: 36, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: COLORS.textPrimary, marginTop: 4 }}>
                  {loginCount > 1 && !isSurgeActive ? '284' : isSurgeActive ? '312' : '298'}
                </div>
                <Mono tone={loginCount > 1 && !isSurgeActive ? 'ok' : 'warn'} size="xs" style={{ marginTop: 4 }}>
                  {loginCount > 1 && !isSurgeActive ? '▼ 14 FROM 6H AGO' : isSurgeActive ? '▲ 28 FROM 6H AGO' : '▲ 12 FROM 6H AGO'}
                </Mono>
              </div>
              <div style={{ padding: SPACE.md, background: COLORS.bgDeep, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm }}>
                <Mono tone="muted" size="xs">ER WAIT TIME</Mono>
                <div style={{ fontFamily: FONTS.sans, fontSize: 36, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: loginCount > 1 && !isSurgeActive ? COLORS.ok : COLORS.crit, marginTop: 4 }}>
                  {loginCount > 1 && !isSurgeActive ? '45m' : isSurgeActive ? '125m' : '98m'}
                </div>
                <Mono tone={loginCount > 1 && !isSurgeActive ? 'ok' : 'crit'} size="xs" style={{ marginTop: 4 }}>
                  {loginCount > 1 && !isSurgeActive ? 'WITHIN TARGET' : 'EXCEEDS THRESHOLD'}
                </Mono>
              </div>
              <div style={{ padding: SPACE.md, background: COLORS.bgDeep, border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.sm }}>
                <Mono tone="muted" size="xs">STAFF RATIO</Mono>
                <div style={{ fontFamily: FONTS.sans, fontSize: 36, fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 1, color: loginCount > 1 && !isSurgeActive ? COLORS.ok : COLORS.warn, marginTop: 4 }}>
                  {loginCount > 1 && !isSurgeActive ? '1:4.2' : isSurgeActive ? '1:6.1' : '1:5.3'}
                </div>
                <Mono tone={loginCount > 1 && !isSurgeActive ? 'ok' : 'warn'} size="xs" style={{ marginTop: 4 }}>
                  {loginCount > 1 && !isSurgeActive ? 'OPTIMAL' : isSurgeActive ? 'ABOVE SAFE LIMIT' : 'MONITOR'}
                </Mono>
              </div>
            </div>
          </TacticalCard>

          {/* ── Active Admissions & Discharges Snapshot ── */}
          <TacticalCard padding="md" style={{ padding: SPACE.lg }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.md }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <UserPlus size={16} strokeWidth={2} color={COLORS.textSecondary} />
                <Mono tone="primary" size="sm">Admissions & Discharges</Mono>
              </div>
              <Mono tone="muted" size="xs">LAST 4 HOURS</Mono>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.md }}>
              <div style={{ padding: SPACE.md, background: COLORS.bgDeep, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.ok}`, borderRadius: RADIUS.sm }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Mono tone="ok" size="sm">ADMITTED</Mono>
                  <span style={{ fontFamily: FONTS.sans, fontSize: 28, fontWeight: 600, color: COLORS.ok }}>
                    {loginCount > 1 && !isSurgeActive ? '4' : isSurgeActive ? '11' : '7'}
                  </span>
                </div>
                <Mono tone="muted" size="xs" style={{ marginTop: 4 }}>
                  {loginCount > 1 && !isSurgeActive ? '2 pending placement' : isSurgeActive ? '6 pending placement' : '3 pending placement'}
                </Mono>
              </div>
              <div style={{ padding: SPACE.md, background: COLORS.bgDeep, border: `1px solid ${COLORS.border}`, borderLeft: `3px solid ${COLORS.warn}`, borderRadius: RADIUS.sm }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Mono tone="warn" size="sm">DISCHARGED</Mono>
                  <span style={{ fontFamily: FONTS.sans, fontSize: 28, fontWeight: 600, color: COLORS.warn }}>
                    {loginCount > 1 && !isSurgeActive ? '6' : isSurgeActive ? '3' : '4'}
                  </span>
                </div>
                <Mono tone="muted" size="xs" style={{ marginTop: 4 }}>
                  {loginCount > 1 && !isSurgeActive ? '2 awaiting transport' : isSurgeActive ? '5 awaiting transport' : '3 awaiting transport'}
                </Mono>
              </div>
            </div>
          </TacticalCard>
        </div>
      </div>

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
// LeverSlider — mono-labeled range input used inside the simulator
// ─────────────────────────────────────────────────────────────────────────
const LeverSlider: React.FC<{
  label: string;
  unit: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
}> = ({ label, unit, value, max, onChange }) => (
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
      <Mono tone="info" size="xs">
        + {value} {unit}
      </Mono>
    </div>
    <input
      type="range"
      min={0}
      max={max}
      step={1}
      value={value}
      onChange={(e) => onChange(parseInt(e.target.value))}
      style={{
        width: '100%',
        accentColor: COLORS.accent,
        cursor: 'pointer',
      }}
    />
  </div>
);

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
