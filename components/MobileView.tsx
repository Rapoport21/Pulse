import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  CheckCircle2,
  Users,
  AlertCircle,
  PhoneCall,
  Stethoscope,
  HeartPulse,
  Clock,
  Search,
  MessageSquare,
  Flame,
  Circle,
  CheckCircle,
  LayoutDashboard,
  Bell,
  ChevronRight,
  ChevronLeft,
  BrainCircuit,
  QrCode,
  Radio,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';
import { UserProfile, UserRole } from '../types';
import { ROLE_ACTIONS, ROLE_METRICS } from '../data/userProfiles';
import { PatientDetailScreen } from './PatientDetailScreen';
import { QRScannerModal } from './QRScannerModal';
import { TestQRModal } from './TestQRModal';
import { getDeviceId, useConnectionStatus } from '../lib/realtime';
import { triggerHaptic } from '../lib/haptics';
import type { UrgentTask } from '../lib/surgeTaskTemplates';
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
  CornerBracket,
  BracketFrame,
  HudStrip,
  TacticalCard,
  TacticalButton,
  DotGridBg,
  GlowBg,
  ScanningLine,
  Divider,
} from './design';

/**
 * MobileView — Tactical mobile layout for PULSE.
 *
 * Built entirely on the shared tactical design system in `./design`.
 * Fixed top HudStrip with operator identity + status; fixed bottom HudStrip
 * with tactical tab switcher; center content area swaps by tab with
 * scan-sweep transitions. Touch targets are all 44px+ per HIG guidance.
 */

interface MobileViewProps {
  currentUser: UserProfile;
  isSurgeActive: boolean;
  surgeActivatedAt: number | null;
  urgentTasks: UrgentTask[];
  onAcknowledgeTask: (taskId: string, deviceId: string) => void;
  onActivateSurge: () => void;
  onLogout: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onOpenChat: (query?: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────
const formatElapsed = (sinceMs: number | null, nowMs: number): string => {
  if (!sinceMs) return '0s';
  const diff = Math.max(0, nowMs - sinceMs);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
};

type VitalStatus = 'normal' | 'warning' | 'critical';

const getHRStatus = (hr: string): VitalStatus => {
  const val = parseInt(hr);
  if (val < 50 || val > 120) return 'critical';
  if (val < 60 || val > 100) return 'warning';
  return 'normal';
};

const getBPStatus = (bp: string): VitalStatus => {
  const [sys, dia] = bp.split('/').map(Number);
  if (sys >= 160 || dia >= 100 || sys <= 80 || dia <= 50) return 'critical';
  if (sys >= 140 || dia >= 90 || sys <= 90 || dia <= 60) return 'warning';
  return 'normal';
};

const getO2Status = (o2: string): VitalStatus => {
  const val = parseInt(o2);
  if (val < 90) return 'critical';
  if (val < 95) return 'warning';
  return 'normal';
};

const vitalTone = (status: VitalStatus): 'primary' | 'warn' | 'crit' => {
  if (status === 'critical') return 'crit';
  if (status === 'warning') return 'warn';
  return 'primary';
};

const vitalColor = (status: VitalStatus): string => {
  if (status === 'critical') return COLORS.crit;
  if (status === 'warning') return COLORS.warn;
  return COLORS.textPrimary;
};

// ─────────────────────────────────────────────────────────────────────────
// VitalBox — sharp-cornered tactical vital panel w/ corner brackets
// ─────────────────────────────────────────────────────────────────────────
interface VitalBoxProps {
  label: string;
  value: string;
  unit: string;
  status?: VitalStatus;
}

const VitalBox: React.FC<VitalBoxProps> = ({
  label,
  value,
  unit,
  status = 'normal',
}) => {
  const color = vitalColor(status);
  const isAlert = status !== 'normal';
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: `${SPACE.md}px ${SPACE.md}px ${SPACE.sm}px`,
        background: isAlert ? COLORS.surfaceElev : COLORS.surface,
        border: `1px solid ${isAlert ? color : COLORS.border}`,
        borderRadius: RADIUS.sm,
        overflow: 'hidden',
        minHeight: 64,
      }}
    >
      {isAlert && (
        <span
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: `linear-gradient(180deg, ${color}14 0%, transparent 60%)`,
            pointerEvents: 'none',
          }}
        />
      )}
      <CornerBracket
        position="tl"
        color={isAlert ? color : COLORS.borderStrong}
        size={6}
        thickness={1}
        inset={-1}
      />
      <CornerBracket
        position="br"
        color={isAlert ? color : COLORS.borderStrong}
        size={6}
        thickness={1}
        inset={-1}
      />
      <Mono tone={isAlert ? vitalTone(status) : 'muted'} size="xs">
        {label}
      </Mono>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 4,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <span
          style={{
            fontFamily: FONTS.sans,
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            color,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </span>
        <Mono tone="dim" size="xs">
          {unit}
        </Mono>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ProgressRing — tactical ring for shift progress (neutral / ok tone —
// accent is reserved for urgent states, not routine progress readouts)
// ─────────────────────────────────────────────────────────────────────────
const ProgressRing: React.FC<{ progress: number }> = ({ progress }) => {
  const size = 76;
  const stroke = 4;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  const center = size / 2;

  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={COLORS.border}
          strokeWidth={stroke}
          fill="transparent"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          stroke={COLORS.ok}
          strokeWidth={stroke}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: 'stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      </svg>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: FONTS.sans,
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: COLORS.textPrimary,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(progress)}
          <span style={{ fontSize: 11, color: COLORS.textMuted, marginLeft: 2 }}>
            %
          </span>
        </span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// SectionHeader — compact mono section label for mobile
// ─────────────────────────────────────────────────────────────────────────
const SectionHeader: React.FC<{
  id: string;
  label: string;
  right?: React.ReactNode;
}> = ({ id, label, right }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.sm,
      marginBottom: SPACE.md,
      paddingLeft: 2,
    }}
  >
    <Mono tone="dim" size="xs">
      // {id}
    </Mono>
    <Mono tone="secondary" size="base">
      {label}
    </Mono>
    <div
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, ${COLORS.border}, transparent)`,
      }}
    />
    {right}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// MetricTile — compact mobile KPI tile
// ─────────────────────────────────────────────────────────────────────────
interface MetricTileProps {
  id: string;
  label: string;
  value: string;
  unit?: string;
  delta?: { text: string; tone: 'ok' | 'warn' | 'crit' | 'info' };
  accent?: 'crit' | 'warn' | 'ok' | 'info' | 'default';
  progressPct?: number;
}

const MetricTile: React.FC<MetricTileProps> = ({
  id,
  label,
  value,
  unit,
  delta,
  accent = 'default',
  progressPct,
}) => {
  const accentColor =
    accent === 'crit'
      ? COLORS.crit
      : accent === 'warn'
      ? COLORS.warn
      : accent === 'ok'
      ? COLORS.ok
      : accent === 'info'
      ? COLORS.info
      : undefined;
  // Severity drives the numeric size. Critical tiles shout loudest,
  // warn tiles get a half-step, everything else stays at the base 30px.
  // The tile footprint is unchanged so the 2×2 grid never reflows.
  const valueFontSize =
    accent === 'crit' ? 40 : accent === 'warn' ? 34 : 30;
  return (
    <TacticalCard padding="none" highlight={accent === 'crit'}>
      <div
        style={{
          position: 'relative',
          padding: SPACE.md,
          minHeight: 96,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: SPACE.sm,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: SPACE.xs,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Mono tone="dim" size="xs">
              // {id}
            </Mono>
            <Mono tone="muted" size="xs">
              {label}
            </Mono>
          </div>
          {delta && (
            <Mono tone={delta.tone} size="xs">
              {delta.text}
            </Mono>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: valueFontSize,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 0.95,
              color: accentColor ?? COLORS.textPrimary,
              fontVariantNumeric: 'tabular-nums',
              transition: `font-size ${MOTION.base}s ${MOTION.ease}`,
            }}
          >
            {value}
          </span>
          {unit && (
            <Mono tone="dim" size="xs">
              {unit}
            </Mono>
          )}
        </div>
        {progressPct !== undefined && (
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              height: 2,
              background: COLORS.border,
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(100, Math.max(0, progressPct))}%`,
                // Neutral fallback — the tile only glows when a
                // caller explicitly passes a status colour (ok, warn,
                // crit, info). Accent is no longer a default decoration.
                background: accentColor ?? COLORS.textSecondary,
                transition: `width ${MOTION.slow}s ${MOTION.ease}`,
              }}
            />
          </div>
        )}
      </div>
    </TacticalCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StateHero — the ONE unambiguous answer to "what state is the hospital
// in RIGHT NOW?". Renders as the first card on the mobile dashboard so
// operators don't have to synthesize state from four scattered signals.
//
// The hero owns the largest numeric on mobile (42px displaySm) because
// numbers draw the eye faster than words. The state word sits above as
// a tone-colored label — "Nominal", "Strained", "Surge Active". Trend
// arrow + context line anchor the forecast.
// ─────────────────────────────────────────────────────────────────────────
type HeroState = 'nominal' | 'strained' | 'surge';

