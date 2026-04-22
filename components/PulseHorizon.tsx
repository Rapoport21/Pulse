import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ReferenceArea,
  AreaChart,
  Area,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  CheckCircle2,
  Zap,
  ArrowRight,
  Sliders,
  Wind,
  AlertTriangle,
  X,
  ChevronRight,
  Minus,
  Plus,
} from 'lucide-react';
import { Status, UserProfile, UserRole } from '../types';
import { ROLE_METRICS } from '../data/userProfiles';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  cssTransition,
  SHADOW,
  StatusPill,
  TacticalCard,
  TacticalButton,
  Divider,
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
 *
 * 2026-04-22 de-AI pass: distill → quieter → typeset → delight.
 * Cut: regional network, bed-board tile, 8-button command grid, census
 *      strip, alerts feed, inbound EMS card, nested house status panel,
 *      all "//" comment microcopy, most [ BRACKET ] labels.
 * Kept: hero forecast number, chart with breach wash, what-if simulator,
 *      pressure drivers, role-scoped copy, stale/manual banners.
 * New: hero number is the one loud thing on the page; chart dramatizes
 *      breach via a red reference-area wash; recommendation copy is
 *      hand-written in second person rather than templated.
 */
export const PulseHorizon: React.FC<PulseHorizonProps> = ({
  onActivatePlaybook,
  isSurgeActive,
  currentUser,
  systemStatus = 'normal',
  setSystemStatus,
  showToast,
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
      { time: 'now', load: systemStatus === 'manual' ? 85 : baseLoad.now, capacity: 100 },
      { time: '+30m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus30 - r30), capacity: 100 },
      { time: '+60m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus60 - r60), capacity: 100 },
      { time: '+90m', load: systemStatus === 'manual' ? 85 : Math.max(0, baseLoad.plus90 - r90), capacity: 100 },
    ];
  }, [simState, isSurgeActive, systemStatus, loginCount]);

  const currentLoad = chartData[1].load;
  const projectedLoad = chartData[4].load;
  const isSafe = projectedLoad < 100;
  const delta = projectedLoad - currentLoad;
  const isRising = delta > 0;

  // NEDOCS-style severity classification for the forecast number
  const forecastTone: 'ok' | 'warn' | 'crit' =
    projectedLoad >= 100 ? 'crit' : projectedLoad >= 85 ? 'warn' : 'ok';
  const forecastColor =
    forecastTone === 'crit' ? COLORS.crit : forecastTone === 'warn' ? COLORS.warn : COLORS.textPrimary;

  const getDriverTitle = () => {
    switch (currentUser.role) {
      case UserRole.NURSE:
        return 'My patient alerts';
      case UserRole.ER_PERSONNEL:
        return 'Trauma & triage';
      default:
        return 'Pressure drivers';
    }
  };

  const needsIntervention = !isSafe && systemStatus === 'normal' && !isSurgeActive && loginCount <= 1;

  const handleSwitchToManual = () => {
    if (setSystemStatus) setSystemStatus('manual');
    setShowManualModal(false);
  };

  // Recommendation copy — hand-written per state. These are the single most
  // visible user-facing strings on the page and the single biggest AI-tell
  // when templated. Keep them second-person, specific, short.
  const recommendation = isSurgeActive
    ? 'Surge 2 holding. Census 312, up 28. Overflow Hall C is open — 2 beds ready. ER wait 125 min, diverting. 3 codes active. Trajectory stabilizing — watch fast-track.'
    : loginCount > 1
    ? 'Stable. Census 284, ER wait 45 min. ICU at 83%. Staffing 1:4.2.'
    : 'You’re over capacity in about 90 minutes. Census is up 28 since rounds. Surge Level 2 is the call.';

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        background: COLORS.bg,
        padding: SPACE.md,
        fontFamily: FONTS.sans,
        color: COLORS.textPrimary,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.md,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: SPACE.lg,
          paddingBottom: SPACE.sm,
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: FONTS.sans,
              fontSize: TYPE.h2.size,
              fontWeight: TYPE.h2.weight,
              letterSpacing: TYPE.h2.tracking,
              color: COLORS.textPrimary,
              margin: 0,
              lineHeight: 1.1,
            }}
          >
            Capacity horizon
          </h1>
          <div
            style={{
              marginTop: 4,
              fontFamily: FONTS.sans,
              fontSize: 13,
              fontWeight: 400,
              color: COLORS.textMuted,
              letterSpacing: '-0.003em',
            }}
          >
            Four hours out · {currentUser.role.replace('_', ' ').toLowerCase()} view
            {isSimulating && <span style={{ color: COLORS.info, marginLeft: 8 }}>· simulating</span>}
          </div>
        </div>
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
      </header>

      {/* ── Banners (stale / manual) ───────────────────────────────────── */}
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
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 14,
                        fontWeight: 500,
                        color: COLORS.warn,
                        letterSpacing: '-0.005em',
                      }}
                    >
                      EHR sync is 14 minutes behind
                    </div>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 13,
                        color: COLORS.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      Forecast may be off. Switch to manual to enter census directly.
                    </div>
                  </div>
                </div>
                <TacticalButton variant="secondary" size="sm">
                  Switch to manual
                </TacticalButton>
              </div>
            </TacticalCard>
          </motion.div>
        )}

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
              style={{ borderColor: COLORS.accent }}
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
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 14,
                        fontWeight: 500,
                        color: COLORS.accent,
                        letterSpacing: '-0.005em',
                      }}
                    >
                      Manual override — forecast paused
                    </div>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 13,
                        color: COLORS.textSecondary,
                        marginTop: 2,
                      }}
                    >
                      Reading your inputs, not the EHR.
                    </div>
                  </div>
                </div>
                <TacticalButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (setSystemStatus) setSystemStatus('normal');
                    if (showToast) showToast('EHR sync restored.', 'success');
                  }}
                >
                  Restore EHR
                </TacticalButton>
              </div>
            </TacticalCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main forecast module ──────────────────────────────────────────
         The one loud block on the page. Chart on the left, hero number
         on the right. When the forecast breaches 100%, the chart area
         above 100 gets a red wash AND the hero number goes red in sync.
         That coupling is the signature moment. */}
      <TacticalCard
        padding="none"
        highlight={needsIntervention}
        style={{
          display: 'flex',
          flexDirection: 'column',
          opacity: systemStatus === 'manual' ? 0.75 : 1,
          transition: `opacity ${MOTION.base}s ease`,
        }}
      >
        {/* Thin strip: title + sim toggle */}
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
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 14,
                fontWeight: 500,
                color: COLORS.textPrimary,
                letterSpacing: '-0.005em',
              }}
            >
              Saturation forecast
            </span>
            <StatusPill
              label={isSimulating ? 'SIM' : 'LIVE'}
              tone={isSimulating ? 'info' : 'ok'}
              size="xs"
            />
          </div>
          <TacticalButton
            variant={isSimulating ? 'primary' : 'secondary'}
            size="sm"
            icon={<Sliders size={12} strokeWidth={2} />}
            onClick={() => {
              setIsSimulating(!isSimulating);
              if (isSimulating) setSimState({ addedStaff: 0, openBeds: 0, expeditedDischarges: 0 });
            }}
          >
            {isSimulating ? 'Reset' : 'What if'}
          </TacticalButton>
        </div>

        {/* Hero split: chart (left, wider) + number (right) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)',
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          {/* Chart */}
          <div
            style={{
              position: 'relative',
              height: 240,
              padding: SPACE.md,
              overflow: 'hidden',
              borderRight: `1px solid ${COLORS.border}`,
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
                {/* Breach wash: red tint over the over-capacity zone. The
                    whole point of this chart is the line crossing 100% —
                    this makes the "danger zone" spatial, not just a
                    dashed label. */}
                <ReferenceArea
                  y1={100}
                  y2={130}
                  fill={COLORS.crit}
                  fillOpacity={0.08}
                  stroke="none"
                  ifOverflow="visible"
                />
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
                    fontFamily: FONTS.sans,
                    fontSize: 13,
                  }}
                  itemStyle={{ color: COLORS.info }}
                  labelStyle={{ color: COLORS.textMuted }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, 'Load']}
                />
                <ReferenceLine
                  y={100}
                  stroke={COLORS.crit}
                  strokeDasharray="3 3"
                  strokeWidth={1}
                />
                <ReferenceLine
                  y={85}
                  stroke={COLORS.warn}
                  strokeDasharray="2 4"
                  strokeWidth={1}
                />
                <ReferenceLine
                  x="now"
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

          {/* Hero number + CTA */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              padding: SPACE.lg,
              gap: SPACE.md,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 11,
                  fontWeight: 500,
                  color: COLORS.textMuted,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 6,
                }}
              >
                Peak in 90 min
              </div>
              {/* The hero number. Animated via key-based remount so it
                  pops on change without a separate tween library. */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minHeight: 88 }}>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={`${Math.round(projectedLoad)}-${forecastTone}`}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 88,
                      fontWeight: 600,
                      letterSpacing: '-0.05em',
                      lineHeight: 0.9,
                      color: forecastColor,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {Math.round(projectedLoad)}
                  </motion.span>
                </AnimatePresence>
                <span
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 28,
                    fontWeight: 500,
                    color: forecastColor,
                    letterSpacing: '-0.02em',
                    opacity: 0.7,
                  }}
                >
                  %
                </span>
              </div>
              <div
                style={{
                  marginTop: SPACE.sm,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {isRising ? (
                  <TrendingUp size={13} strokeWidth={2} color={COLORS.crit} />
                ) : (
                  <TrendingDown size={13} strokeWidth={2} color={COLORS.ok} />
                )}
                <span
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 13,
                    fontWeight: 500,
                    color: isRising ? COLORS.crit : COLORS.ok,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: '-0.005em',
                  }}
                >
                  {delta >= 0 ? '+' : ''}{delta.toFixed(0)}% vs now
                </span>
              </div>
            </div>

            {/* CTA — the one action that matters on this page */}
            {needsIntervention ? (
              <motion.div
                animate={{ opacity: [0.9, 1, 0.9] }}
                transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <TacticalButton
                  variant="primary"
                  size="md"
                  fullWidth
                  icon={<ArrowRight size={14} strokeWidth={2} />}
                  onClick={onActivatePlaybook}
                >
                  Activate surge playbook
                </TacticalButton>
              </motion.div>
            ) : (
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  lineHeight: 1.55,
                  color: COLORS.textSecondary,
                  letterSpacing: '-0.005em',
                }}
              >
                {isSurgeActive
                  ? 'Surge 2 holding. Trajectory stabilizing.'
                  : 'In range. Nothing to do.'}
              </div>
            )}
          </div>
        </div>

        {/* Footer stats */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            background: COLORS.bgDeep,
          }}
        >
          <FooterStat label="Current" value={`${Math.round(currentLoad)}%`} />
          <FooterStat
            label="Window"
            value="−30m → +90m"
            dim
          />
          <FooterStat
            label="Status"
            value={projectedLoad > 100 ? 'Over' : projectedLoad > 85 ? 'Warn' : 'Safe'}
            tone={projectedLoad > 100 ? 'crit' : projectedLoad > 85 ? 'warn' : 'ok'}
            isLast
          />
        </div>
      </TacticalCard>

      {/* ── Support row: simulator/recommendation + drivers ───────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
          gap: SPACE.md,
          alignItems: 'stretch',
        }}
      >
        {/* LEFT: simulator when active, otherwise recommendation */}
        {isSimulating ? (
          <TacticalCard padding="md" style={{ padding: SPACE.lg }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                marginBottom: SPACE.md,
              }}
            >
              <Zap size={15} strokeWidth={2} color={COLORS.info} />
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.textPrimary,
                  letterSpacing: '-0.005em',
                }}
              >
                Turn the dials
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
              <LeverSlider
                label="Add nursing staff"
                unit="FTE"
                value={simState.addedStaff}
                max={5}
                onChange={(v) => setSimState({ ...simState, addedStaff: v })}
              />
              <LeverSlider
                label="Open surge beds"
                unit="beds"
                value={simState.openBeds}
                max={10}
                onChange={(v) => setSimState({ ...simState, openBeds: v })}
              />
              <LeverSlider
                label="Expedite discharges"
                unit="pts"
                value={simState.expeditedDischarges}
                max={8}
                onChange={(v) => setSimState({ ...simState, expeditedDischarges: v })}
              />
            </div>
            {isSafe && !isSurgeActive && (
              <>
                <Divider variant="dashed" style={{ marginTop: SPACE.lg, marginBottom: SPACE.md }} />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACE.md,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 13,
                      color: COLORS.textSecondary,
                      letterSpacing: '-0.005em',
                    }}
                  >
                    You’re back under the line.
                  </span>
                  <TacticalButton
                    variant="primary"
                    size="sm"
                    icon={<ArrowRight size={13} strokeWidth={2} />}
                    onClick={onActivatePlaybook}
                  >
                    Apply
                  </TacticalButton>
                </div>
              </>
            )}
          </TacticalCard>
        ) : (
          <TacticalCard padding="md" style={{ padding: SPACE.lg, display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
              {isSurgeActive ? (
                <CheckCircle2 size={15} strokeWidth={2} color={COLORS.ok} />
              ) : loginCount > 1 ? (
                <CheckCircle2 size={15} strokeWidth={2} color={COLORS.textMuted} />
              ) : (
                <ShieldAlert size={15} strokeWidth={2} color={COLORS.accent} />
              )}
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.textPrimary,
                  letterSpacing: '-0.005em',
                }}
              >
                {isSurgeActive ? 'Surge 2 is running' : loginCount > 1 ? 'Holding steady' : 'Call to make'}
              </span>
            </div>
            <p
              style={{
                fontFamily: FONTS.sans,
                fontSize: 15,
                lineHeight: 1.55,
                color: COLORS.textSecondary,
                margin: 0,
                letterSpacing: '-0.003em',
              }}
            >
              {recommendation}
            </p>
          </TacticalCard>
        )}

        {/* RIGHT: pressure drivers */}
        <TacticalCard
          padding="md"
          style={{
            padding: SPACE.lg,
            display: 'flex',
            flexDirection: 'column',
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
            <Wind size={15} strokeWidth={2} color={COLORS.textSecondary} />
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: 14,
                fontWeight: 500,
                color: COLORS.textPrimary,
                letterSpacing: '-0.005em',
              }}
            >
              {getDriverTitle()}
            </span>
            <div
              style={{
                flex: 1,
                height: 1,
                background: COLORS.border,
              }}
            />
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 11,
                fontWeight: 500,
                color: COLORS.textMuted,
                letterSpacing: '0.1em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {drivers.length}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.sm,
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
                    padding: `${SPACE.sm}px ${SPACE.md}px`,
                    background: isExpanded ? COLORS.surfaceElev : 'transparent',
                    border: `1px solid ${isExpanded ? COLORS.borderStrong : COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    cursor: 'pointer',
                    transition: cssTransition(),
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
                      {/* Single dot sets the tone — replaces the 2-stack of
                          mono index + full-height side-tab border (the #1
                          AI-UI tell flagged by the detector). */}
                      <span
                        aria-hidden
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: RADIUS.full,
                          background: driverColor,
                          boxShadow:
                            driver.status === Status.CRITICAL
                              ? `0 0 6px ${driverColor}`
                              : 'none',
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 14,
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
                          fontFamily: FONTS.sans,
                          fontSize: 13,
                          fontWeight: 600,
                          color: driverColor,
                          fontVariantNumeric: 'tabular-nums',
                          letterSpacing: '-0.003em',
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
                  {/* Thin impact rail */}
                  <div
                    style={{
                      position: 'relative',
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
                      }}
                    />
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
                        {/* Flattened expand — no nested border. Just a
                            dashed divider, two actions, done. */}
                        <Divider variant="dashed" style={{ marginTop: SPACE.md, marginBottom: SPACE.md }} />
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
                            Why
                          </TacticalButton>
                          <TacticalButton
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (showToast) showToast('Acknowledged.', 'info');
                              setExpandedDriverId(null);
                            }}
                            style={{ flex: 1 }}
                          >
                            Acknowledge
                          </TacticalButton>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </TacticalCard>
      </div>

      {/* ── Manual mode modal ─────────────────────────────────────────── */}
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
                  boxShadow: SHADOW.modal,
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
                  <AlertTriangle size={16} strokeWidth={2} color={COLORS.warn} />
                  <span
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 15,
                      fontWeight: 500,
                      color: COLORS.warn,
                      letterSpacing: '-0.005em',
                    }}
                  >
                    EHR connection unstable
                  </span>
                </div>
                <p
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 14,
                    lineHeight: 1.55,
                    color: COLORS.textSecondary,
                    marginBottom: SPACE.lg,
                    letterSpacing: '-0.003em',
                  }}
                >
                  No update from the EHR in 14 minutes. The forecast may be off. Switch to manual to enter census and bed state yourself.
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
                      if (showToast) showToast('Manual override on.', 'error');
                    }}
                  >
                    Switch to manual
                  </TacticalButton>
                </div>
              </TacticalCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Driver details modal ──────────────────────────────────────── */}
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
              style={{ maxWidth: 640, width: '100%' }}
            >
              <TacticalCard
                padding="none"
                style={{
                  boxShadow: SHADOW.modal,
                  borderColor: statusToColor(selectedDriverDetails.status),
                }}
              >
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
                    <div style={{ marginBottom: SPACE.sm }}>
                      <StatusPill
                        label={selectedDriverDetails.status.toUpperCase()}
                        tone={statusToTone(selectedDriverDetails.status)}
                        pulse={selectedDriverDetails.status === Status.CRITICAL}
                      />
                    </div>
                    <h2
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: TYPE.h2.size,
                        fontWeight: TYPE.h2.weight,
                        letterSpacing: TYPE.h2.tracking,
                        color: COLORS.textPrimary,
                        margin: 0,
                        marginBottom: SPACE.sm,
                      }}
                    >
                      {selectedDriverDetails.name}
                    </h2>
                    <div style={{ display: 'flex', gap: SPACE.xl }}>
                      <div>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 11,
                            color: COLORS.textMuted,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Current
                        </div>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 20,
                            color: COLORS.textPrimary,
                            fontWeight: 600,
                            marginTop: 2,
                            letterSpacing: '-0.01em',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {selectedDriverDetails.value}
                        </div>
                      </div>
                      <div>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 11,
                            color: COLORS.textMuted,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                          }}
                        >
                          Impact
                        </div>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 20,
                            color: statusToColor(selectedDriverDetails.status),
                            fontWeight: 600,
                            marginTop: 2,
                            letterSpacing: '-0.01em',
                            fontVariantNumeric: 'tabular-nums',
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
                  <div>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 11,
                        color: COLORS.textMuted,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: SPACE.sm,
                      }}
                    >
                      What’s pushing it
                    </div>
                    <ul
                      style={{
                        listStyle: 'none',
                        padding: 0,
                        margin: 0,
                        fontFamily: FONTS.sans,
                        fontSize: 14,
                        color: COLORS.textSecondary,
                        lineHeight: 1.6,
                        letterSpacing: '-0.003em',
                      }}
                    >
                      <li style={{ paddingLeft: 14, position: 'relative', marginBottom: 4 }}>
                        <span style={{ position: 'absolute', left: 0, color: COLORS.textMuted }}>›</span>
                        Trauma volume up in the last two hours
                      </li>
                      <li style={{ paddingLeft: 14, position: 'relative', marginBottom: 4 }}>
                        <span style={{ position: 'absolute', left: 0, color: COLORS.textMuted }}>›</span>
                        Med/Surg discharges running behind
                      </li>
                      <li style={{ paddingLeft: 14, position: 'relative' }}>
                        <span style={{ position: 'absolute', left: 0, color: COLORS.textMuted }}>›</span>
                        Triage is one nurse short
                      </li>
                    </ul>
                  </div>

                  <div>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 11,
                        color: COLORS.textMuted,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: SPACE.sm,
                      }}
                    >
                      Where it’s headed
                    </div>
                    <p
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 14,
                        color: COLORS.textSecondary,
                        lineHeight: 1.55,
                        margin: 0,
                        letterSpacing: '-0.003em',
                      }}
                    >
                      Left alone, this gets about{' '}
                      <span style={{ color: COLORS.crit, fontWeight: 600 }}>15% worse</span>{' '}
                      in the next 45 minutes.
                    </p>
                  </div>

                  <div>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 11,
                        color: COLORS.textMuted,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        marginBottom: SPACE.sm,
                      }}
                    >
                      What to do
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                      {[
                        'Pull a float nurse to Triage',
                        'Chase pending discharges with the attending',
                      ].map((action) => (
                        <div
                          key={action}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: `${SPACE.sm}px ${SPACE.md}px`,
                            background: COLORS.bgDeep,
                            border: `1px solid ${COLORS.border}`,
                            borderRadius: RADIUS.sm,
                            gap: SPACE.md,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                            <CheckCircle2 size={13} strokeWidth={2} color={COLORS.ok} />
                            <span
                              style={{
                                fontFamily: FONTS.sans,
                                fontSize: 14,
                                color: COLORS.textPrimary,
                                letterSpacing: '-0.003em',
                              }}
                            >
                              {action}
                            </span>
                          </div>
                          <TacticalButton variant="primary" size="sm">
                            Do it
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
                    Close
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
// FooterStat — small sans-serif stat cell for the forecast card footer.
// Replaces the old all-mono all-uppercase KpiCell band; labels are plain
// sans with a light tracked small-cap feel, values are sans with tabular
// numerics so the whole strip reads as text, not as a dashboard hit.
// ─────────────────────────────────────────────────────────────────────────
const FooterStat: React.FC<{
  label: string;
  value: string;
  tone?: 'ok' | 'warn' | 'crit';
  dim?: boolean;
  isLast?: boolean;
}> = ({ label, value, tone, dim, isLast }) => {
  const color =
    tone === 'ok'
      ? COLORS.ok
      : tone === 'warn'
      ? COLORS.warn
      : tone === 'crit'
      ? COLORS.crit
      : dim
      ? COLORS.textSecondary
      : COLORS.textPrimary;
  return (
    <div
      style={{
        padding: `${SPACE.md}px ${SPACE.lg}px`,
        borderRight: isLast ? undefined : `1px solid ${COLORS.border}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 11,
          fontWeight: 500,
          color: COLORS.textMuted,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color,
          lineHeight: 1.1,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </span>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// LeverSlider — stepper + segmented bar used inside the simulator.
//
// Rewritten from native <input type="range"> because the thumb was broken
// in the Capacitor iOS WebView. 44px buttons (iOS HIG), discrete segments,
// no drag. The 2026-04-22 pass dropped the active-segment glow — the bar
// was the brightest thing on the panel and read as AI-dashboard ornament.
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
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: SPACE.sm,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.textSecondary,
            letterSpacing: '-0.005em',
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 600,
            color: value > 0 ? COLORS.info : COLORS.textMuted,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.003em',
          }}
        >
          +{value} {unit}
        </span>
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
            height: 10,
          }}
        >
          {segments.map((active, i) => (
            <div
              key={i}
              style={{
                background: active ? COLORS.accent : COLORS.borderStrong,
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
