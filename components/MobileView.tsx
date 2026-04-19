import React, { useState, useEffect, useMemo } from 'react';
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
  ClipboardList,
  UserPlus,
  DoorOpen,
  FileText,
  Pill,
  Siren,
  ArrowRightLeft,
  Network,
  SlidersHorizontal,
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
import QRCode from 'qrcode';
import { UserProfile, UserRole } from '../types';
import type { Patient, ClinicalNote } from '../types';
import type { AdmissionEntry } from './clinical';
import type { BraceletPool } from '../lib/braceletPool';
import { parseBraceletPayload, findSlot } from '../lib/braceletPool';
import {
  publish,
  usePresenceMeta,
  useRealtimeState,
  getDeviceId,
  useConnectionStatus,
  getDeviceName,
} from '../lib/realtime';
import { SendToSheet } from './SendToSheet';
import { EmptyBraceletSheet } from './EmptyBraceletSheet';
import { ROLE_ACTIONS, ROLE_METRICS } from '../data/userProfiles';
import { MOCK_PATIENTS, ageInYears } from '../data/clinicalMock';
import { computeMEWS } from '../lib/clinicalScores';
import { PatientDetailScreen } from './PatientDetailScreen';
import { MobilePatientDetailScreen } from './MobilePatientDetailScreen';
import { MobileAdmitFlow } from './MobileAdmitFlow';
import {
  EmsInboundBoard,
  BedBoard,
  DischargeFlow,
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
import { QRScannerModal } from './QRScannerModal';
import { TestQRModal } from './TestQRModal';
import { PatientQRCard } from './PatientQRCard';
import { PrintPreviewModal } from './PrintPreviewModal';
import { triggerHaptic } from '../lib/haptics';
import { useRealtimeSimulation } from '../lib/useRealtimeSimulation';
import { useEmsInbound } from '../lib/emsLive';
import type { UrgentTask } from '../lib/surgeTaskTemplates';
import { MobileLiveOps } from './MobileLiveOps';
import { MobileCoordination } from './MobileCoordination';
import { MobileScreenHeader } from './MobileScreenHeader';
import { BedSingle } from 'lucide-react';
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
  ConfidenceBadge,
  EmptyState,
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
  onOpenSettings?: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  onOpenChat: (query?: string) => void;
  systemStatus?: 'normal' | 'stale' | 'manual';
  // ── Cross-device shared state & callbacks ──
  bedUnits?: BedUnit[];
  admissionQueue?: AdmissionEntry[];
  patients?: Patient[];
  clinicalNotes?: ClinicalNote[];
  alertAcks?: Record<string, { status: string; actor: string; at: string }>;
  /** Full bracelet pool — 20 slots. Used by the QR scan router to find out
   *  what patient (if any) a bracelet is linked to, and by the admit flow
   *  to show which numbers are still up for grabs. */
  braceletPool?: BraceletPool;
  /** Convenience — `availableNumbers(braceletPool)`. Pre-computed in App.tsx
   *  and threaded down so MobileAdmitFlow's dropdown doesn't have to
   *  re-derive it. */
  availableBraceletNumbers?: string[];
  onAssignBed?: (admissionId: string, bedId: string) => void;
  onSubmitAdmission?: (entry: Omit<AdmissionEntry, 'id' | 'status' | 'waitMin' | 'requestedAt'>, bedId?: string) => void;
  onDischargePatient?: (patientId: string) => void;
  onUpdateVitals?: (patientId: string, vitals: Omit<import('../types').Vital, 'id' | 'timestamp'>) => void;
  onAddNote?: (note: Omit<ClinicalNote, 'id' | 'createdAt'>) => void;
  onAcknowledgeAlert?: (alertId: string, actor: string) => void;
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
// TestQRInlineCard — compact always-visible scannable target.
//
// Renders a 96x96 QR plate alongside a short explanation. The whole
// card is a button that expands to the fullscreen TestQRModal on tap
// so the user can zoom in when they want to scan from a second device.
// The inline size is deliberately small (this is a dev/test affordance,
// not product chrome) but still large enough to be decoded by another
// phone from ~20cm away.
// ─────────────────────────────────────────────────────────────────────────
interface TestQRInlineCardProps {
  payload: string;
  label: string;
  sublabel: string;
  onExpand: () => void;
}

const TestQRInlineCard: React.FC<TestQRInlineCardProps> = ({
  payload,
  label,
  sublabel,
  onExpand,
}) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 320,
      color: {
        dark: '#050505',
        light: '#FAFAFA',
      },
    })
      .then((url) => {
        if (alive) setDataUrl(url);
      })
      .catch(() => {
        // Silent failure — card will just show empty plate.
      });
    return () => {
      alive = false;
    };
  }, [payload]);

  return (
    <button
      type="button"
      onClick={() => {
        triggerHaptic('light');
        onExpand();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.md,
        width: '100%',
        padding: SPACE.base,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
      }}
      aria-label={`${label} — tap to enlarge`}
    >
      {/* White plate containing the QR — white is required for
          reliable decoding by camera-based scanners. */}
      <div
        style={{
          width: 96,
          height: 96,
          flexShrink: 0,
          background: '#FAFAFA',
          padding: 6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: RADIUS.sm,
        }}
      >
        {dataUrl ? (
          <img
            src={dataUrl}
            alt="Test QR code"
            width={84}
            height={84}
            style={{
              imageRendering: 'pixelated',
              display: 'block',
              width: 84,
              height: 84,
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 10,
              color: COLORS.textMuted,
            }}
          >
            …
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <BracketLabel tone="info">{label}</BracketLabel>
        <div
          style={{
            marginTop: 4,
            fontFamily: FONTS.sans,
            fontSize: 15,
            fontWeight: 500,
            color: COLORS.textPrimary,
            letterSpacing: '-0.005em',
            lineHeight: 1.3,
          }}
        >
          {sublabel}
        </div>
        <div
          style={{
            marginTop: SPACE.xs,
            fontFamily: FONTS.mono,
            fontSize: 11,
            fontWeight: 500,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: COLORS.textMuted,
          }}
        >
          TAP TO ENLARGE
        </div>
      </div>
    </button>
  );
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
            fontSize: 28,
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
            fontSize: 22,
            fontWeight: 600,
            color: COLORS.textPrimary,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(progress)}
          <span style={{ fontSize: 13, color: COLORS.textMuted, marginLeft: 2 }}>
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
            fontSize: 34,
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
                  fontSize: 24,
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
                fontSize: 15,
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
  onOpenSettings,
  showToast,
  onOpenChat,
  systemStatus = 'normal',
  bedUnits: sharedBedUnits,
  admissionQueue,
  patients: sharedPatients,
  clinicalNotes,
  alertAcks,
  braceletPool,
  availableBraceletNumbers = [],
  onAssignBed,
  onSubmitAdmission,
  onDischargePatient,
  onUpdateVitals,
  onAddNote,
  onAcknowledgeAlert,
}) => {
  const [activeTab, setActiveTab] = useState<
    'horizon' | 'patients' | 'actions' | 'alerts' | 'comms'
  >('horizon');
  const [showMenu, setShowMenu] = useState(false);
  const [completedTasks, setCompletedTasks] = useState<string[]>([]);
  const [taskFilter, setTaskFilter] = useState<'all' | 'stat' | 'routine'>('all');
  const [time, setTime] = useState(new Date());
  const [selectedPatient, setSelectedPatient] = useState<any | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [showTestQR, setShowTestQR] = useState(false);
  // When set, renders the patient QR print-preview modal for this patient.
  const [showPrintPatientQR, setShowPrintPatientQR] = useState<Patient | null>(null);
  /**
   * EMS board fullscreen overlay state — every role can pop it open
   * via a launcher card on the Patients tab. ER personnel also see
   * the same board inline on the Dashboard tab as a tile.
   */
  const [showEmsBoard, setShowEmsBoard] = useState(false);

  /**
   * Bed Board state — prefer shared state from App.tsx (single source of truth
   * for cross-device sync), fall back to local realtime subscription.
   */
  const [localBedUnits] = useRealtimeState<BedUnit[]>('bed-units', seedBedState());
  const [localPatients] = useRealtimeState<Patient[]>('patients', [...MOCK_PATIENTS]);
  const bedUnits = sharedBedUnits ?? localBedUnits;
  const syncedPatients = sharedPatients ?? localPatients;
  const [showBedBoard, setShowBedBoard] = useState(false);
  const [patientsSubTab, setPatientsSubTab] = useState<'list' | 'bedboard'>('list');
  const [patientSearch, setPatientSearch] = useState('');
  const [patientFilter, setPatientFilter] = useState<'all' | 'critical' | 'warning' | 'ed' | 'inpatient'>('all');

  /**
   * MY PATIENTS section (bottom of Patients page) — unifies the retired
   * Rounding List into a role-scoped worklist. Sort toggles between
   * alphabetical (by last name) and acuity (MEWS score). Each row
   * expands to an SBAR drawer so clinicians can orient fast without
   * opening the full patient screen.
   */
  const [myPatientsSort, setMyPatientsSort] = useState<'alpha' | 'acuity'>('acuity');
  const [expandedMyPatientId, setExpandedMyPatientId] = useState<string | null>(null);

  /** Admit / Discharge fullscreen flow wizards. */
  const [showAdmitFlow, setShowAdmitFlow] = useState(false);
  /** When the user scans an empty bracelet, we open the admit flow with
   *  this number pre-selected so they don't have to pick it again. Clears
   *  back to '' whenever the admit flow closes. */
  const [prefilledBraceletNumber, setPrefilledBraceletNumber] = useState('');
  /** Prompt shown when the user scans an unassigned (empty) bracelet —
   *  offers "Admit with this bracelet" or "Cancel". */
  const [emptyBraceletPrompt, setEmptyBraceletPrompt] = useState<string | null>(null);
  /** Send-to-device sheet — when open, carries the patient id being
   *  broadcast. Multi-select device picker. */
  const [sendToPatientId, setSendToPatientId] = useState<string | null>(null);
  const [showDischargeFlow, setShowDischargeFlow] = useState(false);
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [showOrderEntry, setShowOrderEntry] = useState(false);
  const [showCodeBlue, setShowCodeBlue] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [showMessaging, setShowMessaging] = useState(false);
  const [showWorkforce, setShowWorkforce] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showDeptCoord, setShowDeptCoord] = useState(false);
  const [showBriefMe, setShowBriefMe] = useState(false);

  const myDeviceId = getDeviceId();

  // Live-updating hospital metrics (jitter every ~5s, surge-aware)
  const liveMetrics = useRealtimeSimulation({ active: true, surgeActive: isSurgeActive });

  // Live EMS inbound — shared data source between the hero subtitle
  // ("3 EMS INBOUND <5MIN") and the dedicated EmsInboundBoard below.
  // Two hook instances tick independently but seed from the same mock
  // and subscribe to the same broadcasts, so they stay within ~1s of
  // each other — good enough for a minute-grain count.
  const { inbound: liveEmsInbound } = useEmsInbound();

  // ── StateHero derived counts ─────────────────────────────────────────
  // The dashboard hero used to ship hardcoded strings ("232 / 284
  // OCCUPIED", "0 bays", "2 FALL RISK · 3 DISCHARGES PENDING"). Now we
  // compute them from `bedUnits` (the ground truth) + liveMetrics (the
  // jitter-sim) so the hero breathes as the simulation runs and reacts
  // when surge reshapes the bed state. Cheap to recompute — bedUnits
  // updates maybe every few seconds, patients rarely.
  const heroDerived = useMemo(() => {
    const visibleUnits = isSurgeActive
      ? bedUnits
      : bedUnits.filter((u) => !u.surgeOnly);
    const allBeds = visibleUnits.flatMap((u) => u.beds);
    const occupiedCount = allBeds.filter((b) => b.state === 'occupied').length;
    const totalBeds = allBeds.length;
    const edAcute = bedUnits.find((u) => u.id === 'ed-acute');
    const edHoldsWaiting = edAcute
      ? edAcute.beds.filter((b) => b.state === 'occupied').length
      : 0;
    const traumaUnit = bedUnits.find((u) => u.id === 'ed-trauma');
    const traumaBaysOpen = traumaUnit
      ? traumaUnit.beds.filter((b) => b.state === 'ready').length
      : 0;
    const dischargesPending = allBeds.filter(
      (b) => b.dischargeMilestones?.dcOrderWritten === true,
    ).length;
    // Fall-risk heuristic: occupied beds with moderate-to-low acuity
    // AND long length of stay — proxy for elderly boarding patients,
    // which correlates with fall risk in real EDs. Stays stable for
    // the demo but grounded in real bed data.
    const fallRisk = allBeds.filter(
      (b) =>
        b.state === 'occupied' &&
        (b.acuity ?? 5) >= 3 &&
        (b.losHours ?? 0) >= 36,
    ).length;
    // Overdue reassessments derived from avgMews + pendingAdmits so the
    // number drifts with the live sim (higher during surge). Floor at 2
    // so it never reads 0 during a live shift.
    const overdueReassessments = Math.max(
      2,
      Math.round(liveMetrics.avgMews + liveMetrics.pendingAdmits / 2),
    );
    // Inbound EMS runs that are <5 minutes out. Reading from the live
    // feed keeps this in sync with what the EmsInboundBoard is showing
    // on the same dashboard.
    const inboundEms = liveEmsInbound.filter(
      (r) => !r.arrived && r.etaMinutes <= 5,
    ).length;
    return {
      occupiedCount,
      totalBeds,
      edHoldsWaiting,
      traumaBaysOpen,
      dischargesPending,
      fallRisk,
      overdueReassessments,
      inboundEms,
    };
  }, [
    bedUnits,
    liveMetrics.avgMews,
    liveMetrics.pendingAdmits,
    liveEmsInbound,
    isSurgeActive,
  ]);

  /**
   * QR scan handler. Parses `pulse://` deep-link payloads.
   *
   * Supported schemes today:
   *   pulse://tab/<tabname>       → jump to the named tab
   *   pulse://patient/<id>?...     → open that patient's detail screen
   *   pulse://bracelet/<n>         → route by pool slot state:
   *       · admitted  → open linked patient's chart
   *       · empty     → prompt "Admit with this bracelet?" (SCAD demo)
   *
   * The patient URL carries `mrn` and `name` query params so a
   * receiving device without the patient in its local store can still
   * surface a useful fallback toast.
   *
   * Unknown payloads close the scanner and show a toast preview of
   * the raw string so the user can see *something* scanned.
   */
  const handleQRScan = (payload: string) => {
    if (payload.startsWith('pulse://tab/')) {
      const tab = payload.slice('pulse://tab/'.length).split(/[?#/]/)[0];
      if (
        tab === 'horizon' ||
        tab === 'actions' ||
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

    if (payload.startsWith('pulse://patient/')) {
      const rest = payload.slice('pulse://patient/'.length);
      const id = rest.split(/[?#/]/)[0];
      const patient = syncedPatients.find((p) => p.id === id);
      if (patient) {
        setSelectedPatient(adaptPatientForList(patient));
        setShowScanner(false);
        triggerHaptic('medium');
        showToast(
          `OPENED ${patient.name.family.toUpperCase()}, ${patient.name.given.toUpperCase()}`,
          'success',
        );
        return;
      }
      // Fallback — decode the query string for a friendlier message.
      const qIdx = rest.indexOf('?');
      const params = new URLSearchParams(qIdx >= 0 ? rest.slice(qIdx + 1) : '');
      const name = params.get('name');
      const mrn = params.get('mrn');
      setShowScanner(false);
      showToast(
        `PATIENT NOT IN LOCAL STORE: ${name || mrn || id}`,
        'error',
      );
      return;
    }

    // Bracelet QR — pulse://bracelet/<two-digit-number>.
    // If the slot is linked to a patient, open that chart. If the slot is
    // empty (or the pool doesn't know about the number yet), offer to
    // admit a new patient with this bracelet pre-selected.
    const braceletNumber = parseBraceletPayload(payload);
    if (braceletNumber) {
      const slot = braceletPool ? findSlot(braceletPool, braceletNumber) : undefined;
      if (slot && slot.status === 'admitted' && slot.patientId) {
        const patient = syncedPatients.find((p) => p.id === slot.patientId);
        if (patient) {
          setSelectedPatient(adaptPatientForList(patient));
          setShowScanner(false);
          triggerHaptic('medium');
          showToast(
            `BRACELET #${braceletNumber} · ${patient.name.family.toUpperCase()}`,
            'success',
          );
          return;
        }
        // Linked but patient record missing (deleted?) — fall through.
      }
      // Empty slot — open the "admit with this bracelet?" prompt.
      setShowScanner(false);
      setEmptyBraceletPrompt(braceletNumber);
      triggerHaptic('medium');
      return;
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

  // Adapter — takes a canonical FHIR-aligned Patient and projects it
  // into the shape the mobile patient-list card expects. We keep the
  // legacy display fields (name/age/mrn/loc/code/notes/vitals/trends)
  // for drop-in compatibility, AND attach the full `Patient` as
  // `clinical` so PatientDetailScreen can render the new
  // PatientHeaderStrip + VitalsPanel when the user taps in.
  //
  // Status bucketing uses the latest MEWS — the nurse's eye is on
  // "how sick is this patient right now", and MEWS is a pragmatic
  // bedside proxy that the existing tile rendering can key off.
  const adaptPatientForList = (p: Patient) => {
    const latest = p.vitalsHistory[p.vitalsHistory.length - 1];
    const trendWindow = p.vitalsHistory.slice(-6);
    const mews = latest ? computeMEWS(latest) : null;
    const status =
      !mews ? 'normal' : mews.risk === 'critical' || mews.risk === 'high' ? 'critical' : mews.risk === 'moderate' ? 'warning' : 'normal';

    const age = ageInYears(p.birthDate);
    const encounter = p.currentEncounter;
    const loc = encounter?.location?.bed
      ? encounter.location.bed
      : encounter?.location?.zone ?? '—';

    return {
      id: p.id,
      name: `${p.name.family}, ${p.name.given}`,
      age: `${age}${p.sex}`,
      mrn: p.mrn,
      loc,
      status,
      code: p.codeStatus === 'FULL' ? 'FULL CODE' : p.codeStatus,
      notes: encounter?.chiefComplaint ?? '—',
      vitals: {
        hr: latest?.heartRate != null ? String(latest.heartRate) : '—',
        bp:
          latest?.systolic != null && latest?.diastolic != null
            ? `${latest.systolic}/${latest.diastolic}`
            : '—',
        o2: latest?.spO2 != null ? String(latest.spO2) : '—',
      },
      trends: {
        hr: trendWindow.map((v) => v.heartRate ?? 0),
        bp: trendWindow.map((v) => v.systolic ?? 0),
        o2: trendWindow.map((v) => v.spO2 ?? 0),
      },
      /** Canonical FHIR-aligned patient — PatientDetailScreen reads this. */
      clinical: p,
    };
  };

  // Show ALL patients on the Patients tab (not just role-scoped). The
  // Patients tab is the floor-wide roster — filters + search narrow it
  // down on demand. The old `myPatients` role-scoped list is preserved
  // below for use by the older tasks list / dashboard snippets.
  const allAdaptedPatients = useMemo(
    () => syncedPatients.map(adaptPatientForList),
    [syncedPatients],
  );

  const filteredPatients = useMemo(() => {
    const q = patientSearch.trim().toLowerCase();
    return allAdaptedPatients.filter((p) => {
      // Filter pill
      if (patientFilter === 'critical' && p.status !== 'critical') return false;
      if (patientFilter === 'warning' && p.status !== 'warning') return false;
      if (patientFilter === 'ed' && p.clinical.currentEncounter?.class !== 'EMERGENCY') return false;
      if (patientFilter === 'inpatient' && p.clinical.currentEncounter?.class === 'EMERGENCY') return false;
      // Search — name, MRN, bed/location, chief complaint
      if (q) {
        const hay = [
          p.name,
          p.mrn,
          p.loc,
          p.notes,
          p.code,
        ].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allAdaptedPatients, patientSearch, patientFilter]);

  // Legacy role-scoped list retained for dashboard/tasks snippets that
  // still use `myPatients`. Patients tab now uses `filteredPatients`.
  const myPatients = useMemo(() => {
    const pool =
      currentUser.role === UserRole.ER_PERSONNEL
        ? syncedPatients.filter((p) => p.currentEncounter?.class === 'EMERGENCY')
        : syncedPatients.filter((p) => p.currentEncounter?.class !== 'EMERGENCY');
    return pool.map(adaptPatientForList);
  }, [syncedPatients, currentUser.role]);

  /**
   * MY PATIENTS — role-scoped worklist for Nurse / ER Personnel / Trauma.
   * Manager (= Operations Director) sees all patients in the main list
   * above and should NOT get this section. Each entry is enriched with
   * MEWS score so acuity sort can rank by early-warning severity.
   */
  const myPatientsScoped = useMemo(() => {
    if (currentUser.role === UserRole.MANAGER) return [];
    const pool =
      currentUser.role === UserRole.ER_PERSONNEL || currentUser.role === UserRole.TRAUMA
        ? syncedPatients.filter((p) => p.currentEncounter?.class === 'EMERGENCY')
        : syncedPatients.filter((p) => p.currentEncounter?.class !== 'EMERGENCY');
    return pool
      .filter((p) => p.currentEncounter?.status === 'in-progress' || p.currentEncounter?.status === 'arrived')
      .map((p) => {
        const lastVital = p.vitalsHistory[p.vitalsHistory.length - 1];
        const mews = lastVital ? computeMEWS(lastVital).value : 0;
        return { patient: p, mews, lastVital };
      });
  }, [syncedPatients, currentUser.role]);

  const myPatientsSorted = useMemo(() => {
    const arr = [...myPatientsScoped];
    if (myPatientsSort === 'acuity') {
      arr.sort((a, b) => b.mews - a.mews);
    } else {
      arr.sort((a, b) => a.patient.name.family.localeCompare(b.patient.name.family));
    }
    return arr;
  }, [myPatientsScoped, myPatientsSort]);

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

  // Bed state is now synced via useRealtimeState — surge escalation
  // is handled centrally in App.tsx activateSurge/deactivateSurge.

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
      title: 'Fall Risk — Bed 4A',
      desc: 'Martinez, R. attempted unassisted ambulation. Bed alarm triggered.',
      time: '8m ago',
      unread: true,
      type: 'warning' as const,
    },
    {
      id: 4,
      title: 'Pharmacy Update',
      desc: 'Vanco shortage, use alternative protocols as per guidelines.',
      time: '1h ago',
      unread: false,
      type: 'info' as const,
    },
    {
      id: 5,
      title: 'Staffing Coverage Gap',
      desc: 'Night shift RN call-out for Unit 3B. Float pool notified.',
      time: '2h ago',
      unread: false,
      type: 'info' as const,
    },
  ];

  const handleCompleteTask = (id: string) => {
    setCompletedTasks((prev) => [...prev, id]);
    showToast('Task marked complete', 'success');
  };

  const navItems = useMemo(() => {
    const isNurse = currentUser.role === UserRole.NURSE;
    return [
      { id: 'horizon' as const, icon: Activity, label: 'Horizon', code: 'HRZ' },
      { id: 'patients' as const, icon: Users, label: currentUser.role === UserRole.MANAGER ? 'Coord' : 'Patients', code: currentUser.role === UserRole.MANAGER ? 'CRD' : 'PAT' },
      isNurse
        ? { id: 'actions' as const, icon: CheckCircle2, label: 'Actions', code: 'ACT' }
        : { id: 'actions' as const, icon: Radio, label: 'Live Ops', code: 'OPS' },
      { id: 'alerts' as const, icon: Bell, label: 'Alerts', code: 'ALR' },
      { id: 'comms' as const, icon: MessageSquare, label: 'Comms', code: 'COM' },
    ];
  }, [currentUser.role]);

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
            size={15}
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
              fontSize: 14,
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
                fontSize: 16,
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
                style={{ fontSize: 11, letterSpacing: '0.12em' }}
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
              height: 44,
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
            <BrainCircuit size={18} strokeWidth={1.75} />
          </motion.button>
          <motion.button
            onClick={() => {
              triggerHaptic('light');
              setShowScanner(true);
            }}
            aria-label="Open QR scanner"
            whileTap={{ scale: 0.92 }}
            whileHover={{ borderColor: COLORS.accent }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: COLORS.accent,
              cursor: 'pointer',
            }}
          >
            <QrCode size={18} strokeWidth={1.75} />
          </motion.button>
          <motion.button
            onClick={() => setShowMenu(!showMenu)}
            aria-label={showMenu ? 'Close menu' : 'Open menu'}
            whileTap={{ scale: 0.92 }}
            whileHover={{ borderColor: COLORS.borderHover }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
            style={{
              width: 44,
              height: 44,
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
                {showMenu ? <X size={18} /> : <Menu size={18} />}
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
                  fontSize: 12,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  fontWeight: 500,
                }}
              >
                <ChevronLeft size={14} strokeWidth={2} />
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
              initial={{ opacity: 0 }}
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
                        fontSize: 17,
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
              initial={{ opacity: 0 }}
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
                        fontSize: 17,
                        fontWeight: 600,
                        color: COLORS.textPrimary,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      Performance Metrics
                    </div>
                    <Mono tone="muted">Shift data · KPIs</Mono>
                  </div>
                  <ChevronRight size={18} color={COLORS.textMuted} />
                </div>
              </TacticalCard>
            </motion.div>

            {/* Settings — opens the full-screen settings overlay (demo
                controls, reset, sign out). Only render when App.tsx wired
                the handler so older callers don't break. */}
            {onOpenSettings && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: MOTION.base, ease: MOTION.ease }}
                style={{ position: 'relative', zIndex: 1 }}
              >
                <TacticalCard
                  interactive
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    triggerHaptic('light');
                    setShowMenu(false);
                    onOpenSettings();
                  }}
                  onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      triggerHaptic('light');
                      setShowMenu(false);
                      onOpenSettings();
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
                        color: COLORS.textSecondary,
                      }}
                    >
                      <SlidersHorizontal size={20} />
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
                          fontSize: 17,
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        Settings
                      </div>
                      <Mono tone="muted">Session · Reset · Sign Out</Mono>
                    </div>
                    <ChevronRight size={18} color={COLORS.textMuted} />
                  </div>
                </TacticalCard>
              </motion.div>
            )}

            <div style={{ flex: 1 }} />

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: MOTION.base, ease: MOTION.ease }}
              style={{ position: 'relative', zIndex: 1 }}
            >
              <TacticalButton
                variant="danger"
                fullWidth
                size="md"
                icon={<LogOut size={16} />}
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
        {activeTab === 'horizon' && (
          <motion.div
            key="horizon"
            initial={{ opacity: 0 }}
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
                now the navigation. We render only the breadcrumb
                (no title prop) via the universal MobileScreenHeader
                so the marker baseline aligns with every other tab. */}
            <MobileScreenHeader
              role={currentUser.role}
              page="HOME"
              right={<StatusPill label="Live" tone="ok" pulse />}
            />

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
                  case UserRole.MANAGER: {
                    const bedPct = Math.round(liveMetrics.bedCapacityPct);
                    // Sub-label: during surge, flag ER holds pressure on
                    // floor beds; baseline, show occupied / total.
                    const subLabel = isSurgeActive
                      ? `BED CAPACITY · ${heroDerived.edHoldsWaiting} ER HOLD${heroDerived.edHoldsWaiting === 1 ? '' : 'S'} WAITING ON FLOOR`
                      : `BED CAPACITY · ${heroDerived.occupiedCount} / ${heroDerived.totalBeds} OCCUPIED`;
                    return {
                      state: (isSurgeActive ? 'surge' : 'nominal') as HeroState,
                      dominantValue: String(bedPct),
                      dominantUnit: '%',
                      dominantLabel: subLabel,
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
                  }
                  case UserRole.NURSE:
                    return {
                      state: (isSurgeActive ? 'strained' : 'nominal') as HeroState,
                      dominantValue: String(heroDerived.overdueReassessments),
                      dominantUnit: undefined,
                      dominantLabel: `OVERDUE REASSESSMENTS · ${heroDerived.fallRisk} FALL RISK · ${heroDerived.dischargesPending} DISCHARGE${heroDerived.dischargesPending === 1 ? '' : 'S'} PENDING`,
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
                  case UserRole.ER_PERSONNEL: {
                    // Trauma is baseline busy. Zero bays is normal.
                    const baysOpen = heroDerived.traumaBaysOpen;
                    const emsCount = heroDerived.inboundEms;
                    const triageWait = liveMetrics.erWaitMinutes;
                    return {
                      state: (isSurgeActive ? 'surge' : 'strained') as HeroState,
                      dominantValue: String(baysOpen),
                      dominantUnit: 'bays',
                      dominantLabel: `TRAUMA BAYS OPEN · ${emsCount} EMS INBOUND <5MIN · ${triageWait}M TRIAGE WAIT`,
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
                }
              })();
              return <StateHero {...heroProps} />;
            })()}

            {/* EMS Inbound Board — only ER personnel see this on the
                dashboard. Manager + nurse get a smaller launcher on
                the patients tab so they can still glance at it
                without it dominating the home screen. */}
            {currentUser.role === UserRole.ER_PERSONNEL && <EmsInboundBoard display="card" />}

            {/* Bed Board — all roles see this on the dashboard.
                Compact tile shows availability %, state breakdown,
                and mini bed grid. Tapping navigates to the Patients tab's
                BedBoard sub-tab so the bottom nav stays visible. */}
            <BedBoard
              display="card"
              units={bedUnits}
              surgeActive={isSurgeActive}
              onExpand={() => {
                triggerHaptic('light');
                setActiveTab('patients');
                setPatientsSubTab('bedboard');
              }}
            />

            {/* Live Ops Grid — house-wide KPIs, scannable at a glance.
                Critical tiles now render their numeric at 40px so
                severity is encoded in size, not just color. */}
            <div>
              <SectionHeader
                id="LO"
                label="LIVE OPS"
                right={
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs }}>
                    <ConfidenceBadge confidence={92} ageMinutes={1} compact />
                    <StatusPill label="Sync" tone="info" size="xs" />
                  </div>
                }
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
                  value={String(liveMetrics.erWaitMinutes)}
                  unit="min"
                  delta={isSurgeActive
                    ? { text: '+80m', tone: 'crit' }
                    : { text: '+5m', tone: 'crit' }}
                  accent={isSurgeActive ? 'crit' : 'warn'}
                />
                <MetricTile
                  id="M02"
                  label="Total Census"
                  value={String(liveMetrics.totalCensus)}
                  unit="pts"
                  delta={isSurgeActive
                    ? { text: '+28', tone: 'crit' }
                    : { text: '-12', tone: 'ok' }}
                  accent={isSurgeActive ? 'warn' : undefined}
                />
                <MetricTile
                  id="M03"
                  label="Bed Capacity"
                  value={String(liveMetrics.bedCapacityPct)}
                  unit="%"
                  accent={isSurgeActive ? 'crit' : 'ok'}
                  progressPct={liveMetrics.bedCapacityPct}
                />
                <MetricTile
                  id="M04"
                  label="Active Codes"
                  value={String(liveMetrics.activeCodes)}
                  delta={isSurgeActive
                    ? { text: '+2 NEW', tone: 'crit' }
                    : { text: 'STABLE', tone: 'info' }}
                  accent={isSurgeActive ? 'crit' : 'info'}
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
                          fontSize: 20,
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                          letterSpacing: '-0.02em',
                          lineHeight: 1.1,
                        }}
                      >
                        Next 4 Hours
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                      <ConfidenceBadge confidence={isSafe ? 94 : 87} ageMinutes={2} />
                      <StatusPill
                        label={isSafe ? 'Trend Ok' : 'At Risk'}
                        tone={isSafe ? 'ok' : 'crit'}
                      />
                    </div>
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
                            fontSize: 11,
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
                            fontSize: 11,
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
                            fontSize: 13,
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
                            fontSize: 10,
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
                      fontSize: 11,
                      letterSpacing: '0.14em',
                      display: 'block',
                      textAlign: 'center',
                    }}
                  >
                    DRAG ACROSS CHART TO SCRUB · 15-MIN RESOLUTION
                  </Mono>

                  {/* ── RISK DRIVERS ───────────────────────────
                      Explainable "Why" view — when the forecast
                      is above capacity, show what's pushing it.
                      This is Bucket A — core PULSE innovation.
                  ────────────────���─────────────────────────── */}
                  {!isSafe && !isSurgeActive && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: MOTION.base, delay: 0.3 }}
                      style={{
                        marginTop: SPACE.base,
                        padding: SPACE.md,
                        background: `${COLORS.crit}08`,
                        border: `1px solid ${COLORS.crit}25`,
                        borderRadius: RADIUS.sm,
                        position: 'relative',
                      }}
                    >
                      <CornerBracket position="tl" color={COLORS.crit} size={8} thickness={1} inset={0} />
                      <CornerBracket position="br" color={COLORS.crit} size={8} thickness={1} inset={0} />
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.sm }}>
                        <BracketLabel tone="crit" size="xs">RISK DRIVERS</BracketLabel>
                        <Mono tone="crit" size="xs">CONF 87% · 2M AGO</Mono>
                      </div>
                      {/* Driver breakdown — what's pushing saturation */}
                      {[
                        { label: 'EMS INBOUND', value: '4 RUNS', impact: 32, detail: '2 trauma activations, STEMI, sepsis alert' },
                        { label: 'ED HOLDS', value: '6 PTS', impact: 28, detail: 'Waiting for inpatient beds, avg 3.2h hold' },
                        { label: 'BEDS NOT STAFFED', value: '3 BEDS', impact: 22, detail: 'ICU-4, SD-3, 3E-304 — no assigned RN' },
                        { label: 'HIGH ACUITY MIX', value: 'ESI ≤2: 40%', impact: 18, detail: '4 of 10 ED pts are ESI 1-2, above 25% baseline' },
                      ].map((driver, idx) => (
                        <div
                          key={driver.label}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: SPACE.sm,
                            padding: `${SPACE.xs}px 0`,
                            borderTop: idx > 0 ? `1px solid ${COLORS.border}` : undefined,
                          }}
                        >
                          {/* Impact bar */}
                          <div style={{
                            width: 32,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: 2,
                            flexShrink: 0,
                            paddingTop: 2,
                          }}>
                            <div style={{
                              width: '100%',
                              height: 3,
                              background: COLORS.border,
                              borderRadius: RADIUS.full,
                              overflow: 'hidden',
                            }}>
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${driver.impact}%` }}
                                transition={{ duration: 0.6, delay: 0.4 + idx * 0.1 }}
                                style={{
                                  height: '100%',
                                  background: COLORS.crit,
                                  borderRadius: RADIUS.full,
                                }}
                              />
                            </div>
                            <Mono tone="crit" size="xs">{driver.impact}%</Mono>
                          </div>
                          {/* Content */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Mono tone="primary" size="xs">{driver.label}</Mono>
                              <Mono tone="crit" size="xs">{driver.value}</Mono>
                            </div>
                            <div style={{
                              fontFamily: FONTS.sans,
                              fontSize: 13,
                              color: COLORS.textMuted,
                              marginTop: 1,
                              lineHeight: 1.3,
                            }}>
                              {driver.detail}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Surge proposal — the PULSE climax moment */}
                      <motion.div
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: MOTION.base, delay: 0.8 }}
                        style={{
                          marginTop: SPACE.md,
                          padding: SPACE.md,
                          background: `${COLORS.accent}10`,
                          border: `1px solid ${COLORS.accent}30`,
                          borderRadius: RADIUS.sm,
                          position: 'relative',
                        }}
                      >
                        <CornerBracket position="tl" color={COLORS.accent} size={8} thickness={1.5} inset={0} />
                        <CornerBracket position="tr" color={COLORS.accent} size={8} thickness={1.5} inset={0} />
                        <CornerBracket position="bl" color={COLORS.accent} size={8} thickness={1.5} inset={0} />
                        <CornerBracket position="br" color={COLORS.accent} size={8} thickness={1.5} inset={0} />
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                          <ShieldAlert size={16} color={COLORS.accent} />
                          <Mono tone="accent" size="sm">SURGE RECOMMENDED</Mono>
                        </div>
                        <div style={{
                          fontFamily: FONTS.sans,
                          fontSize: 14,
                          color: COLORS.textSecondary,
                          lineHeight: 1.4,
                          marginBottom: SPACE.md,
                        }}>
                          ED saturation projected at 112% in 90 min. PULSE recommends
                          Level 2 Surge Protocol — open overflow capacity, redistribute
                          stable patients, and hold non-urgent imaging.
                        </div>
                        <div style={{
                          fontFamily: FONTS.mono,
                          fontSize: 11,
                          letterSpacing: '0.12em',
                          color: COLORS.textMuted,
                          textTransform: 'uppercase',
                          marginBottom: SPACE.sm,
                        }}>
                          PROPOSED ACTIONS · 5 TASKS ACROSS 3 DEPARTMENTS
                        </div>
                        {[
                          { task: 'Open overflow bay in Hall C', dept: 'Bed Mgmt', icon: '🛏' },
                          { task: 'Page Dr. Kim — trauma lead', dept: 'Medical', icon: '📟' },
                          { task: 'Reassign stable pts from Bay 3 → Med-Surg', dept: 'Nursing', icon: '↗' },
                          { task: 'Prep 2 additional crash carts', dept: 'Nursing', icon: '⚡' },
                          { task: 'Hold non-urgent CTs, free CT-1', dept: 'Radiology', icon: '🔬' },
                        ].map((a, i) => (
                          <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: SPACE.sm,
                            padding: `3px 0`,
                            borderTop: i > 0 ? `1px solid ${COLORS.border}` : undefined,
                          }}>
                            <span style={{ fontSize: 12, width: 18, textAlign: 'center' }}>{a.icon}</span>
                            <span style={{
                              fontFamily: FONTS.sans,
                              fontSize: 13,
                              color: COLORS.textPrimary,
                              flex: 1,
                            }}>
                              {a.task}
                            </span>
                            <Mono tone="muted" size="xs">{a.dept}</Mono>
                          </div>
                        ))}
                        <div style={{ display: 'flex', gap: SPACE.sm, marginTop: SPACE.md }}>
                          {currentUser.role === UserRole.MANAGER ? (
                            <TacticalButton
                              variant="primary"
                              size="sm"
                              fullWidth
                              icon={<ShieldAlert size={14} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                onActivateSurge();
                              }}
                            >
                              CONFIRM SURGE
                            </TacticalButton>
                          ) : (
                            <div style={{
                              width: '100%',
                              padding: `${SPACE.sm}px`,
                              background: `${COLORS.warn}10`,
                              border: `1px solid ${COLORS.warn}25`,
                              borderRadius: RADIUS.sm,
                              textAlign: 'center',
                            }}>
                              <Mono tone="warn" size="xs">
                                AWAITING OPS DIRECTOR CONFIRMATION
                              </Mono>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    </motion.div>
                  )}

                  {/* After surge is active — show resolved state */}
                  {isSurgeActive && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: MOTION.base }}
                      style={{
                        marginTop: SPACE.base,
                        padding: SPACE.md,
                        background: `${COLORS.ok}08`,
                        border: `1px solid ${COLORS.ok}25`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.xs }}>
                        <StatusPill label="SURGE ACTIVE" tone="crit" pulse size="xs" />
                        <Mono tone="ok" size="xs">FORECAST IMPROVING</Mono>
                      </div>
                      <div style={{
                        fontFamily: FONTS.sans,
                        fontSize: 14,
                        color: COLORS.textSecondary,
                        lineHeight: 1.4,
                      }}>
                        Surge protocol in effect. Overflow beds online. Forecast revised
                        downward — projected saturation now 32%. Monitor task completion
                        on the Actions tab.
                      </div>
                    </motion.div>
                  )}
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
                    action: () => setShowCodeBlue(true),
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
                        minHeight: 48,
                        padding: `${SPACE.sm}px ${SPACE.md}px`,
                        background: COLORS.surface,
                        border: `1px solid ${color}`,
                        borderRadius: RADIUS.sm,
                        cursor: 'pointer',
                        fontFamily: FONTS.mono,
                        color,
                      }}
                    >
                      <btn.icon size={15} />
                      <span
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 13,
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

            {/* Inline test QR card — always-visible scannable target
                so the user doesn't have to hunt in the horizontal
                Quick Actions row for the TEST QR button. Tap to
                expand to a fullscreen view for easier cross-device
                scanning. Encodes pulse://tab/patients → opens the
                Patients tab when scanned by the SCAN QR button. */}
            <TestQRInlineCard
              payload="pulse://tab/patients"
              label="TEST SCAN TARGET"
              sublabel="Scan this code to open the Patients tab."
              onExpand={() => setShowTestQR(true)}
            />

            {/* Workforce Coverage launcher — open full staffing view */}
            <motion.button
              type="button"
              onClick={() => { triggerHaptic('light'); setShowWorkforce(true); }}
              whileTap={{ scale: 0.98 }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                width: '100%',
                padding: `${SPACE.md}px ${SPACE.base}px`,
                background: `linear-gradient(90deg, rgba(139,92,246,0.08) 0%, rgba(139,92,246,0.02) 100%)`,
                border: '1px solid rgba(139,92,246,0.5)',
                borderLeft: '3px solid rgba(139,92,246,0.7)',
                borderRadius: RADIUS.sm,
                color: COLORS.textPrimary,
                fontFamily: FONTS.sans,
                textAlign: 'left',
                cursor: 'pointer',
                overflow: 'hidden',
                minHeight: 48,
              }}
            >
              <CornerBracket position="tl" color="rgba(139,92,246,0.7)" size={6} thickness={1} inset={-1} />
              <CornerBracket position="br" color="rgba(139,92,246,0.7)" size={6} thickness={1} inset={-1} />
              <div
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(139,92,246,0.18)',
                  border: '1px solid rgba(139,92,246,0.5)',
                  borderRadius: RADIUS.sm,
                  color: 'rgba(139,92,246,0.9)',
                }}
              >
                <Users size={18} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <BracketLabel size="xs" style={{ color: 'rgba(139,92,246,0.9)' }}>WORKFORCE</BracketLabel>
                <div style={{ marginTop: 2, fontFamily: FONTS.sans, fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>
                  Staff coverage · 47 on shift · 1:4.2 ratio
                </div>
              </div>
              <ChevronRight size={18} strokeWidth={2} color={COLORS.textSecondary} />
            </motion.button>

            {/* Dept Coordination + Brief Me — side by side launchers */}
            <div style={{ display: 'flex', gap: SPACE.sm }}>
              <motion.button
                type="button"
                onClick={() => { triggerHaptic('light'); setShowDeptCoord(true); }}
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1, position: 'relative', display: 'flex', alignItems: 'center',
                  gap: SPACE.sm, padding: `${SPACE.sm}px ${SPACE.md}px`,
                  background: `linear-gradient(90deg, ${COLORS.info}10 0%, ${COLORS.info}02 100%)`,
                  border: `1px solid ${COLORS.info}`, borderLeft: `3px solid ${COLORS.info}`,
                  borderRadius: RADIUS.sm, color: COLORS.textPrimary, fontFamily: FONTS.sans,
                  textAlign: 'left', cursor: 'pointer', overflow: 'hidden', minHeight: 48,
                }}
              >
                <Network size={16} strokeWidth={2} color={COLORS.info} />
                <div style={{ flex: 1 }}>
                  <Mono tone="info" size="xs">COORD</Mono>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSecondary }}>Departments</div>
                </div>
              </motion.button>
              <motion.button
                type="button"
                onClick={() => { triggerHaptic('light'); setShowBriefMe(true); }}
                whileTap={{ scale: 0.97 }}
                style={{
                  flex: 1, position: 'relative', display: 'flex', alignItems: 'center',
                  gap: SPACE.sm, padding: `${SPACE.sm}px ${SPACE.md}px`,
                  background: `linear-gradient(90deg, ${COLORS.accent}10 0%, ${COLORS.accent}02 100%)`,
                  border: `1px solid ${COLORS.accent}`, borderLeft: `3px solid ${COLORS.accent}`,
                  borderRadius: RADIUS.sm, color: COLORS.textPrimary, fontFamily: FONTS.sans,
                  textAlign: 'left', cursor: 'pointer', overflow: 'hidden', minHeight: 48,
                }}
              >
                <BrainCircuit size={16} strokeWidth={2} color={COLORS.accent} />
                <div style={{ flex: 1 }}>
                  <Mono tone="accent" size="xs">BRIEF ME</Mono>
                  <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.textSecondary }}>AI Briefing</div>
                </div>
              </motion.button>
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
                    size={16}
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
                    ? `Surge protocol active T+${formatElapsed(
                        surgeActivatedAt,
                        time.getTime(),
                      )}. ${
                        urgentTasks.filter((t) => !t.acknowledgedBy).length
                      }/${urgentTasks.length} urgent tasks pending. Census 312 (+28 from baseline). ER wait 125m — divert status recommended. Float pool deployed to ICU-4, SD-3, 3E-304. Overflow Hall C open: 2 occupied, 2 ready. 3 active codes (2 new since surge onset).`
                    : 'Normal operations. ER wait 45m, trending +5m. Census 284 — 12 discharges pending. ICU at 83% (1 bed not staffed, 1 blocked for vent maintenance). Staffing ratio 1:4.2, optimal for current census. Next shift change in 3h 42m.'}
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
                    <Clock size={12} color={COLORS.textMuted} />
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

        {/* ────── ACTIONS / LIVE OPS (role-gated) ─────────── */}
        {activeTab === 'actions' && currentUser.role !== UserRole.NURSE && (
          <motion.div
            key="liveops"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            style={{
              paddingBottom: NAV_HEIGHT + SPACE['2xl'],
            }}
          >
            <MobileLiveOps
              currentUser={currentUser}
              systemStatus={systemStatus}
              showToast={showToast}
              isSurgeActive={isSurgeActive}
            />
          </motion.div>
        )}

        {activeTab === 'actions' && currentUser.role === UserRole.NURSE && (
          <motion.div
            key="actions"
            initial={{ opacity: 0 }}
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
            <MobileScreenHeader
              role={currentUser.role}
              page="ACTIONS"
              title="Actions Queue"
            />

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
                      size={16}
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
                            fontSize: 17,
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
                            <CheckCircle size={12} color={COLORS.ok} />
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
                        fontSize: 42,
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
                      minHeight: 48,
                      padding: `0 ${SPACE.md}px`,
                      background: active ? COLORS.surfaceElev : 'transparent',
                      border: `1px solid ${active ? COLORS.borderHover : 'transparent'}`,
                      borderRadius: RADIUS.sm,
                      cursor: 'pointer',
                      fontFamily: FONTS.mono,
                      fontSize: 13,
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
                <EmptyState
                  tone="ok"
                  icon={<CheckCircle size={24} strokeWidth={1.8} />}
                  label="QUEUE CLEAR"
                  title="All actions complete"
                  description={
                    taskFilter === 'all'
                      ? 'No tasks assigned to you right now. New orders and alerts will show up here.'
                      : `No ${taskFilter.toUpperCase()} tasks in your queue. Try the ALL filter to see everything.`
                  }
                />
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
                          width: 44,
                          height: 44,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          color: COLORS.textMuted,
                          marginTop: 0,
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
                            fontSize: 17,
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
                        size={18}
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

        {/* ────── PATIENTS / COORDINATION ─────────────────────
            Floor managers don't work the patient list the way
            Nurse / ER / Trauma do — their whole job is beds and
            what's coming through the front door. For them, this
            slot renders the dedicated Coordination surface (Bed
            Board + LIVE EMS Inbound). Everyone else gets the
            existing Patient List + inline Bed Board. The tab key
            stays 'patients' so tab state, deep links, and the QR
            tab router don't have to branch per role. */}
        {activeTab === 'patients' && (
          currentUser.role === UserRole.MANAGER ? (
            <MobileCoordination
              currentUser={currentUser}
              showToast={showToast}
              navClearance={NAV_HEIGHT + SPACE['2xl']}
            />
          ) : (
          <motion.div
            key="patients"
            initial={{ opacity: 0 }}
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
            <MobileScreenHeader
              role={currentUser.role}
              page="PATIENTS"
              title="Patients"
            />

            {/* ── BIG ADMIT PATIENT CTA ───────────────────────── */}
            <motion.button
              type="button"
              onClick={() => {
                triggerHaptic('medium');
                setShowAdmitFlow(true);
              }}
              whileTap={{ scale: 0.97 }}
              style={{
                position: 'relative',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: SPACE.md,
                padding: `${SPACE.base}px ${SPACE.lg}px`,
                background: `linear-gradient(135deg, ${COLORS.accent}20 0%, ${COLORS.accent}08 100%)`,
                border: `1.5px solid ${COLORS.accent}`,
                borderRadius: RADIUS.md,
                color: COLORS.accent,
                fontFamily: FONTS.sans,
                cursor: 'pointer',
                overflow: 'hidden',
                minHeight: 56,
              }}
            >
              <CornerBracket position="tl" color={COLORS.accent} size={8} thickness={1.5} inset={-1} />
              <CornerBracket position="tr" color={COLORS.accent} size={8} thickness={1.5} inset={-1} />
              <CornerBracket position="bl" color={COLORS.accent} size={8} thickness={1.5} inset={-1} />
              <CornerBracket position="br" color={COLORS.accent} size={8} thickness={1.5} inset={-1} />
              <div style={{
                width: 40, height: 40, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: `${COLORS.accent}25`,
                border: `1px solid ${COLORS.accent}`,
                borderRadius: RADIUS.sm,
              }}>
                <UserPlus size={20} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <div style={{
                  fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
                  letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                  color: COLORS.accent, opacity: 0.8, marginBottom: 2,
                }}>
                  NEW ADMISSION
                </div>
                <div style={{
                  fontFamily: FONTS.sans, fontSize: 18, fontWeight: 700,
                  color: COLORS.textPrimary, letterSpacing: '-0.01em',
                }}>
                  Admit Patient
                </div>
              </div>
              <ChevronRight size={20} strokeWidth={2} color={COLORS.accent} />
            </motion.button>

            {/* ── SEGMENTED CONTROL: Patient List / Bed Board ──── */}
            <div style={{
              display: 'flex',
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.md,
              padding: 3,
              gap: 3,
            }}>
              {(['list', 'bedboard'] as const).map((seg) => {
                const active = patientsSubTab === seg;
                const label = seg === 'list' ? 'Patient List' : 'Bed Board';
                const Icon = seg === 'list' ? Users : BedSingle;
                return (
                  <button
                    key={seg}
                    onClick={() => { triggerHaptic('light'); setPatientsSubTab(seg); }}
                    style={{
                      flex: 1, minHeight: 44,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      background: active ? COLORS.accent : 'transparent',
                      border: 'none', borderRadius: RADIUS.sm,
                      fontFamily: FONTS.mono, fontSize: 12, fontWeight: 600,
                      letterSpacing: '0.06em', textTransform: 'uppercase' as const,
                      color: active ? COLORS.textPrimary : COLORS.textSecondary,
                      cursor: 'pointer',
                      transition: `background ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
                      boxShadow: active ? `0 0 12px ${COLORS.accentGlow}` : 'none',
                    }}
                  >
                    <Icon size={14} strokeWidth={2} />
                    {label}
                  </button>
                );
              })}
            </div>

            {/* ── PATIENT LIST SUB-TAB ────────────────────────── */}
            {patientsSubTab === 'list' && (<>

            {/* EMS Inbound launcher — every floor role can pop the
                fullscreen radio board to see what's coming through
                the door. ER personnel also see the same surface
                inline on the Dashboard tab. */}
            <motion.button
              type="button"
              onClick={() => {
                triggerHaptic('light');
                setShowEmsBoard(true);
              }}
              whileTap={{ scale: 0.98 }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                padding: `${SPACE.md}px ${SPACE.base}px`,
                background:
                  'linear-gradient(90deg, rgba(59,130,246,0.10) 0%, rgba(59,130,246,0.02) 100%)',
                border: `1px solid ${COLORS.info}`,
                borderLeft: `3px solid ${COLORS.info}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textPrimary,
                fontFamily: FONTS.sans,
                textAlign: 'left',
                cursor: 'pointer',
                overflow: 'hidden',
                minHeight: 56,
              }}
            >
              <CornerBracket position="tl" color={COLORS.info} size={6} thickness={1} inset={-1} />
              <CornerBracket position="br" color={COLORS.info} size={6} thickness={1} inset={-1} />
              <div
                style={{
                  width: 36,
                  height: 36,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(59,130,246,0.18)',
                  border: `1px solid ${COLORS.info}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.info,
                }}
              >
                <Radio size={18} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <BracketLabel tone="info" size="xs">
                  EMS · INBOUND
                </BracketLabel>
                <div
                  style={{
                    marginTop: 2,
                    fontFamily: FONTS.sans,
                    fontSize: 16,
                    fontWeight: 600,
                    color: COLORS.textPrimary,
                    letterSpacing: '-0.005em',
                  }}
                >
                  Live radio · runs decrementing in real time
                </div>
              </div>
              <ChevronRight size={18} strokeWidth={2} color={COLORS.textSecondary} />
            </motion.button>

            {/* Search — wired to patientSearch state */}
            <div style={{ position: 'relative' }}>
              <Search
                size={16}
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
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search name, MRN, bed, complaint…"
                style={{
                  width: '100%',
                  minHeight: 48,
                  padding: `0 ${patientSearch ? SPACE['2xl'] : SPACE.base}px 0 ${SPACE['2xl']}px`,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  fontWeight: 500,
                  color: COLORS.textPrimary,
                  outline: 'none',
                }}
              />
              {patientSearch && (
                <button
                  type="button"
                  onClick={() => setPatientSearch('')}
                  aria-label="Clear search"
                  style={{
                    position: 'absolute', right: 8, top: '50%',
                    transform: 'translateY(-50%)',
                    width: 28, height: 28, borderRadius: RADIUS.full,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: COLORS.surfaceHover, border: 'none',
                    color: COLORS.textSecondary, cursor: 'pointer',
                  }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div style={{
              display: 'flex', gap: SPACE.xs, overflowX: 'auto',
              WebkitOverflowScrolling: 'touch', paddingBottom: 2,
            }}>
              {([
                { id: 'all', label: 'All', count: allAdaptedPatients.length },
                { id: 'critical', label: 'Critical', count: allAdaptedPatients.filter(p => p.status === 'critical').length },
                { id: 'warning', label: 'Warning', count: allAdaptedPatients.filter(p => p.status === 'warning').length },
                { id: 'ed', label: 'ED', count: allAdaptedPatients.filter(p => p.clinical.currentEncounter?.class === 'EMERGENCY').length },
                { id: 'inpatient', label: 'Inpatient', count: allAdaptedPatients.filter(p => p.clinical.currentEncounter?.class !== 'EMERGENCY').length },
              ] as const).map((f) => {
                const active = patientFilter === f.id;
                const tone = f.id === 'critical' ? COLORS.crit
                  : f.id === 'warning' ? COLORS.warn
                  : COLORS.accent;
                return (
                  <button
                    key={f.id}
                    onClick={() => { triggerHaptic('light'); setPatientFilter(f.id); }}
                    style={{
                      flexShrink: 0,
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: `8px 12px`, minHeight: 36,
                      background: active ? `${tone}20` : COLORS.surface,
                      border: `1px solid ${active ? tone : COLORS.border}`,
                      borderRadius: RADIUS.full,
                      fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
                      letterSpacing: '0.08em', textTransform: 'uppercase' as const,
                      color: active ? tone : COLORS.textSecondary,
                      cursor: 'pointer',
                      transition: `all ${MOTION.fast}s ease`,
                    }}
                  >
                    {f.label}
                    <span style={{
                      padding: '1px 6px', borderRadius: RADIUS.full,
                      background: active ? tone : COLORS.surfaceHover,
                      color: active ? COLORS.bg : COLORS.textMuted,
                      fontSize: 10, fontWeight: 700,
                    }}>
                      {f.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Results count */}
            {(patientSearch || patientFilter !== 'all') && (
              <Mono tone="muted" size="xs">
                {filteredPatients.length} of {allAdaptedPatients.length} patients
              </Mono>
            )}

            {/* Patient list */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.md,
              }}
            >
              {filteredPatients.length === 0 && (
                <TacticalCard padding="none">
                  <EmptyState
                    icon={<Search size={22} strokeWidth={1.8} />}
                    label="NO PATIENTS MATCH"
                    title={
                      patientSearch
                        ? `No results for "${patientSearch}"`
                        : 'No patients in this filter'
                    }
                    description={
                      patientSearch || patientFilter !== 'all'
                        ? 'Try clearing the search or switching to the ALL filter.'
                        : 'The roster will populate once patients are admitted.'
                    }
                    action={
                      (patientSearch || patientFilter !== 'all') && (
                        <TacticalButton
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            triggerHaptic('light');
                            setPatientSearch('');
                            setPatientFilter('all');
                          }}
                        >
                          Reset filters
                        </TacticalButton>
                      )
                    }
                  />
                </TacticalCard>
              )}
              {filteredPatients.map((patient, pIdx) => {
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
                                fontSize: 20,
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
                                size={16}
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
                          <Stethoscope size={12} color={COLORS.textMuted} />
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

            {/* ── MY PATIENTS (role-scoped worklist) ─────────────
                Nurses, ER Personnel, and Trauma see their own
                caseload with an MEWS-driven acuity sort + SBAR
                drawer. MANAGER never hits this branch — they route
                to MobileCoordination instead (see ternary above). */}
              <div
                style={{
                  marginTop: SPACE.lg,
                  paddingTop: SPACE.lg,
                  borderTop: `1px dashed ${COLORS.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACE.md,
                }}
              >
                {/* Section header row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACE.sm,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                    <BracketLabel tone="accent" size="sm">
                      MY PATIENTS
                    </BracketLabel>
                    <StatusPill
                      label={`${myPatientsSorted.length}`}
                      tone="neutral"
                      size="xs"
                    />
                  </div>

                  {/* Sort toggle — alpha ↔ acuity */}
                  <div
                    style={{
                      display: 'flex',
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.full,
                      overflow: 'hidden',
                    }}
                  >
                    {(['acuity', 'alpha'] as const).map((mode) => {
                      const active = myPatientsSort === mode;
                      return (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => {
                            triggerHaptic('light');
                            setMyPatientsSort(mode);
                          }}
                          style={{
                            padding: `6px 12px`,
                            minHeight: 32,
                            background: active ? COLORS.accent : 'transparent',
                            border: 'none',
                            fontFamily: FONTS.mono,
                            fontSize: 10,
                            fontWeight: 700,
                            letterSpacing: '0.14em',
                            textTransform: 'uppercase',
                            color: active ? COLORS.bg : COLORS.textSecondary,
                            cursor: 'pointer',
                            transition: `background ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
                          }}
                        >
                          {mode === 'acuity' ? 'Acuity' : 'A-Z'}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* My Patients list — role-aware copy so the zero-state reads
                    like something the specific role would say, not a generic
                    "caseload empty" line. */}
                {myPatientsSorted.length === 0 ? (
                  <TacticalCard padding="none">
                    <EmptyState
                      compact
                      icon={<Users size={18} strokeWidth={1.8} />}
                      label="NO ACTIVE PATIENTS"
                      title={
                        currentUser.role === UserRole.NURSE
                          ? 'Caseload clear'
                          : currentUser.role === UserRole.ER_PERSONNEL
                          ? 'No active ED cases'
                          : 'No active trauma cases'
                      }
                      description={
                        currentUser.role === UserRole.NURSE
                          ? 'No patients assigned to you on this shift. New admissions will appear here.'
                          : currentUser.role === UserRole.ER_PERSONNEL
                          ? 'Triage + EMS inbound will populate this list as patients arrive.'
                          : 'Trauma activations and consults will show up here once paged.'
                      }
                    />
                  </TacticalCard>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                    {myPatientsSorted.map(({ patient: p, mews, lastVital }) => {
                      const expanded = expandedMyPatientId === p.id;
                      const ageYears = ageInYears(p.birthDate);
                      const enc = p.currentEncounter;
                      const bedLabel = enc?.location?.bed || 'UNASSIGNED';
                      const tone = mews >= 5 ? 'crit' : mews >= 3 ? 'warn' : 'ok';
                      const toneColor = mews >= 5 ? COLORS.crit : mews >= 3 ? COLORS.warn : COLORS.ok;
                      const mewsLbl = mews >= 5 ? 'CRITICAL' : mews >= 3 ? 'ELEVATED' : 'LOW';
                      return (
                        <TacticalCard
                          key={p.id}
                          padding="none"
                          style={{ overflow: 'hidden', borderLeft: `3px solid ${toneColor}` }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic('light');
                              setExpandedMyPatientId(expanded ? null : p.id);
                            }}
                            style={{
                              width: '100%',
                              padding: SPACE.md,
                              background: 'transparent',
                              border: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: SPACE.md,
                            }}
                          >
                            <div
                              style={{
                                width: 40,
                                height: 40,
                                borderRadius: RADIUS.full,
                                background: `${toneColor}22`,
                                border: `1px solid ${toneColor}`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontFamily: FONTS.mono,
                                fontSize: 12,
                                fontWeight: 700,
                                color: toneColor,
                                flexShrink: 0,
                              }}
                            >
                              {p.avatarInitials || `${p.name.given[0] ?? ''}${p.name.family[0] ?? ''}`.toUpperCase()}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: SPACE.xs,
                                }}
                              >
                                <div
                                  style={{
                                    fontFamily: FONTS.sans,
                                    fontSize: 15,
                                    fontWeight: 600,
                                    color: COLORS.textPrimary,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {p.name.family}, {p.name.given}
                                </div>
                              </div>
                              <Mono tone="muted" size="xs">
                                {ageYears}
                                {p.sex ? ` · ${p.sex}` : ''} · {bedLabel}
                              </Mono>
                            </div>
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'flex-end',
                                gap: 4,
                                flexShrink: 0,
                              }}
                            >
                              <StatusPill
                                label={`MEWS ${mews}`}
                                tone={tone}
                                size="xs"
                                pulse={mews >= 5}
                              />
                              <Mono tone="muted" size="xs">
                                {mewsLbl}
                              </Mono>
                            </div>
                            <ChevronRight
                              size={16}
                              color={COLORS.textMuted}
                              style={{
                                transform: expanded ? 'rotate(90deg)' : 'none',
                                transition: `transform ${MOTION.fast}s ease`,
                                flexShrink: 0,
                              }}
                            />
                          </button>

                          {/* SBAR drawer */}
                          <AnimatePresence initial={false}>
                            {expanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                                style={{ overflow: 'hidden' }}
                              >
                                <div
                                  style={{
                                    padding: SPACE.md,
                                    paddingTop: 0,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: SPACE.sm,
                                    borderTop: `1px dashed ${COLORS.border}`,
                                  }}
                                >
                                  {/* S — Situation */}
                                  <div>
                                    <Mono tone="accent" size="xs">S · SITUATION</Mono>
                                    <div
                                      style={{
                                        marginTop: 2,
                                        fontSize: 12,
                                        color: COLORS.textPrimary,
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {enc?.chiefComplaint || '—'} · ESI {enc?.esi ?? '?'}
                                      {enc?.arrivalMode ? ` · arrived via ${enc.arrivalMode}` : ''}
                                    </div>
                                  </div>
                                  {/* B — Background */}
                                  <div>
                                    <Mono tone="accent" size="xs">B · BACKGROUND</Mono>
                                    <div
                                      style={{
                                        marginTop: 2,
                                        fontSize: 12,
                                        color: COLORS.textPrimary,
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {p.problems.length === 0
                                        ? 'No known problems'
                                        : p.problems
                                            .slice(0, 3)
                                            .map((pr) => pr.display)
                                            .join(' · ')}
                                      {p.allergies.length > 0
                                        ? ` · Allergies: ${p.allergies
                                            .slice(0, 2)
                                            .map((a) => a.substance)
                                            .join(', ')}`
                                        : ' · NKA'}
                                    </div>
                                  </div>
                                  {/* A — Assessment (vitals + MEWS) */}
                                  <div>
                                    <Mono tone="accent" size="xs">A · ASSESSMENT</Mono>
                                    <div
                                      style={{
                                        marginTop: 2,
                                        fontSize: 12,
                                        color: COLORS.textPrimary,
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {lastVital
                                        ? `HR ${lastVital.heartRate} · BP ${lastVital.systolic}/${lastVital.diastolic} · RR ${lastVital.respRate} · SpO₂ ${lastVital.spO2}% · T ${lastVital.temperature}°C · GCS ${lastVital.gcs}`
                                        : 'No vitals yet recorded'}
                                      <span style={{ color: toneColor, fontWeight: 600 }}>
                                        {' · MEWS '}
                                        {mews} ({mewsLbl})
                                      </span>
                                    </div>
                                  </div>
                                  {/* R — Recommendation */}
                                  <div>
                                    <Mono tone="accent" size="xs">R · RECOMMENDATION</Mono>
                                    <div
                                      style={{
                                        marginTop: 2,
                                        fontSize: 12,
                                        color: COLORS.textPrimary,
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {mews >= 5
                                        ? 'Escalate — consider rapid response, reassess vitals q15min.'
                                        : mews >= 3
                                          ? 'Increased surveillance — reassess vitals q1h, notify attending of trend.'
                                          : 'Continue routine monitoring. Reassess at next scheduled interval.'}
                                    </div>
                                  </div>

                                  {/* Action buttons */}
                                  <div style={{ display: 'flex', gap: SPACE.sm, marginTop: SPACE.xs }}>
                                    <TacticalButton
                                      variant="primary"
                                      size="sm"
                                      onClick={(e: React.MouseEvent) => {
                                        e.stopPropagation();
                                        setSelectedPatient(adaptPatientForList(p));
                                      }}
                                      style={{ flex: 1 }}
                                    >
                                      Open Chart
                                    </TacticalButton>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </TacticalCard>
                      );
                    })}
                  </div>
                )}
              </div>

            </>)}

            {/* ── BED BOARD SUB-TAB ───────────────────────────── */}
            {patientsSubTab === 'bedboard' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                <BedBoard
                  display="card"
                  units={bedUnits}
                  surgeActive={isSurgeActive}
                  onExpand={() => setShowBedBoard(true)}
                  role={currentUser.role}
                  embedded
                />

                {/* Unassigned patients holding area */}
                {(() => {
                  const unassigned = syncedPatients.filter(p => {
                    const enc = p.currentEncounter;
                    if (!enc) return false;
                    const isActive = enc.status === 'in-progress' || enc.status === 'arrived';
                    const noBed = !enc.location?.bed;
                    return isActive && noBed;
                  });
                  if (unassigned.length === 0) return null;
                  return (
                    <TacticalCard padding="sm" highlight>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: SPACE.sm,
                        marginBottom: SPACE.md,
                      }}>
                        <AlertCircle size={16} color={COLORS.warn} style={{
                          filter: `drop-shadow(0 0 6px ${COLORS.warn})`,
                        }} />
                        <BracketLabel tone="warn">HOLDING — UNASSIGNED</BracketLabel>
                        <StatusPill label={`${unassigned.length}`} tone="warn" size="xs" />
                      </div>
                      {unassigned.map((p) => (
                        <motion.button
                          key={p.id}
                          onClick={() => setSelectedPatient(adaptPatientForList(p))}
                          whileTap={{ scale: 0.98 }}
                          style={{
                            width: '100%', textAlign: 'left',
                            display: 'flex', alignItems: 'center', gap: SPACE.md,
                            padding: `${SPACE.sm}px 0`,
                            background: 'transparent', border: 'none',
                            borderBottom: `1px solid ${COLORS.border}`,
                            fontFamily: FONTS.sans, color: COLORS.textPrimary,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{
                            width: 32, height: 32, borderRadius: RADIUS.full,
                            background: `${COLORS.warn}20`,
                            border: `1px solid ${COLORS.warn}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: FONTS.mono, fontSize: 11, fontWeight: 600,
                            color: COLORS.warn,
                          }}>
                            {p.avatarInitials || `${p.name.given[0]}${p.name.family[0]}`}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>
                              {p.name.family}, {p.name.given}
                            </div>
                            <Mono tone="warn" size="xs">
                              NO BED · {p.currentEncounter?.chiefComplaint || 'Admitted'}
                            </Mono>
                          </div>
                          <ChevronRight size={16} color={COLORS.textMuted} />
                        </motion.button>
                      ))}
                    </TacticalCard>
                  );
                })()}

                {/* Tap "Expand" for full bed board overlay */}
                <TacticalButton
                  variant="primary"
                  size="md"
                  onClick={() => setShowBedBoard(true)}
                  style={{ width: '100%' }}
                >
                  Open Full Bed Board
                </TacticalButton>
              </div>
            )}
          </motion.div>
          )
        )}

        {/* ────── ALERTS ────────────────────────────────────── */}
        {activeTab === 'alerts' && (
          <motion.div
            key="alerts"
            initial={{ opacity: 0 }}
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
            <MobileScreenHeader
              role={currentUser.role}
              page="ALERTS"
              title="Alerts Feed"
              right={
                <Mono tone="muted" size="xs">
                  {mockAlerts.filter((a) => a.unread).length} UNREAD
                </Mono>
              }
            />

            {/* Full alerts center launcher */}
            <motion.button
              type="button"
              onClick={() => { triggerHaptic('light'); setShowAlerts(true); }}
              whileTap={{ scale: 0.98 }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                padding: `${SPACE.md}px ${SPACE.base}px`,
                background: `linear-gradient(90deg, ${COLORS.crit}10 0%, ${COLORS.crit}02 100%)`,
                border: `1px solid ${COLORS.crit}60`,
                borderLeft: `3px solid ${COLORS.crit}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textPrimary,
                fontFamily: FONTS.sans,
                textAlign: 'left',
                cursor: 'pointer',
                overflow: 'hidden',
                minHeight: 48,
                width: '100%',
              }}
            >
              <CornerBracket position="tl" color={COLORS.crit} size={6} thickness={1} inset={-1} />
              <CornerBracket position="br" color={COLORS.crit} size={6} thickness={1} inset={-1} />
              <div
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${COLORS.crit}18`,
                  border: `1px solid ${COLORS.crit}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.crit,
                }}
              >
                <Bell size={18} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <BracketLabel tone="crit" size="xs">ALERTS CENTER</BracketLabel>
                <div style={{ marginTop: 2, fontFamily: FONTS.sans, fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>
                  15 alerts · 4 critical · filter &amp; acknowledge
                </div>
              </div>
              <ChevronRight size={18} strokeWidth={2} color={COLORS.textSecondary} />
            </motion.button>

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
                    onClick={() => { triggerHaptic('light'); setShowAlerts(true); }}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    whileTap={{ scale: 0.99 }}
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
                      cursor: 'pointer',
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
                      <Icon size={18} />
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
                            fontSize: 16,
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
              {/* View all footer */}
              <motion.div
                onClick={() => { triggerHaptic('light'); setShowAlerts(true); }}
                whileTap={{ scale: 0.98 }}
                style={{
                  padding: `${SPACE.sm}px ${SPACE.base}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: SPACE.xs,
                  borderTop: `1px solid ${COLORS.border}`,
                  cursor: 'pointer',
                  background: `${COLORS.crit}04`,
                }}
              >
                <Mono tone="crit" size="xs">VIEW ALL 15 ALERTS</Mono>
                <ChevronRight size={14} strokeWidth={2} color={COLORS.crit} />
              </motion.div>
            </TacticalCard>
          </motion.div>
        )}

        {/* ────── COMMS ─────────────────────────────────────── */}
        {activeTab === 'comms' && (
          <motion.div
            key="comms"
            initial={{ opacity: 0 }}
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
            <MobileScreenHeader
              role={currentUser.role}
              page="COMMS"
              title="Comms Channel"
            />

            {/* Full messaging launcher */}
            <motion.button
              type="button"
              onClick={() => { triggerHaptic('light'); setShowMessaging(true); }}
              whileTap={{ scale: 0.98 }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                padding: `${SPACE.md}px ${SPACE.base}px`,
                background: `linear-gradient(90deg, ${COLORS.info}10 0%, ${COLORS.info}02 100%)`,
                border: `1px solid ${COLORS.info}`,
                borderLeft: `3px solid ${COLORS.info}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textPrimary,
                fontFamily: FONTS.sans,
                textAlign: 'left',
                cursor: 'pointer',
                overflow: 'hidden',
                minHeight: 48,
                width: '100%',
              }}
            >
              <CornerBracket position="tl" color={COLORS.info} size={6} thickness={1} inset={-1} />
              <CornerBracket position="br" color={COLORS.info} size={6} thickness={1} inset={-1} />
              <div
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: `${COLORS.info}18`,
                  border: `1px solid ${COLORS.info}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.info,
                }}
              >
                <MessageSquare size={18} strokeWidth={2} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <BracketLabel tone="info" size="xs">SECURE MESSAGING</BracketLabel>
                <div style={{ marginTop: 2, fontFamily: FONTS.sans, fontSize: 15, fontWeight: 600, color: COLORS.textPrimary }}>
                  6 channels · 3 unread threads
                </div>
              </div>
              <ChevronRight size={18} strokeWidth={2} color={COLORS.textSecondary} />
            </motion.button>

            {/* ── DIRECT MESSAGES ──────────────────────────────────
                Person-to-person threads. Monogram avatars make these
                visually distinct from channels (# prefix, group feel). */}
            <div>
              <SectionHeader
                id="DM"
                label="DIRECT MESSAGES"
                right={
                  <Mono tone="dim" size="xs">
                    2 UNREAD
                  </Mono>
                }
              />
              <TacticalCard padding="none">
                {[
                  {
                    id: 'dm-jenkins',
                    name: 'Dr. Jenkins',
                    role: 'Trauma Attending',
                    preview: 'Patient stabilized, moving to CT.',
                    time: '2m',
                    status: 'online' as const,
                    unread: true,
                    initials: 'DJ',
                    avatarColor: COLORS.crit,
                  },
                  {
                    id: 'dm-torres',
                    name: 'RN Torres',
                    role: 'Charge Nurse · ED',
                    preview: 'Bed 6B ready for admit, calling report now.',
                    time: '8m',
                    status: 'online' as const,
                    unread: true,
                    initials: 'ET',
                    avatarColor: COLORS.info,
                  },
                  {
                    id: 'dm-pharm',
                    name: 'Pharm · Diaz',
                    role: 'Clinical Pharmacist',
                    preview: 'Vanco trough is 14.2, dose is good.',
                    time: '15m',
                    status: 'away' as const,
                    unread: false,
                    initials: 'MD',
                    avatarColor: COLORS.textSecondary,
                  },
                ].map((dm, i, arr) => (
                  <motion.div
                    key={dm.id}
                    onClick={() => { triggerHaptic('light'); setShowMessaging(true); }}
                    whileTap={{ scale: 0.99 }}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04, duration: MOTION.base, ease: MOTION.ease }}
                    style={{
                      padding: SPACE.base,
                      minHeight: 72,
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.md,
                      borderBottom: i !== arr.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                      cursor: 'pointer',
                      background: dm.unread ? `linear-gradient(90deg, ${dm.avatarColor}06 0%, transparent 50%)` : 'transparent',
                    }}
                  >
                    {/* Round monogram avatar — clearly "a person" */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `${dm.avatarColor}18`,
                        border: `1px solid ${dm.avatarColor}`,
                        borderRadius: RADIUS.full,
                        color: dm.avatarColor,
                        fontFamily: FONTS.mono,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        position: 'relative',
                      }}
                    >
                      {dm.initials}
                      {/* presence dot */}
                      <span
                        aria-hidden
                        style={{
                          position: 'absolute',
                          bottom: -2,
                          right: -2,
                          width: 10,
                          height: 10,
                          borderRadius: RADIUS.full,
                          background: dm.status === 'online' ? COLORS.ok : COLORS.warn,
                          border: `2px solid ${COLORS.bg}`,
                        }}
                      />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: SPACE.sm,
                          marginBottom: 2,
                        }}
                      >
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 15,
                            fontWeight: dm.unread ? 600 : 500,
                            color: dm.unread ? COLORS.textPrimary : COLORS.textSecondary,
                            letterSpacing: '-0.01em',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {dm.name}
                        </div>
                        <Mono tone="dim" size="xs">
                          {dm.time}
                        </Mono>
                      </div>
                      <div
                        style={{
                          fontFamily: FONTS.mono,
                          fontSize: 10,
                          color: COLORS.textMuted,
                          letterSpacing: '0.06em',
                          textTransform: 'uppercase' as const,
                          marginBottom: 3,
                        }}
                      >
                        {dm.role}
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: FONTS.sans,
                          fontSize: TYPE.bodySm.size,
                          color: dm.unread ? COLORS.textSecondary : COLORS.textMuted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {dm.preview}
                      </p>
                    </div>
                    {dm.unread ? (
                      <div
                        aria-hidden
                        title="Unread"
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: RADIUS.full,
                          background: COLORS.info,
                          boxShadow: `0 0 6px ${COLORS.info}`,
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <ChevronRight
                        size={16}
                        color={COLORS.textMuted}
                        style={{ flexShrink: 0 }}
                      />
                    )}
                  </motion.div>
                ))}
              </TacticalCard>
            </div>

            {/* ── CHANNELS ──────────────────────────────────────────
                Team / group threads. Distinguished by square-framed
                `#` glyphs and member counts so at a glance you know
                these are broadcasts, not 1:1s. */}
            <div>
              <SectionHeader
                id="CH"
                label="CHANNELS"
                right={
                  <Mono tone="dim" size="xs">
                    6 TOTAL · 1 UNREAD
                  </Mono>
                }
              />
              <TacticalCard padding="none">
                {[
                  {
                    id: 'ch-trauma',
                    name: 'trauma-alpha',
                    members: 12,
                    preview: 'Dr. Chen: Incoming MVA, ETA 7 min. Level 1.',
                    time: '4m',
                    unread: true,
                    unreadCount: 3,
                    tone: COLORS.crit,
                  },
                  {
                    id: 'ch-ed',
                    name: 'ed-floor',
                    members: 28,
                    preview: 'Bed 14 cleaned, ready for turnover.',
                    time: '22m',
                    unread: false,
                    tone: COLORS.info,
                  },
                  {
                    id: 'ch-pharmacy',
                    name: 'pharmacy-consults',
                    members: 6,
                    preview: 'Pharm: Vanco trough review complete.',
                    time: '1h',
                    unread: false,
                    tone: COLORS.textSecondary,
                  },
                ].map((ch, i, arr) => (
                  <motion.div
                    key={ch.id}
                    onClick={() => { triggerHaptic('light'); setShowMessaging(true); }}
                    whileTap={{ scale: 0.99 }}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.12 + i * 0.04, duration: MOTION.base, ease: MOTION.ease }}
                    style={{
                      padding: SPACE.base,
                      minHeight: 68,
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.md,
                      borderBottom: i !== arr.length - 1 ? `1px solid ${COLORS.border}` : 'none',
                      cursor: 'pointer',
                      background: ch.unread ? `linear-gradient(90deg, ${ch.tone}06 0%, transparent 50%)` : 'transparent',
                    }}
                  >
                    {/* Square-framed # glyph — clearly "a channel" */}
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        flexShrink: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: `${ch.tone}10`,
                        border: `1px solid ${ch.tone}`,
                        borderRadius: RADIUS.sm,
                        color: ch.tone,
                        fontFamily: FONTS.mono,
                        fontSize: 18,
                        fontWeight: 700,
                        position: 'relative',
                      }}
                    >
                      #
                      <CornerBracket position="tl" color={ch.tone} size={4} thickness={1} inset={-1} />
                      <CornerBracket position="br" color={ch.tone} size={4} thickness={1} inset={-1} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: SPACE.sm,
                          marginBottom: 2,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            gap: 6,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              fontFamily: FONTS.mono,
                              fontSize: 14,
                              fontWeight: ch.unread ? 700 : 600,
                              color: ch.unread ? COLORS.textPrimary : COLORS.textSecondary,
                              letterSpacing: '0.02em',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {ch.name}
                          </div>
                          <Mono tone="dim" size="xs">
                            · {ch.members}
                          </Mono>
                        </div>
                        <Mono tone="dim" size="xs">
                          {ch.time}
                        </Mono>
                      </div>
                      <p
                        style={{
                          margin: 0,
                          fontFamily: FONTS.sans,
                          fontSize: TYPE.bodySm.size,
                          color: ch.unread ? COLORS.textSecondary : COLORS.textMuted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {ch.preview}
                      </p>
                    </div>
                    {ch.unread ? (
                      <div
                        aria-hidden
                        title={`${ch.unreadCount} unread`}
                        style={{
                          minWidth: 20,
                          height: 20,
                          padding: '0 6px',
                          borderRadius: RADIUS.full,
                          background: ch.tone,
                          color: COLORS.bg,
                          fontFamily: FONTS.mono,
                          fontSize: 11,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                          boxShadow: `0 0 8px ${ch.tone}80`,
                        }}
                      >
                        {ch.unreadCount}
                      </div>
                    ) : (
                      <ChevronRight
                        size={16}
                        color={COLORS.textMuted}
                        style={{ flexShrink: 0 }}
                      />
                    )}
                  </motion.div>
                ))}
                {/* View all channels footer */}
                <motion.div
                  onClick={() => { triggerHaptic('light'); setShowMessaging(true); }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    padding: `${SPACE.sm}px ${SPACE.base}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: SPACE.xs,
                    borderTop: `1px solid ${COLORS.border}`,
                    cursor: 'pointer',
                    background: `${COLORS.info}04`,
                  }}
                >
                  <Mono tone="info" size="xs">VIEW ALL 6 CHANNELS</Mono>
                  <ChevronRight size={14} strokeWidth={2} color={COLORS.info} />
                </motion.div>
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
              icon={<Radio size={16} />}
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
              (item.id === 'actions' && myTasks.length > 0) || item.id === 'alerts';
            const badgeTone =
              item.id === 'actions' ? COLORS.accent : COLORS.info;
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
                  minHeight: 48,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  padding: `${SPACE.md}px 2px`,
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
                    size={18}
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
                    fontSize: 10,
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

      {/* Patient Detail Overlay — mobile-native version */}
      {selectedPatient && selectedPatient.clinical && (
        <MobilePatientDetailScreen
          patient={selectedPatient.clinical}
          onClose={() => setSelectedPatient(null)}
          onSave={() => showToast('Patient record updated', 'success')}
          showToast={showToast}
          onOpenNote={() => { triggerHaptic('light'); setShowNoteComposer(true); }}
          onOpenOrders={() => { triggerHaptic('light'); setShowOrderEntry(true); }}
          onOpenDischarge={() => { triggerHaptic('light'); setShowDischargeFlow(true); }}
          onOpenCodeBlue={() => { triggerHaptic('heavy'); setShowCodeBlue(true); }}
          onPrintQR={() => {
            triggerHaptic('light');
            setShowPrintPatientQR(selectedPatient.clinical as Patient);
          }}
          onSendTo={() => {
            triggerHaptic('light');
            const pid = (selectedPatient.clinical as Patient).id;
            setSendToPatientId(pid);
          }}
        />
      )}

      {/* Patient QR print preview — renders the printable PatientQRCard
          inside the tactical print-preview chrome. Tap Confirm Print to
          invoke window.print(); the card's sharp B/W layout is designed
          to survive being copied or laminated as a wristband. */}
      <PrintPreviewModal
        isOpen={!!showPrintPatientQR}
        onClose={() => setShowPrintPatientQR(null)}
        onPrint={() => window.print()}
        title={
          showPrintPatientQR
            ? `QR Card · ${showPrintPatientQR.name.family.toUpperCase()}, ${showPrintPatientQR.name.given}`
            : 'QR Card'
        }
        content={
          showPrintPatientQR ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '16px 0',
              }}
            >
              <PatientQRCard patient={showPrintPatientQR} cutLine />
            </div>
          ) : null
        }
      />

      {/* EMS Inbound Board — fullscreen overlay variant. Same hook
          source as the dashboard tile so any acknowledgement made
          here propagates to that view in lockstep. */}
      <EmsInboundBoard
        display="full"
        open={showEmsBoard}
        onClose={() => setShowEmsBoard(false)}
      />

      {/* Bed Board — fullscreen overlay. Shows all units with
          bed tiles, state filtering, and bed detail popovers. */}
      <BedBoard
        display="full"
        units={bedUnits}
        surgeActive={isSurgeActive}
        open={showBedBoard}
        onClose={() => setShowBedBoard(false)}
        role={currentUser.role}
      />

      {/* Admit Flow — mobile-native single-screen admission form.
          Unlike desktop AdmitFlow (3-step wizard), this exposes every
          field at once. Admission proceeds with bed deferred —
          patient lands in the holding area tagged `admitted-unassigned`.
          When `prefilledBraceletNumber` is set (from a scan of an empty
          bracelet), Step 1 opens with that slot already picked. */}
      <MobileAdmitFlow
        open={showAdmitFlow}
        onClose={() => {
          setShowAdmitFlow(false);
          setPrefilledBraceletNumber('');
        }}
        showToast={showToast}
        onSubmitAdmission={onSubmitAdmission}
        bedUnits={bedUnits}
        availableBraceletNumbers={availableBraceletNumbers}
        prefilledBraceletNumber={prefilledBraceletNumber || undefined}
      />

      {/* Discharge Flow — readiness checklist → disposition → confirm
          discharge. Closes encounter and frees bed. Syncs across devices. */}
      <DischargeFlow
        open={showDischargeFlow}
        onClose={() => setShowDischargeFlow(false)}
        showToast={(msg: string) => showToast(msg, 'success')}
        patients={syncedPatients}
        onDischargePatient={onDischargePatient}
      />

      {/* Note Composer — SOAP / H&P / Progress note wizard. Syncs notes across devices. */}
      <NoteComposer
        open={showNoteComposer}
        onClose={() => setShowNoteComposer(false)}
        showToast={(msg: string) => showToast(msg, 'success')}
        onAddNote={onAddNote}
      />

      {/* Order Entry (CPOE) — meds, labs, imaging, consults. */}
      <OrderEntry
        open={showOrderEntry}
        onClose={() => setShowOrderEntry(false)}
        showToast={(msg: string) => showToast(msg, 'success')}
      />

      {/* Code Blue — cardiac arrest / rapid response management. */}
      <CodeBlueScreen
        open={showCodeBlue}
        onClose={() => setShowCodeBlue(false)}
        showToast={(msg: string) => showToast(msg, 'error')}
        location="ICU-3"
      />

      {/* Handoff Composer — SBAR shift handoff notes. */}
      <HandoffComposer
        open={showHandoff}
        onClose={() => setShowHandoff(false)}
        showToast={(msg: string) => showToast(msg, 'success')}
      />

      {/* Secure Messaging — clinical communication hub. */}
      <SecureMessaging
        open={showMessaging}
        onClose={() => setShowMessaging(false)}
        showToast={(msg: string) => showToast(msg, 'info')}
      />

      {/* Workforce Coverage — staffing across all units. */}
      <WorkforceCoverage
        open={showWorkforce}
        onClose={() => setShowWorkforce(false)}
        showToast={(msg: string) => showToast(msg, 'info')}
        role={currentUser.role}
      />

      {/* Alerts Center — hospital-wide alert feed. Acknowledgments sync across devices. */}
      <AlertsCenter
        open={showAlerts}
        onClose={() => setShowAlerts(false)}
        showToast={(msg: string) => showToast(msg, 'info')}
        role={currentUser.role}
        alertAcks={alertAcks}
        onAcknowledgeAlert={onAcknowledgeAlert}
      />

      {/* Dept Coordination — multi-department C2 view. */}
      <DeptCoordination
        open={showDeptCoord}
        onClose={() => setShowDeptCoord(false)}
        showToast={(msg: string) => showToast(msg, 'info')}
      />

      {/* Brief Me — AI operational briefing. */}
      <BriefMeScreen
        open={showBriefMe}
        onClose={() => setShowBriefMe(false)}
        showToast={(msg: string) => showToast(msg, 'info')}
      />

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

      {/* Empty bracelet prompt — shown after scanning an unassigned
          wristband (SCAD demo). Offers "Admit with this bracelet?". */}
      <AnimatePresence>
        {emptyBraceletPrompt && (
          <EmptyBraceletSheet
            number={emptyBraceletPrompt}
            onAdmit={(n) => {
              setEmptyBraceletPrompt(null);
              setPrefilledBraceletNumber(n);
              setShowAdmitFlow(true);
            }}
            onCancel={() => setEmptyBraceletPrompt(null)}
          />
        )}
      </AnimatePresence>

      {/* Send-to device sheet — multi-select peer picker that
          broadcasts `open-patient` to the chosen devices. */}
      <AnimatePresence>
        {sendToPatientId && (
          <SendToSheet
            patientId={sendToPatientId}
            patientName={(() => {
              const p = syncedPatients.find((x) => x.id === sendToPatientId);
              return p ? `${p.name.family}, ${p.name.given}` : undefined;
            })()}
            onSend={(targetDeviceIds) => {
              publish('open-patient', {
                patientId: sendToPatientId,
                targetDeviceIds,
                fromName: getDeviceName(),
              });
              const count = targetDeviceIds.length;
              showToast(
                count === 1 ? 'Chart sent to 1 device' : `Chart sent to ${count} devices`,
                'success',
              );
              setSendToPatientId(null);
            }}
            onCancel={() => setSendToPatientId(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};