const STATE_LABEL: Record<HeroState, string> = {
  nominal: 'Nominal',
  strained: 'Strained',
  surge: 'Surge Active',
};

const StateHero: React.FC<{
  state: HeroState;
  dominantValue: string;
  dominantUnit?: string;
  dominantLabel: string;
  trendDirection: 'up' | 'down' | 'flat';
  trendMagnitude: string;
  trendWindow: string;
  timerText?: string;
  /**
   * Role-specific override for the state word. A Charge Nurse reads
   * "Behind" faster than "Strained"; a Trauma Attending reads "Trauma
   * Active" faster than "Surge Active". Falls back to the default
   * STATE_LABEL mapping when omitted.
   */
  stateLabelOverride?: Record<HeroState, string>;
}> = ({
  state,
  dominantValue,
  dominantUnit,
  dominantLabel,
  trendDirection,
  trendMagnitude,
  trendWindow,
  timerText,
  stateLabelOverride,
}) => {
  const toneColor =
    state === 'surge'
      ? COLORS.crit
      : state === 'strained'
      ? COLORS.warn
      : COLORS.ok;

  // Trend arrow: up = rising load (bad when state is strained/surge,
  // neutral context when nominal). We use directional glyphs because
  // they read instantly without parsing a word.
  const trendGlyph =
    trendDirection === 'up' ? '▲' : trendDirection === 'down' ? '▼' : '▬';

  return (
    <TacticalCard padding="none" highlight={state !== 'nominal'}>
      <div
        style={{
          position: 'relative',
          padding: SPACE.base,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.md,
        }}
      >
        {/* Top row: state label + optional timer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: SPACE.sm,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: SPACE.sm,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 6,
                height: 6,
                borderRadius: RADIUS.full,
                background: toneColor,
                boxShadow: `0 0 8px ${toneColor}`,
                animation:
                  state !== 'nominal'
                    ? 'pulse-dot 1.4s ease-in-out infinite'
                    : undefined,
              }}
            />
            <Mono tone="muted" size="xs">
              SHIFT STATUS
            </Mono>
          </div>
          {timerText && (
            <Mono
              size="xs"
              style={{
                color: toneColor,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {timerText}
            </Mono>
          )}
        </div>

        {/* State label — large tone-colored word */}
        <h2
          style={{
            margin: 0,
            fontFamily: FONTS.sans,
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: toneColor,
          }}
        >
          {stateLabelOverride?.[state] ?? STATE_LABEL[state]}
        </h2>

        {/* Dominant KPI row — biggest number on the mobile screen */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: SPACE.base,
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 4,
            }}
          >
            <span
              style={{
                fontFamily: FONTS.sans,
                fontSize: TYPE.displaySm.size,
                fontWeight: TYPE.displaySm.weight,
                letterSpacing: TYPE.displaySm.tracking,
                lineHeight: 0.9,
                color: COLORS.textPrimary,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {dominantValue}
            </span>
            {dominantUnit && (
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 22,
                  fontWeight: 500,
                  color: COLORS.textMuted,
                  letterSpacing: '-0.01em',
                }}
              >
                {dominantUnit}
              </span>
            )}
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 2,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontFamily: FONTS.mono,
                fontSize: 13,
                fontWeight: 600,
                color: toneColor,
                letterSpacing: '0.04em',
              }}
            >
              <span aria-hidden>{trendGlyph}</span>
              <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                {trendMagnitude}
              </span>
            </div>
            <Mono tone="dim" size="xs">
              {trendWindow}
            </Mono>
          </div>
        </div>

        {/* Context strip */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
            paddingTop: SPACE.sm,
            borderTop: `1px dashed ${COLORS.border}`,
          }}
        >
          <Mono tone="muted" size="xs">
            {dominantLabel}
          </Mono>
        </div>
      </div>
    </TacticalCard>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────
export const MobileView: React.FC<MobileViewProps> = ({
  currentUser,
  isSurgeActive,
  surgeActivatedAt,
  urgentTasks,
  onAcknowledgeTask,
  onActivateSurge,
  onLogout,
  showToast,
  onOpenChat,
}) => {
  const [activeTab, setActiveTab] = useState<
    'dashboard' | 'tasks' | 'patients' | 'alerts' | 'comms'
  >('dashboard');
  const [showMenu, setShowMenu] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [taskFilter, setTaskFilter] = useState<'all' | 'stat' | 'routine'>('all');
  const [time, setTime] = useState(new Date());
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showTestQR, setShowTestQR] = useState(false);
  const myDeviceId = getDeviceId();

  /**
   * QR scan handler. Parses `pulse://` deep-link payloads.
   *
   * Supported schemes today:
   *   pulse://tab/<tabname>  → jump to the named tab
   *
   * Unknown payloads close the scanner and show a toast preview of
   * the raw string so the user can see *something* scanned.
   */
  const handleQRScan = (payload: string) => {
    if (payload.startsWith('pulse://tab/')) {
      const tab = payload.slice('pulse://tab/'.length).split(/[?#/]/)[0];
      if (
        tab === 'dashboard' ||
        tab === 'tasks' ||
        tab === 'patients' ||
        tab === 'alerts' ||
        tab === 'comms'
      ) {
        setActiveTab(tab);
        setShowScanner(false);
        showToast(`OPENED ${tab.toUpperCase()} TAB`, 'success');
        return;
      }
    }
    setShowScanner(false);
    const preview = payload.length > 48 ? payload.slice(0, 48) + '…' : payload;
    showToast(`QR: ${preview}`, 'info');
  };
  const connectionStatus = useConnectionStatus();
  const connectionColor =
    connectionStatus === 'connected'
      ? COLORS.ok
      : connectionStatus === 'connecting'
        ? COLORS.warn
        : COLORS.crit;

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const allTasks =
    ROLE_ACTIONS[currentUser.role]?.filter(
      (a) => !completedTasks.includes(a.id),
    ) || [];
  const myTasks = allTasks.filter((t) => {
    if (taskFilter === 'stat')
      return t.priority === 'High';
    if (taskFilter === 'routine')
      return t.priority === 'Medium' || t.priority === 'Low';
    return true;
  });

  const progressPercent =
    (completedTasks.length /
      (ROLE_ACTIONS[currentUser.role]?.length || 1)) *
    100;

  const getMyPatients = () => {
    if (currentUser.role === UserRole.ER_PERSONNEL) {
      return [
        {
          id: '1',
          name: 'Doe, John',
          age: '45M',
          mrn: 'MRN-8821',
          loc: 'Trauma 1',
          status: 'critical',
          code: 'FULL CODE',
          notes: 'MVA, awaiting CT. Intubated.',
          vitals: { hr: '135', bp: '85/50', o2: '92' },
          trends: {
            hr: [80, 85, 90, 110, 125, 135],
            bp: [120, 115, 100, 90, 85, 85],
            o2: [98, 97, 95, 94, 92, 92],
          },
        },
        {
          id: '2',
          name: 'Smith, Jane',
          age: '62F',
          mrn: 'MRN-9912',
          loc: 'Bed 4',
          status: 'warning',
          code: 'DNR/DNI',
          notes: 'Chest pain, troponin pending. IV access established.',
          vitals: { hr: '98', bp: '145/90', o2: '96' },
          trends: {
            hr: [75, 78, 85, 92, 95, 98],
            bp: [130, 135, 140, 142, 145, 145],
            o2: [99, 98, 98, 97, 96, 96],
          },
        },
        {
          id: '3',
          name: 'Fox, Robert',
          age: '28M',
          mrn: 'MRN-1102',
          loc: 'Bed 7',
          status: 'normal',
          code: 'FULL CODE',
          notes: 'Laceration repair complete. Awaiting discharge papers.',
          vitals: { hr: '72', bp: '120/80', o2: '99' },
          trends: {
            hr: [70, 71, 72, 71, 72, 72],
            bp: [118, 120, 119, 121, 120, 120],
            o2: [98, 99, 99, 99, 99, 99],
          },
        },
      ];
    } else {
      return [
        {
          id: '4',
          name: 'Wong, Alice',
          age: '34F',
          mrn: 'MRN-3321',
          loc: 'Room 201',
          status: 'normal',
          code: 'FULL CODE',
          notes: 'Post-op appendectomy. Pain well managed.',
          vitals: { hr: '82', bp: '118/75', o2: '98' },
          trends: {
            hr: [80, 81, 82, 82, 82, 82],
            bp: [120, 119, 118, 118, 118, 118],
            o2: [99, 98, 98, 98, 98, 98],
          },
        },
        {
          id: '5',
          name: 'Ruiz, Carlos',
          age: '71M',
          mrn: 'MRN-4415',
          loc: 'Room 202',
          status: 'warning',
          code: 'FULL CODE',
          notes: 'BP dropping, paging MD. Fluid bolus started.',
          vitals: { hr: '110', bp: '90/60', o2: '94' },
          trends: {
            hr: [85, 90, 95, 100, 105, 110],
            bp: [110, 105, 100, 95, 92, 90],
            o2: [97, 96, 95, 95, 94, 94],
          },
        },
      ];
    }
  };

  const myPatients = getMyPatients();

  // 4-hour forecast sampled at 15-minute intervals → 17 points gives a
  // detailed curve that still feels responsive to touch on a phone. Adds
  // a small sine-wave jitter so the line reads as real telemetry rather
  // than a clean monotonic curve.
  const chartData = React.useMemo(() => {
    const pts: Array<{ time: string; tick: string; load: number }> = [];
    const baseStart = isSurgeActive ? 32 : 85;
    const baseEnd = isSurgeActive ? 22 : 112;
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const eased = t * t * (3 - 2 * t); // smoothstep
      const base = baseStart + (baseEnd - baseStart) * eased;
      const jitter = Math.sin(i * 1.3) * 1.4 + Math.cos(i * 0.7) * 0.9;
      const load = Math.max(18, Math.min(130, base + jitter));
      const minutes = i * 15;
      const hourPart = Math.floor(minutes / 60);
      const minPart = minutes % 60;
      const hasLabel = minPart === 0;
      pts.push({
        time: hasLabel
          ? hourPart === 0
            ? 'Now'
            : `+${hourPart}h`
          : '',
        tick: `+${hourPart}h${minPart.toString().padStart(2, '0')}`,
        load: Number(load.toFixed(1)),
      });
    }
    return pts;
  }, [isSurgeActive]);
  const isSafe = chartData[chartData.length - 1].load < 100;

  const mockAlerts = [
    {
      id: 1,
      title: 'Critical Lab Value',
      desc: 'Troponin elevated (2.4 ng/mL) for Smith, Jane. Protocol initiated.',
      time: 'Just now',
      unread: true,
      type: 'critical' as const,
    },
    {
      id: 2,
      title: 'Patient Admission',
      desc: 'Level 1 Trauma arriving in 5 mins. ETA 14:35. Prepare Bay 1.',
      time: '2m ago',
      unread: true,
      type: 'warning' as const,
    },
    {
      id: 3,
      title: 'Pharmacy Update',
      desc: 'Vanco shortage, use alternative protocols as per guidelines.',
      time: '1h ago',
      unread: false,
      type: 'info' as const,
    },
  ];

  const handleCompleteTask = (id: string) => {
    setCompletedTasks((prev) => [...prev, id]);
    showToast('Task marked complete', 'success');
  };

  const navItems = [
    { id: 'dashboard' as const, icon: LayoutDashboard, label: 'Home', code: 'HOM' },
    { id: 'tasks' as const, icon: CheckCircle2, label: 'Actions', code: 'ACT' },
    {
      id: 'patients' as const,
      icon: Users,
      label: currentUser.role === UserRole.MANAGER ? 'Units' : 'Patients',
      code: currentUser.role === UserRole.MANAGER ? 'UNT' : 'PAT',
    },
    { id: 'alerts' as const, icon: Bell, label: 'Alerts', code: 'ALR' },
    { id: 'comms' as const, icon: MessageSquare, label: 'Comms', code: 'COM' },
  ];

  const timeStr = time.toUTCString().slice(17, 25); // HH:MM:SS

  // Chrome constants — compact for mobile thumb-zones
  const HEADER_HEIGHT = 52;
  const NAV_HEIGHT = 64;
  const SURGE_BANNER_HEIGHT = 36;
  const topChrome = HEADER_HEIGHT + (isSurgeActive ? SURGE_BANNER_HEIGHT : 0);

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        // Dynamic viewport height — always equals the visible WebView
        // even when iOS toolbars or the dynamic island change the
        // available height. Supported on iOS Safari 15.4+ (Capacitor
        // ships with WKWebView so we get the modern behaviour).
        height: '100dvh',
        width: '100%',
        background: COLORS.bg,
        color: COLORS.textPrimary,
        fontFamily: FONTS.sans,
        overflow: 'hidden',
        // Push content below the dynamic island / status bar. With
        // box-sizing:border-box (set globally in index.css) the
        // padding is included inside the 100dvh box, so the bottom
        // nav stays inside the visible area.
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      {/* Ambient background layers — the rose glow now only appears
          during surge protocol. Idle sessions get a neutral dark glow
          so the shell doesn't read as "critical" by default. */}
      <DotGridBg opacity={0.22} />
      {isSurgeActive && (
        <GlowBg
          origin="bottom"
          color={COLORS.accentGlow}
          intensity={1}
        />
      )}

      {/* ── SURGE BANNER ──────────────────────────────────────── */}
      {isSurgeActive && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.base, ease: MOTION.ease }}
          style={{
            position: 'relative',
            height: SURGE_BANNER_HEIGHT,
            flexShrink: 0,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: SPACE.sm,
            background: `linear-gradient(180deg, ${COLORS.accent}22 0%, ${COLORS.accent}08 100%)`,
            borderBottom: `1px solid ${COLORS.accent}`,
            boxShadow: SHADOW.accentGlowSm,
            overflow: 'hidden',
          }}
        >
          <ScanningLine color={COLORS.accent} duration={3} />
          <ShieldAlert
            size={13}
            color={COLORS.accent}
            style={{ filter: `drop-shadow(0 0 6px ${COLORS.accent})` }}
          />
          <Mono tone="accent" size="base">
            SURGE PROTOCOL ACTIVE
          </Mono>
          {surgeActivatedAt && (
            <Mono tone="accent" size="xs">
              · T+{formatElapsed(surgeActivatedAt, time.getTime())}
            </Mono>
          )}
        </motion.div>
      )}

      {/* ── TOP HUD HEADER ────────────────────────────────────── */}
      <HudStrip side="top" height={HEADER_HEIGHT}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          {/* Avatar with status dot */}
          <div
            style={{
              position: 'relative',
              width: 36,
              height: 36,
              flexShrink: 0,
              background: COLORS.surfaceElev,
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: RADIUS.sm,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: FONTS.mono,
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: COLORS.textPrimary,
            }}
          >
            <CornerBracket position="tl" color={COLORS.borderStrong} size={5} thickness={1} />
            <CornerBracket position="br" color={COLORS.borderStrong} size={5} thickness={1} />
            {currentUser.avatarInitials}
            {/* Network status dot — replaces the floating ConnectionIndicator
                that used to overlap the bottom tab bar. */}
            <motion.span
              aria-hidden
              aria-label={`Network ${connectionStatus}`}
              animate={{
                boxShadow:
                  connectionStatus === 'connected'
                    ? [
                        `0 0 4px ${connectionColor}`,
                        `0 0 10px ${connectionColor}`,
                        `0 0 4px ${connectionColor}`,
                      ]
                    : `0 0 6px ${connectionColor}`,
              }}
              transition={{
                duration: 2.4,
                repeat: connectionStatus === 'connected' ? Infinity : 0,
                ease: 'easeInOut',
              }}
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 7,
                height: 7,
                borderRadius: RADIUS.full,
                background: connectionColor,
                border: `1.5px solid ${COLORS.bg}`,
              }}
            />
          </div>

          {/* Identity */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              minWidth: 0,
              flex: 1,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 14,
                fontWeight: 600,
                color: COLORS.textPrimary,
                letterSpacing: '-0.01em',
                lineHeight: 1.1,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {currentUser.name}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.xs,
                minWidth: 0,
              }}
            >
              <Mono tone="muted" size="xs">
                {currentUser.role.replace('_', ' ')} · {timeStr}
              </Mono>
              <span
                aria-hidden
                style={{
                  display: 'inline-block',
                  width: 4,
                  height: 4,
                  borderRadius: RADIUS.full,
                  background: connectionColor,
                  boxShadow: `0 0 4px ${connectionColor}`,
                }}
              />
              <Mono
                tone="dim"
                size="xs"
                style={{ fontSize: 9, letterSpacing: '0.12em' }}
              >
                {connectionStatus === 'connected'
                  ? 'LINK'
                  : connectionStatus === 'connecting'
                    ? 'SYNC'
                    : 'OFFL'}
              </Mono>
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.xs,
            flexShrink: 0,
          }}
        >
          <motion.button
            onClick={() => onOpenChat()}
            aria-label="Open PULSE AI"
            whileTap={{ scale: 0.92 }}
            whileHover={{ borderColor: COLORS.info }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            style={{
              width: 44,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: COLORS.info,
              cursor: 'pointer',
            }}
          >
            <BrainCircuit size={16} strokeWidth={1.75} />
          </motion.button>
          <motion.button
            onClick={() => setShowMenu(!showMenu)}
            aria-label={showMenu ? 'Close menu' : 'Open menu'}
            whileTap={{ scale: 0.92 }}
            whileHover={{ borderColor: COLORS.borderHover }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            style={{
              width: 44,
              height: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: showMenu ? COLORS.surfaceElev : COLORS.surface,
              border: `1px solid ${showMenu ? COLORS.borderHover : COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: showMenu ? COLORS.textPrimary : COLORS.textSecondary,
              cursor: 'pointer',
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={showMenu ? 'x' : 'menu'}
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {showMenu ? <X size={16} /> : <Menu size={16} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>
      </HudStrip>

      {/* ── MOBILE MENU OVERLAY ───────────────────────────────── */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.fast }}
            style={{
              position: 'absolute',
              top: topChrome,
              left: 0,
              right: 0,
              bottom: 0,
              background: `${COLORS.bg}F2`,
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 50,
              display: 'flex',
              flexDirection: 'column',
              padding: SPACE.base,
              gap: SPACE.md,
              overflowY: 'auto',
            }}
          >
            <DotGridBg opacity={0.15} />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: SPACE.xs,
                position: 'relative',
                zIndex: 1,
              }}
            >
              <motion.button
                type="button"
                onClick={() => setShowMenu(false)}
                aria-label="Close menu"
                whileTap={{ scale: 0.94 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `6px ${SPACE.sm}px`,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textSecondary,
                  cursor: 'pointer',
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                <ChevronLeft size={12} strokeWidth={2} />
                Back
              </motion.button>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.sm,
                }}
              >
                <BracketLabel tone="secondary" size="xs">
                  OPERATOR MENU
                </BracketLabel>
                <Mono tone="dim" size="xs">
                  SEC-LVL 2
                </Mono>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: MOTION.base, ease: MOTION.ease }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <TacticalCard
                interactive={!isSurgeActive}
                highlight={isSurgeActive}
                role="button"
                tabIndex={0}
                onClick={() => {
                  if (!isSurgeActive) {
                    triggerHaptic('heavy');
                    onActivateSurge();
                  }
                  setShowMenu(false);
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isSurgeActive) {
                    e.preventDefault();
                    triggerHaptic('heavy');
                    onActivateSurge();
                    setShowMenu(false);
                  }
                }}
                padding="none"
                style={{
                  cursor: isSurgeActive ? 'default' : 'pointer',
                  padding: SPACE.base,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.base,
                    minHeight: 56,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${isSurgeActive ? COLORS.accent : COLORS.border}`,
                      background: COLORS.surface,
                      borderRadius: RADIUS.sm,
                      color: COLORS.accent,
                    }}
                  >
                    <ShieldAlert size={20} />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 15,
                        fontWeight: 600,
                        color: COLORS.textPrimary,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {isSurgeActive ? 'Surge Protocol Active' : 'Activate Surge'}
                    </div>
                    <Mono tone={isSurgeActive ? 'accent' : 'muted'}>
                      {isSurgeActive
                        ? `T+${formatElapsed(surgeActivatedAt, time.getTime())}`
                        : 'Hospital-wide response'}
                    </Mono>
                  </div>
                  <StatusPill
                    label={isSurgeActive ? 'Active' : 'Ready'}
                    tone={isSurgeActive ? 'crit' : 'ok'}
                    pulse={isSurgeActive}
                  />
                </div>
              </TacticalCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.14, duration: MOTION.base, ease: MOTION.ease }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <TacticalCard
                interactive
                role="button"
                tabIndex={0}
                onClick={() => {
                  setShowMenu(false);
                  showToast('Loading Performance Metrics...', 'info');
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setShowMenu(false);
                    showToast('Loading Performance Metrics...', 'info');
                  }
                }}
                padding="none"
                style={{ cursor: 'pointer', padding: SPACE.base }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.base,
                    minHeight: 56,
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `1px solid ${COLORS.border}`,
                      background: COLORS.surface,
                      borderRadius: RADIUS.sm,
                      color: COLORS.info,
                    }}
                  >
                    <Activity size={20} />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 15,
                        fontWeight: 600,
                        color: COLORS.textPrimary,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Performance Metrics
                    </div>
                    <Mono tone="muted">Shift data · KPIs</Mono>
                  </div>
                  <ChevronRight size={16} color={COLORS.textMuted} />
                </div>
              </TacticalCard>
            </motion.div>

            <div style={{ flex: 1 }} />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: MOTION.base, ease: MOTION.ease }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <TacticalButton
                variant="danger"
                fullWidth
                size="md"
                icon={<LogOut size={14} />}
                onClick={onLogout}
                style={{ height: 48 }}
              >
                Secure Sign Out
              </TacticalButton>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          // minHeight:0 is required so this flex child can shrink
          // below its intrinsic content size — without it the long
          // scrollable lists below would push the bottom nav off
          // screen on iPhone widths.
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          // Smooth iOS-native momentum scrolling inside the WebView.
          WebkitOverflowScrolling: 'touch',
          position: 'relative',
          zIndex: 1,
          scrollBehavior: 'smooth',
        }}
      >
        {/* ────── DASHBOARD ─────────────────────────────────── */}
        {activeTab === 'dashboard' && (
          <motion.div
            key="dashboard"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{
              padding: SPACE.base,
              paddingBottom: NAV_HEIGHT + SPACE['2xl'],
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.lg,
            }}
          >
            {/* Breadcrumb — operator context, not the state answer.
                The state answer lives in the StateHero card below.
                H1 has been removed because it was the word "Overview",
                which wasted the most prominent slot on the page on a
                label that said nothing. The card hierarchy itself is
                now the navigation. */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: SPACE.sm,
                marginTop: SPACE.xs,
              }}
            >
              <Mono tone="dim" size="xs">
                // PULSE / {currentUser.role.toUpperCase()} / SHIFT
              </Mono>
              <StatusPill label="Live" tone="ok" pulse />
            </div>

            {/* ── STATE HERO (biggest numeric on the screen) ──
                Role-aware: each role has a different "what matters
                right now" answer. Ops director cares about bed
                capacity. Charge nurse cares about overdue bedside
                tasks. Trauma attending cares about available bays.
                The state label itself is also per-role because
                "Nominal / Strained / Surge" reads different to a
                nurse than it does to an ops director — for a
                trauma doc, "Surge" isn't an exception, it's Tuesday.
                Everything else in the dashboard stacks below in
                order of urgency: state → live ops → horizon →
                actions → narrative. */}
            {(() => {
              const heroProps = (() => {
                switch (currentUser.role) {
                  case UserRole.MANAGER:
                    return {
                      state: (isSurgeActive ? 'surge' : 'nominal') as HeroState,
                      dominantValue: isSurgeActive ? '98' : '82',
                      dominantUnit: '%',
                      dominantLabel: isSurgeActive
                        ? 'BED CAPACITY · 12 ER HOLDS WAITING ON FLOOR'
                        : 'BED CAPACITY · 232 / 284 OCCUPIED',
                      trendDirection: (isSurgeActive ? 'up' : 'down') as
                        | 'up'
                        | 'down'
                        | 'flat',
                      trendMagnitude: isSurgeActive ? '+6%' : '-2%',
                      trendWindow: 'NEXT 2H',
                      timerText:
                        isSurgeActive && surgeActivatedAt
                          ? `T+${formatElapsed(surgeActivatedAt, time.getTime())}`
                          : undefined,
                      // Manager-specific state labels
                      stateLabelOverride: {
                        nominal: 'Nominal',
                        strained: 'Strained',
                        surge: 'Surge Active',
                      },
                    };
                  case UserRole.NURSE:
                    return {
                      state: (isSurgeActive ? 'strained' : 'nominal') as HeroState,
                      dominantValue: isSurgeActive ? '6' : '4',
                      dominantUnit: undefined,
                      dominantLabel:
                        'OVERDUE REASSESSMENTS · 2 FALL RISK · 3 DISCHARGES PENDING',
                      trendDirection: 'up' as 'up' | 'down' | 'flat',
                      trendMagnitude: '+1',
                      trendWindow: 'LAST 30M',
                      timerText: undefined,
                      // Nurse-specific: "behind on tasks" not "surge"
                      stateLabelOverride: {
                        nominal: 'On Pace',
                        strained: 'Behind',
                        surge: 'Critical',
                      },
                    };
                  case UserRole.ER_PERSONNEL:
                    // Trauma is baseline busy. Bays at 0 is normal
                    // for this role; surge escalates to trauma active.
                    return {
                      state: (isSurgeActive ? 'surge' : 'strained') as HeroState,
                      dominantValue: '0',
                      dominantUnit: 'bays',
                      dominantLabel:
                        'TRAUMA BAYS OPEN · 3 EMS INBOUND <5MIN · 125M TRIAGE WAIT',
                      trendDirection: 'flat' as 'up' | 'down' | 'flat',
                      trendMagnitude: 'HOT',
                      trendWindow: 'LIVE',
                      timerText:
                        isSurgeActive && surgeActivatedAt
                          ? `T+${formatElapsed(surgeActivatedAt, time.getTime())}`
                          : undefined,
                      stateLabelOverride: {
                        nominal: 'Ready',
                        strained: 'Busy',
                        surge: 'Trauma Active',
                      },
                    };
                }
              })();
              return <StateHero {...heroProps} />;
            })()}

            {/* Live Ops Grid — house-wide KPIs, scannable at a glance.
                Critical tiles now render their numeric at 40px so
                severity is encoded in size, not just color. */}
            <div>
              <SectionHeader
                id="LO"
                label="LIVE OPS"
                right={<StatusPill label="Sync" tone="info" size="xs" />}
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: SPACE.sm,
                }}
              >
                <MetricTile
                  id="M01"
                  label="ER Wait Time"
                  value="45"
                  unit="min"
                  delta={{ text: '+5m', tone: 'crit' }}
                  accent="warn"
                />
                <MetricTile
                  id="M02"
                  label="Total Census"
                  value="284"
                  unit="pts"
                  delta={{ text: '-12', tone: 'ok' }}
                />
                <MetricTile
                  id="M03"
                  label="Bed Capacity"
                  value={isSurgeActive ? '98' : '82'}
                  unit="%"
                  accent={isSurgeActive ? 'crit' : 'ok'}
                  progressPct={isSurgeActive ? 98 : 82}
                />
                <MetricTile
                  id="M04"
                  label="Active Codes"
                  value="1"
                  delta={{ text: 'STABLE', tone: 'info' }}
                  accent="info"
                />
              </div>
            </div>

            {/* Pulse Horizon */}
            <div>
              <SectionHeader
                id="PH"
                label="PULSE HORIZON"
                right={
                  <Mono tone={isSafe ? 'ok' : 'crit'}>
                    {isSafe ? 'SAFE' : '+12% LOAD'}
                  </Mono>
                }
              />
              <TacticalCard padding="none">
                <div style={{ padding: SPACE.base, position: 'relative' }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-end',
                      marginBottom: SPACE.md,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                      }}
                    >
                      <Mono tone="muted" size="xs">
                        Predicted Census
                      </Mono>
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 18,
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                          letterSpacing: '-0.02em',
                          lineHeight: 1.1,
                        }}
                      >
                        Next 4 Hours
                      </div>
                    </div>
                    <StatusPill
                      label={isSafe ? 'Trend Ok' : 'At Risk'}
                      tone={isSafe ? 'ok' : 'crit'}
                    />
                  </div>
                  <div
                    style={{
                      height: 180,
                      width: '100%',
                      marginLeft: -8,
                      // Stop the parent tab from intercepting horizontal
                      // drags when the user scrubs the chart.
                      touchAction: 'pan-y',
                    }}
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={chartData}
                        margin={{ top: 8, right: 12, left: 0, bottom: 4 }}
                      >
                        <defs>
                          <linearGradient
                            id="colorLoadMobile"
                            x1="0"
                            y1="0"
                            x2="0"
                            y2="1"
                          >
                            <stop
                              offset="5%"
                              stopColor={isSafe ? COLORS.info : COLORS.crit}
                              stopOpacity={0.55}
                            />
                            <stop
                              offset="95%"
                              stopColor={isSafe ? COLORS.info : COLORS.crit}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="2 4"
                          stroke={COLORS.border}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="time"
                          stroke={COLORS.textMuted}
                          tick={{
                            fontSize: 9,
                            fontFamily: FONTS.mono,
                            letterSpacing: '0.12em',
                            fill: COLORS.textMuted,
                          }}
                          axisLine={{ stroke: COLORS.border }}
                          tickLine={false}
                          interval={0}
                          dy={8}
                        />
                        <YAxis
                          domain={[0, 130]}
                          width={28}
                          stroke={COLORS.textMuted}
                          tick={{
                            fontSize: 9,
                            fontFamily: FONTS.mono,
                            letterSpacing: '0.1em',
                            fill: COLORS.textDim,
                          }}
                          axisLine={false}
                          tickLine={false}
                          ticks={[0, 50, 100]}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: COLORS.surfaceElev,
                            border: `1px solid ${COLORS.borderStrong}`,
                            color: COLORS.textPrimary,
                            borderRadius: RADIUS.sm,
                            fontSize: 11,
                            fontFamily: FONTS.mono,
                            letterSpacing: '0.08em',
                            textTransform: 'uppercase',
                            padding: `${SPACE.xs}px ${SPACE.sm}px`,
                          }}
                          itemStyle={{ color: COLORS.textPrimary }}
                          labelStyle={{ color: COLORS.textSecondary }}
                          formatter={(value: number) => [
                            `${value}%`,
                            'Saturation',
                          ]}
                          labelFormatter={(_label, payload) =>
                            (payload?.[0]?.payload as { tick?: string } | undefined)
                              ?.tick ?? ''
                          }
                          cursor={{
                            stroke: COLORS.textSecondary,
                            strokeWidth: 1,
                            strokeDasharray: '2 4',
                          }}
                        />
                        <ReferenceLine
                          y={100}
                          stroke={COLORS.crit}
                          strokeDasharray="3 4"
                          strokeWidth={1}
                          label={{
                            value: 'CAPACITY',
                            position: 'insideTopRight',
                            fill: COLORS.crit,
                            fontSize: 8,
                            fontFamily: FONTS.mono,
                            letterSpacing: '0.14em',
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="load"
                          stroke={isSafe ? COLORS.info : COLORS.crit}
                          strokeWidth={1.75}
                          fillOpacity={1}
                          fill="url(#colorLoadMobile)"
                          activeDot={{
                            r: 4,
                            stroke: COLORS.bg,
                            strokeWidth: 2,
                            fill: isSafe ? COLORS.info : COLORS.crit,
                          }}
                          isAnimationActive
                          animationDuration={700}
                          animationEasing="ease-out"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                  <Mono
                    tone="dim"
                    size="xs"
                    style={{
                      marginTop: 6,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      display: 'block',
                      textAlign: 'center',
                    }}
                  >
                    DRAG ACROSS CHART TO SCRUB · 15-MIN RESOLUTION
                  </Mono>
                </div>
              </TacticalCard>
            </div>

            {/* Quick Actions — horizontal scroll-snap row.
                Positioned AFTER Pulse Horizon and BEFORE the AI
                narrative because actions are higher-urgency than
                a paragraph but lower-urgency than the numeric
                state cards above. Swipe reveals the rest; this
                keeps buttons big instead of squishing them into
                a 3-col grid that wraps. */}
            <div>
              <SectionHeader id="QA" label="QUICK ACTIONS" />
              <div
                style={{
                  display: 'flex',
                  gap: SPACE.sm,
                  overflowX: 'auto',
                  scrollSnapType: 'x mandatory',
                  paddingBottom: SPACE.xs,
                  scrollbarWidth: 'none',
                }}
              >
                {[
                  {
                    icon: PhoneCall,
                    label: 'PAGE ON-CALL',
                    tone: 'info' as const,
                    haptic: 'light' as const,
                    action: () =>
                      showToast('Paging On-Call Physician...', 'info'),
                  },
                  {
                    icon: Flame,
                    label: 'CODE BLUE',
                    tone: 'crit' as const,
                    haptic: 'heavy' as const,
                    action: () => showToast('Code Blue Initiated', 'error'),
                  },
                  {
                    icon: ShieldAlert,
                    label: 'DIVERT STATUS',
                    tone: 'warn' as const,
                    haptic: 'medium' as const,
                    action: () =>
                      showToast('Divert status requested', 'info'),
                  },
                  {
                    icon: QrCode,
                    label: 'SCAN QR',
                    tone: 'info' as const,
                    haptic: 'light' as const,
                    action: () => setShowScanner(true),
                  },
                  {
                    icon: QrCode,
                    label: 'TEST QR',
                    tone: 'info' as const,
                    haptic: 'light' as const,
                    action: () => setShowTestQR(true),
                  },
                ].map((btn, qIdx) => {
                  const color =
                    btn.tone === 'info'
                      ? COLORS.info
                      : btn.tone === 'crit'
                      ? COLORS.crit
                      : COLORS.warn;
                  return (
                    <motion.button
                      key={btn.label}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        delay: 0.15 + qIdx * 0.05,
                        duration: MOTION.base,
                        ease: MOTION.ease,
                      }}
                      whileTap={{ scale: 0.95 }}
                      whileHover={{
                        background: COLORS.surfaceElev,
                        borderColor: color,
                      }}
                      onClick={() => {
                        triggerHaptic(btn.haptic);
                        btn.action();
                      }}
                      style={{
                        flexShrink: 0,
                        scrollSnapAlign: 'start',
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.sm,
                        minHeight: 44,
                        padding: `${SPACE.sm}px ${SPACE.md}px`,
                        background: COLORS.surface,
                        border: `1px solid ${color}`,
                        borderRadius: RADIUS.sm,
                        cursor: 'pointer',
                        fontFamily: FONTS.mono,
                        color,
                      }}
                    >
                      <btn.icon size={13} />
                      <span
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 11,
                          fontWeight: 500,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                        }}
                      >
                        {btn.label}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            {/* AI Shift Brief — narrative summary of the above.
                Positioned LAST on the dashboard because narrative is
                always less scannable than raw state. By the time an
                operator has read the state hero, live ops, horizon
                chart, and action buttons above, the brief is context,
                not answer. CONF · 94% removed — it was never plumbed
                to real confidence telemetry and just consumed real
                estate. */}
            <TacticalCard padding="none">
              <div
                style={{
                  position: 'relative',
                  padding: SPACE.base,
                  overflow: 'hidden',
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
                  <BrainCircuit
                    size={14}
                    strokeWidth={1.75}
                    color={COLORS.info}
                  />
                  <BracketLabel tone="secondary">AI SHIFT BRIEF</BracketLabel>
                </div>
                <p
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: TYPE.body.size,
                    fontWeight: 400,
                    lineHeight: 1.55,
                    color: COLORS.textPrimary,
                    margin: 0,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {isSurgeActive
                    ? `Surge protocol active for ${formatElapsed(
                        surgeActivatedAt,
                        time.getTime(),
                      )}. ${
                        urgentTasks.filter((t) => !t.acknowledgedBy).length
                      } of ${urgentTasks.length} urgent tasks pending. ER capacity at 115%. Divert status recommended.`
                    : 'Normal operations. ER wait time is 45m. ICU has 2 beds available. Staffing is optimal for current census.'}
                </p>
                <div
                  style={{
                    marginTop: SPACE.md,
                    paddingTop: SPACE.sm,
                    borderTop: `1px dashed ${COLORS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACE.sm,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Clock size={10} color={COLORS.textMuted} />
                    <Mono tone="dim">
                      SYNC{' '}
                      {time.toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </Mono>
                  </div>
                </div>
              </div>
            </TacticalCard>
          </motion.div>
        )}

        {/* ────── TASKS ─────────────────────────────────────── */}
        {activeTab === 'tasks' && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{
              padding: SPACE.base,
              paddingBottom: NAV_HEIGHT + SPACE['2xl'],
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.lg,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginTop: SPACE.xs,
              }}
            >
              <Mono tone="dim" size="xs">
                // PULSE / MOBILE / ACTIONS
              </Mono>
              <h1
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: TYPE.h1.size,
                  fontWeight: TYPE.h1.weight,
                  letterSpacing: TYPE.h1.tracking,
                  lineHeight: TYPE.h1.lineHeight,
                  color: COLORS.textPrimary,
                  margin: 0,
                }}
              >
                Actions Queue
              </h1>
            </div>

            {/* Urgent Surge Tasks */}
            {isSurgeActive && urgentTasks.length > 0 && (
              <TacticalCard padding="none" highlight>
                <div
                  style={{
                    padding: `${SPACE.md}px ${SPACE.base}px`,
                    borderBottom: `1px solid ${COLORS.accent}`,
                    background: `${COLORS.accent}10`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACE.sm,
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
                    <ShieldAlert
                      size={14}
                      color={COLORS.accent}
                      style={{
                        filter: `drop-shadow(0 0 6px ${COLORS.accent})`,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <BracketLabel tone="accent">SURGE TASKS</BracketLabel>
                      <Mono tone="muted" size="xs">
                        {urgentTasks.filter((t) => t.acknowledgedBy).length} /{' '}
                        {urgentTasks.length} ACK
                      </Mono>
                    </div>
                  </div>
                  {surgeActivatedAt && (
                    <Mono tone="accent" size="xs">
                      T+{formatElapsed(surgeActivatedAt, time.getTime())}
                    </Mono>
                  )}
                </div>
                {urgentTasks.map((task, i) => {
                  const acked = !!task.acknowledgedBy;
                  const ackedByMe = task.acknowledgedBy === myDeviceId;
                  return (
                    <motion.button
                      key={task.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: acked ? 0.55 : 1, x: 0 }}
                      transition={{
                        delay: i * 0.04,
                        duration: MOTION.base,
                        ease: MOTION.ease,
                      }}
                      whileTap={!acked ? { scale: 0.98 } : undefined}
                      onClick={() => {
                        if (!acked) {
                          triggerHaptic('medium');
                          onAcknowledgeTask(task.id, myDeviceId);
                          showToast('Task acknowledged', 'success');
                        }
                      }}
                      disabled={acked}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: SPACE.base,
                        minHeight: 72,
                        background: 'transparent',
                        border: 'none',
                        borderBottom:
                          i !== urgentTasks.length - 1
                            ? `1px solid ${COLORS.border}`
                            : 'none',
                        display: 'flex',
                        gap: SPACE.md,
                        cursor: acked ? 'default' : 'pointer',
                        fontFamily: FONTS.sans,
                        color: COLORS.textPrimary,
                      }}
                    >
                      <div style={{ flexShrink: 0, marginTop: 2 }}>
                        {acked ? (
                          <CheckCircle size={22} color={COLORS.ok} />
                        ) : (
                          <Circle size={22} color={COLORS.accent} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: SPACE.sm,
                            marginBottom: 6,
                          }}
                        >
                          <StatusPill
                            label={task.priority}
                            tone={task.priority === 'critical' ? 'crit' : 'warn'}
                            size="xs"
                          />
                          {task.role && (
                            <Mono tone="muted" size="xs">
                              {task.role}
                            </Mono>
                          )}
                        </div>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 15,
                            fontWeight: 600,
                            color: acked ? COLORS.textSecondary : COLORS.textPrimary,
                            letterSpacing: '-0.01em',
                            lineHeight: 1.3,
                            textDecoration: acked ? 'line-through' : 'none',
                            textDecorationColor: COLORS.ok,
                          }}
                        >
                          {task.title}
                        </div>
                        {task.description && (
                          <p
                            style={{
                              margin: `6px 0 0`,
                              fontFamily: FONTS.sans,
                              fontSize: TYPE.bodySm.size,
                              color: COLORS.textSecondary,
                              lineHeight: 1.45,
                            }}
                          >
                            {task.description}
                          </p>
                        )}
                        {acked && (
                          <div
                            style={{
                              marginTop: 8,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <CheckCircle size={10} color={COLORS.ok} />
                            <Mono tone="ok">
                              ACK {ackedByMe ? 'BY YOU' : `· ${task.acknowledgedBy?.slice(0, 6)}`}
                              {task.acknowledgedAt &&
                                ` · ${formatElapsed(task.acknowledgedAt, time.getTime())}`}
                            </Mono>
                          </div>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </TacticalCard>
            )}

            {/* Shift Progress */}
            <TacticalCard padding="none">
              <div
                style={{
                  padding: SPACE.base,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: SPACE.base,
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Mono tone="muted" size="xs">
                    SHIFT PROGRESS
                  </Mono>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 6,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 36,
                        fontWeight: 600,
                        letterSpacing: '-0.03em',
                        lineHeight: 1,
                        color: COLORS.textPrimary,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {completedTasks.length}
                    </span>
                    <Mono tone="dim" size="base">
                      / {ROLE_ACTIONS[currentUser.role]?.length || 0}
                    </Mono>
                  </div>
                  <Mono tone="ok">
                    {completedTasks.length > 0 ? 'ON PACE' : 'STANDBY'}
                  </Mono>
                </div>
                <ProgressRing progress={progressPercent} />
              </div>
            </TacticalCard>

            {/* Segmented Filter */}
            <div
              role="tablist"
              style={{
                display: 'flex',
                padding: 3,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                gap: 2,
              }}
            >
              {(['all', 'stat', 'routine'] as const).map((filter) => {
                const active = taskFilter === filter;
                return (
                  <button
                    key={filter}
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTaskFilter(filter)}
                    style={{
                      flex: 1,
                      minHeight: 40,
                      padding: `0 ${SPACE.md}px`,
                      background: active ? COLORS.surfaceElev : 'transparent',
                      border: `1px solid ${active ? COLORS.borderHover : 'transparent'}`,
                      borderRadius: RADIUS.sm,
                      cursor: 'pointer',
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: active ? COLORS.textPrimary : COLORS.textSecondary,
                      transition: `background ${MOTION.fast}s ease, color ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                    }}
                  >
                    {filter === 'stat' ? 'STAT' : filter.toUpperCase()}
                  </button>
                );
              })}
            </div>

            {/* Task List */}
            <TacticalCard padding="none">
              {myTasks.length === 0 ? (
                <div
                  style={{
                    padding: `${SPACE['2xl']}px ${SPACE.base}px`,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: SPACE.md,
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: COLORS.surfaceElev,
                      border: `1px solid ${COLORS.ok}`,
                      borderRadius: RADIUS.sm,
                      color: COLORS.ok,
                    }}
                  >
                    <CheckCircle size={24} />
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: TYPE.h4.size,
                      fontWeight: 600,
                      color: COLORS.textPrimary,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Queue Clear
                  </div>
                  <Mono tone="muted">ALL ACTIONS COMPLETE</Mono>
                </div>
              ) : (
                myTasks.map((task, i) => {
                  const priority = task.priority;
                  const priTone =
                    priority === 'High'
                      ? 'crit'
                      : priority === 'Medium'
                      ? 'warn'
                      : 'info';
                  return (
                    <div
                      key={task.id}
                      style={{
                        padding: SPACE.base,
                        minHeight: 72,
                        display: 'flex',
                        gap: SPACE.md,
                        alignItems: 'flex-start',
                        borderBottom:
                          i !== myTasks.length - 1
                            ? `1px solid ${COLORS.border}`
                            : 'none',
                      }}
                    >
                      <button
                        onClick={() => handleCompleteTask(task.id)}
                        aria-label="Mark complete"
                        style={{
                          flexShrink: 0,
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: COLORS.textMuted,
                          marginTop: 2,
                        }}
                      >
                        <Circle size={20} />
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: SPACE.sm,
                            marginBottom: 6,
                            flexWrap: 'wrap',
                          }}
                        >
                          <Mono tone="dim" size="xs">
                            {task.id.split('-')[0]}
                          </Mono>
                          <StatusPill label={task.priority} tone={priTone} size="xs" />
                        </div>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 15,
                            fontWeight: 600,
                            color: COLORS.textPrimary,
                            letterSpacing: '-0.01em',
                            lineHeight: 1.3,
                          }}
                        >
                          {task.title}
                        </div>
                        <div
                          style={{
                            marginTop: 6,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: SPACE.sm,
                          }}
                        >
                          <Mono tone="muted" size="xs">
                            OWNER · {task.owner}
                          </Mono>
                          <Mono tone="dim" size="xs">
                            DUE {task.dueTime}
                          </Mono>
                        </div>
                      </div>
                      <ChevronRight
                        size={16}
                        color={COLORS.textMuted}
                        style={{ flexShrink: 0, marginTop: 4 }}
                      />
                    </div>
                  );
                })
              )}
            </TacticalCard>
          </motion.div>
        )}

        {/* ────── PATIENTS ──────────────────────────────────── */}
        {activeTab === 'patients' && (
          <motion.div
            key="patients"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{
              padding: SPACE.base,
              paddingBottom: NAV_HEIGHT + SPACE['2xl'],
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.lg,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginTop: SPACE.xs,
              }}
            >
              <Mono tone="dim" size="xs">
                // PULSE / MOBILE /{' '}
                {currentUser.role === UserRole.MANAGER ? 'UNITS' : 'PATIENTS'}
              </Mono>
              <h1
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: TYPE.h1.size,
                  fontWeight: TYPE.h1.weight,
                  letterSpacing: TYPE.h1.tracking,
                  lineHeight: TYPE.h1.lineHeight,
                  color: COLORS.textPrimary,
                  margin: 0,
                }}
              >
                {currentUser.role === UserRole.MANAGER ? 'Unit Roster' : 'Assigned Patients'}
              </h1>
            </div>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <Search
                size={14}
                color={COLORS.textMuted}
                style={{
                  position: 'absolute',
                  left: SPACE.md,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none',
                }}
              />
              <input
                type="text"
                placeholder="SEARCH MRN OR NAME"
                style={{
                  width: '100%',
                  minHeight: 44,
                  padding: `0 ${SPACE.base}px 0 ${SPACE['2xl']}px`,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: COLORS.textPrimary,
                  outline: 'none',
                }}
              />
            </div>

            {/* Patient list */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.md,
              }}
            >
              {myPatients.map((patient, pIdx) => {
                const critical = patient.status === 'critical';
                const warning = patient.status === 'warning';
                const tone = critical ? 'crit' : warning ? 'warn' : 'ok';
                return (
                  <motion.div
                    key={patient.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: pIdx * 0.04,
                      duration: MOTION.base,
                      ease: MOTION.ease,
                    }}
                  >
                  <TacticalCard
                    interactive
                    highlight={critical}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPatient(patient)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedPatient(patient);
                      }
                    }}
                    padding="none"
                    style={{ cursor: 'pointer' }}
                  >
                    <div
                      style={{
                        padding: SPACE.base,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: SPACE.md,
                      }}
                    >
                      {/* Header row */}
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: SPACE.sm,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            minWidth: 0,
                            flex: 1,
                          }}
                        >
                          <Mono tone="dim" size="xs">
                            // {patient.mrn}
                          </Mono>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: SPACE.sm,
                            }}
                          >
                            <h3
                              style={{
                                fontFamily: FONTS.sans,
                                fontSize: 18,
                                fontWeight: 600,
                                color: COLORS.textPrimary,
                                letterSpacing: '-0.015em',
                                lineHeight: 1.2,
                                margin: 0,
                              }}
                            >
                              {patient.name}
                            </h3>
                            {critical && (
                              <Flame
                                size={14}
                                color={COLORS.crit}
                                style={{
                                  filter: `drop-shadow(0 0 6px ${COLORS.crit})`,
                                }}
                              />
                            )}
                          </div>
                          <Mono tone="muted" size="xs">
                            {patient.age} · {patient.code}
                          </Mono>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            gap: 6,
                            flexShrink: 0,
                          }}
                        >
                          <StatusPill
                            label={patient.loc}
                            tone="neutral"
                            size="xs"
                          />
                          <StatusPill
                            label={patient.status.toUpperCase()}
                            tone={tone}
                            pulse={critical}
                            size="xs"
                          />
                        </div>
                      </div>

                      <Divider variant="dashed" />

                      {/* Clinical notes */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <Stethoscope size={10} color={COLORS.textMuted} />
                          <Mono tone="muted" size="xs">
                            CLINICAL NOTES
                          </Mono>
                        </div>
                        <p
                          style={{
                            margin: 0,
                            fontFamily: FONTS.sans,
                            fontSize: TYPE.bodySm.size,
                            color: COLORS.textPrimary,
                            lineHeight: 1.45,
                          }}
                        >
                          {patient.notes}
                        </p>
                      </div>

                      {/* Vitals */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr 1fr',
                          gap: SPACE.sm,
                        }}
                      >
                        <VitalBox
                          label="HR"
                          value={patient.vitals.hr}
                          unit="bpm"
                          status={getHRStatus(patient.vitals.hr)}
                        />
                        <VitalBox
                          label="BP"
                          value={patient.vitals.bp}
                          unit="mmHg"
                          status={getBPStatus(patient.vitals.bp)}
                        />
                        <VitalBox
                          label="SpO2"
                          value={patient.vitals.o2}
                          unit="%"
                          status={getO2Status(patient.vitals.o2)}
                        />
                      </div>
                    </div>
                  </TacticalCard>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ────── ALERTS ────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <motion.div
            key="alerts"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{
              padding: SPACE.base,
              paddingBottom: NAV_HEIGHT + SPACE['2xl'],
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.lg,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                gap: SPACE.sm,
                marginTop: SPACE.xs,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <Mono tone="dim" size="xs">
                  // PULSE / MOBILE / ALERTS
                </Mono>
                <h1
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: TYPE.h1.size,
                    fontWeight: TYPE.h1.weight,
                    letterSpacing: TYPE.h1.tracking,
                    lineHeight: TYPE.h1.lineHeight,
                    color: COLORS.textPrimary,
                    margin: 0,
                  }}
                >
                  Alerts Feed
                </h1>
              </div>
              <Mono tone="muted" size="xs">
                {mockAlerts.filter((a) => a.unread).length} UNREAD
              </Mono>
            </div>

            <TacticalCard padding="none">
              {mockAlerts.map((alert, i) => {
                const tone: 'crit' | 'warn' | 'info' =
                  alert.type === 'critical'
                    ? 'crit'
                    : alert.type === 'warning'
                    ? 'warn'
                    : 'info';
                const toneColor =
                  tone === 'crit'
                    ? COLORS.crit
                    : tone === 'warn'
                    ? COLORS.warn
                    : COLORS.info;
                const Icon =
                  alert.type === 'critical'
                    ? Flame
                    : alert.type === 'warning'
                    ? AlertCircle
                    : Activity;
                return (
                  <motion.div
                    key={alert.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: i * 0.05,
                      duration: MOTION.base,
                      ease: MOTION.ease,
                    }}
                    style={{
                      padding: SPACE.base,
                      minHeight: 72,
                      display: 'flex',
                      gap: SPACE.md,
                      alignItems: 'flex-start',
                      borderBottom:
                        i !== mockAlerts.length - 1
                          ? `1px solid ${COLORS.border}`
                          : 'none',
                      background: alert.unread
                        ? `linear-gradient(90deg, ${toneColor}08 0%, transparent 40%)`
                        : 'transparent',
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: COLORS.surface,
                        border: `1px solid ${toneColor}`,
                        borderRadius: RADIUS.sm,
                        color: toneColor,
                        position: 'relative',
                      }}
                    >
                      <CornerBracket position="tl" color={toneColor} size={4} thickness={1} />
                      <CornerBracket position="br" color={toneColor} size={4} thickness={1} />
                      <Icon size={16} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'flex-start',
                          gap: SPACE.sm,
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 14,
                            fontWeight: alert.unread ? 600 : 500,
                            color: alert.unread
                              ? COLORS.textPrimary
                              : COLORS.textSecondary,
                            letterSpacing: '-0.01em',
                            lineHeight: 1.3,
                          }}
                        >
                          {alert.title}
                        </div>
                        <Mono tone="dim" size="xs">
                          {alert.time}
                        </Mono>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: FONTS.sans,
                          fontSize: TYPE.bodySm.size,
                          color: alert.unread
                            ? COLORS.textPrimary
                            : COLORS.textSecondary,
                          lineHeight: 1.45,
                        }}
                      >
                        {alert.desc}
                      </p>
                    </div>
                    {alert.unread && (
                      <div
                        aria-hidden
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: RADIUS.full,
                          background: toneColor,
                          boxShadow: `0 0 8px ${toneColor}`,
                          alignSelf: 'center',
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </motion.div>
                );
              })}
            </TacticalCard>
          </motion.div>
        )}

        {/* ────── COMMS ─────────────────────────────────────── */}
        {activeTab === 'comms' && (
          <motion.div
            key="comms"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{
              padding: SPACE.base,
              paddingBottom: NAV_HEIGHT + SPACE['2xl'],
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.lg,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
                marginTop: SPACE.xs,
              }}
            >
              <Mono tone="dim" size="xs">
                // PULSE / MOBILE / COMMS
              </Mono>
              <h1
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: TYPE.h1.size,
                  fontWeight: TYPE.h1.weight,
                  letterSpacing: TYPE.h1.tracking,
                  lineHeight: TYPE.h1.lineHeight,
                  color: COLORS.textPrimary,
                  margin: 0,
                }}
              >
                Comms Channel
              </h1>
            </div>

            {/* Active Threads — unread state reduced to a single dot
                marker on the right. Icon box now reflects the thread
                category (crit for trauma) instead of stacking brand
                accent on top of a critical icon. */}
            <div>
              <SectionHeader id="CH" label="ACTIVE THREADS" />
              <TacticalCard padding="none">
                <div
                  style={{
                    padding: SPACE.base,
                    minHeight: 72,
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.md,
                    borderBottom: `1px solid ${COLORS.border}`,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: COLORS.surfaceElev,
                      border: `1px solid ${COLORS.crit}`,
                      borderRadius: RADIUS.sm,
                      color: COLORS.crit,
                      position: 'relative',
                    }}
                  >
                    <AlertCircle size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: SPACE.sm,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 14,
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                          letterSpacing: '-0.01em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Trauma Team Alpha
                      </div>
                      <Mono tone="dim" size="xs">
                        2M
                      </Mono>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: FONTS.sans,
                        fontSize: TYPE.bodySm.size,
                        color: COLORS.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Dr. Jenkins: Patient stabilized, moving to CT.
                    </p>
                  </div>
                  <div
                    aria-hidden
                    title="Unread"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: RADIUS.full,
                      background: COLORS.info,
                      flexShrink: 0,
                    }}
                  />
                </div>
                <div
                  style={{
                    padding: SPACE.base,
                    minHeight: 72,
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.md,
                    cursor: 'pointer',
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      color: COLORS.textSecondary,
                    }}
                  >
                    <Stethoscope size={16} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: SPACE.sm,
                        marginBottom: 4,
                      }}
                    >
                      <div
                        style={{
                          fontFamily: FONTS.sans,
                          fontSize: 14,
                          fontWeight: 500,
                          color: COLORS.textSecondary,
                          letterSpacing: '-0.01em',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Pharmacy Consults
                      </div>
                      <Mono tone="dim" size="xs">
                        15M
                      </Mono>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: FONTS.sans,
                        fontSize: TYPE.bodySm.size,
                        color: COLORS.textMuted,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Pharm: Vanco trough is 14.2, dose is good.
                    </p>
                  </div>
                  <ChevronRight
                    size={14}
                    color={COLORS.textMuted}
                    style={{ flexShrink: 0 }}
                  />
                </div>
              </TacticalCard>
            </div>

            {/* Quick Page */}
            <div>
              <SectionHeader id="QP" label="QUICK PAGE" />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: SPACE.sm,
                }}
              >
                {[
                  { icon: Stethoscope, label: 'CHARGE', code: 'C01' },
                  { icon: Activity, label: 'PHARM', code: 'P02' },
                  { icon: HeartPulse, label: 'BLOOD', code: 'B03' },
                  { icon: ShieldAlert, label: 'SEC', code: 'S04' },
                ].map((btn) => (
                  <button
                    key={btn.code}
                    onClick={() => showToast(`Paging ${btn.label}...`, 'info')}
                    style={{
                      position: 'relative',
                      aspectRatio: '1',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      minHeight: 72,
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      cursor: 'pointer',
                      color: COLORS.textSecondary,
                      transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
                    }}
                  >
                    <CornerBracket
                      position="tl"
                      color={COLORS.borderStrong}
                      size={5}
                      thickness={1}
                    />
                    <CornerBracket
                      position="br"
                      color={COLORS.borderStrong}
                      size={5}
                      thickness={1}
                    />
                    <btn.icon size={18} />
                    <Mono tone="secondary" size="xs">
                      {btn.label}
                    </Mono>
                  </button>
                ))}
              </div>
            </div>

            {/* Broadcast */}
            <TacticalButton
              variant="danger"
              fullWidth
              size="md"
              icon={<Radio size={14} />}
              onClick={() =>
                showToast('Emergency broadcast sent to all units', 'error')
              }
              style={{ height: 52, marginTop: SPACE.sm }}
            >
              Broadcast Emergency
            </TacticalButton>
          </motion.div>
        )}
      </main>

      {/* ── BOTTOM HUD TAB BAR ────────────────────────────────── */}
      <nav
        style={{
          position: 'relative',
          flexShrink: 0,
          zIndex: 40,
          background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.bg} 100%)`,
          borderTop: `1px solid ${COLORS.borderStrong}`,
          // Horizontal padding keeps active-tab corner brackets from
          // clipping the screen edge on the outermost tabs.
          padding: `${SPACE.xs}px ${SPACE.sm}px ${SPACE.xs}px`,
          paddingBottom: `max(env(safe-area-inset-bottom), ${SPACE.xs}px)`,
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${navItems.length}, 1fr)`,
            gap: 2,
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          {navItems.map((item) => {
            const active = activeTab === item.id;
            const Icon = item.icon;
            const hasBadge =
              (item.id === 'tasks' && myTasks.length > 0) || item.id === 'alerts';
            const badgeTone =
              item.id === 'tasks' ? COLORS.accent : COLORS.info;
            return (
              <motion.button
                key={item.id}
                onClick={() => {
                  if (!active) triggerHaptic('medium');
                  setActiveTab(item.id);
                }}
                aria-label={item.label}
                aria-pressed={active}
                whileTap={{ scale: 0.92 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                style={{
                  position: 'relative',
                  minHeight: 44,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: `${SPACE.xs}px 2px`,
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: RADIUS.sm,
                  cursor: 'pointer',
                  color: active ? COLORS.textPrimary : COLORS.textMuted,
                  transition: `color ${MOTION.fast}s ease`,
                }}
              >
                {/* Active indicator — shared layout morphs between tabs */}
                {active && (
                  <motion.span
                    layoutId="mobile-nav-active-frame"
                    aria-hidden
                    transition={{
                      type: 'spring',
                      stiffness: 520,
                      damping: 38,
                      mass: 0.8,
                    }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: COLORS.surfaceElev,
                      border: `1px solid ${COLORS.borderHover}`,
                      borderRadius: RADIUS.sm,
                      pointerEvents: 'none',
                    }}
                  >
                    <CornerBracket
                      position="tl"
                      color={COLORS.borderHover}
                      size={4}
                      thickness={1.5}
                    />
                    <CornerBracket
                      position="tr"
                      color={COLORS.borderHover}
                      size={4}
                      thickness={1.5}
                    />
                    <CornerBracket
                      position="bl"
                      color={COLORS.borderHover}
                      size={4}
                      thickness={1.5}
                    />
                    <CornerBracket
                      position="br"
                      color={COLORS.borderHover}
                      size={4}
                      thickness={1.5}
                    />
                  </motion.span>
                )}
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <Icon
                    size={16}
                    strokeWidth={active ? 2.25 : 1.75}
                  />
                  {hasBadge && (
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        top: -3,
                        right: -4,
                        width: 5,
                        height: 5,
                        borderRadius: RADIUS.full,
                        background: badgeTone,
                        boxShadow: `0 0 5px ${badgeTone}`,
                      }}
                    />
                  )}
                </div>
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    fontFamily: FONTS.mono,
                    fontSize: 8,
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    lineHeight: 1,
                  }}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          })}
        </div>
      </nav>

      {/* Patient Detail Overlay */}
      {selectedPatient && (
        <PatientDetailScreen
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
          onSave={() => showToast('Patient record updated', 'success')}
          showToast={showToast}
        />
      )}

      {/* QR Scanner — fullscreen camera view. Animates in/out via
          AnimatePresence so the unmount transition completes before
          we release the camera stream. */}
      <AnimatePresence>
        {showScanner && (
          <QRScannerModal
            onClose={() => setShowScanner(false)}
            onScan={handleQRScan}
          />
        )}
      </AnimatePresence>

      {/* Test QR display — renders a scannable code for
          pulse://tab/patients so the user can exercise the scanner
          from a second device (laptop screen, other phone, etc). */}
      <AnimatePresence>
        {showTestQR && (
          <TestQRModal
            payload="pulse://tab/patients"
            label="OPEN PATIENTS TAB"
            sublabel="Scan from another device to jump to the Patients view"
            onClose={() => setShowTestQR(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
