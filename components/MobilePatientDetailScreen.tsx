/**
 * MobilePatientDetailScreen — phone-optimised patient detail view.
 *
 * Single-column, vertical scroll, fully phone-friendly. Replaces the
 * desktop PatientDetailScreen's two-column grid layout for mobile use.
 *
 * Renders as a fullscreen overlay (position: fixed, inset: 0, z-index 50)
 * with slide-up entry animation.
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  HeartPulse,
  FileText,
  Pill,
  AlertTriangle,
  Shield,
  Users,
  Thermometer,
  Activity,
  Brain,
  Eye,
  DoorOpen,
  Siren,
  QrCode,
} from 'lucide-react';
import { Patient } from '../types';
import { ageInYears } from '../data/clinicalMock';
import { computeAllScores } from '../lib/clinicalScores';
import type { EarlyWarningScore } from '../types';
import { useSwipeBack } from '../lib/useSwipeBack';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
  Divider,
} from './design';

// ─────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────

interface MobilePatientDetailScreenProps {
  patient: Patient;
  onClose: () => void;
  onSave?: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  /** Open SOAP / H&P note composer for this patient. */
  onOpenNote?: () => void;
  /** Open CPOE order entry for this patient. */
  onOpenOrders?: () => void;
  /** Open discharge workflow for this patient. */
  onOpenDischarge?: () => void;
  /** Trigger Code Blue rapid-response screen for this patient's location. */
  onOpenCodeBlue?: () => void;
  /** Open vitals entry for this patient. */
  onOpenVitals?: () => void;
  /** Open the printable QR ID-band preview for this patient. */
  onPrintQR?: () => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

const formatDate = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const formatTime = (iso: string): string => {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

const formatDateTime = (iso: string): string => `${formatDate(iso)} ${formatTime(iso)}`;

const sexLabel = (sex: Patient['sex']): string => {
  switch (sex) {
    case 'M': return 'Male';
    case 'F': return 'Female';
    case 'X': return 'Nonbinary';
    case 'U': return 'Unknown';
  }
};

const computeBMI = (weightKg?: number, heightCm?: number): string | null => {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return (weightKg / (m * m)).toFixed(1);
};

/** Map risk level to a design-system status tone. */
const riskTone = (risk: 'low' | 'moderate' | 'high' | 'critical'): 'ok' | 'warn' | 'crit' => {
  switch (risk) {
    case 'low': return 'ok';
    case 'moderate': return 'warn';
    case 'high': return 'crit';
    case 'critical': return 'crit';
  }
};

const riskColor = (risk: 'low' | 'moderate' | 'high' | 'critical'): string => {
  switch (risk) {
    case 'low': return COLORS.ok;
    case 'moderate': return COLORS.warn;
    case 'high': return COLORS.crit;
    case 'critical': return COLORS.crit;
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Vital card value color — threshold-based
// ─────────────────────────────────────────────────────────────────────────

type VitalStatus = 'normal' | 'warning' | 'critical';

function hrStatus(v?: number): VitalStatus {
  if (v == null) return 'normal';
  if (v < 50 || v > 130) return 'critical';
  if (v < 60 || v > 100) return 'warning';
  return 'normal';
}

function bpStatus(sys?: number, dia?: number): VitalStatus {
  if (sys == null) return 'normal';
  if (sys < 90 || sys > 180 || (dia != null && dia > 120)) return 'critical';
  if (sys < 100 || sys > 140 || (dia != null && dia > 90)) return 'warning';
  return 'normal';
}

function spo2Status(v?: number): VitalStatus {
  if (v == null) return 'normal';
  if (v < 90) return 'critical';
  if (v < 95) return 'warning';
  return 'normal';
}

function rrStatus(v?: number): VitalStatus {
  if (v == null) return 'normal';
  if (v < 8 || v > 30) return 'critical';
  if (v < 12 || v > 20) return 'warning';
  return 'normal';
}

function tempStatus(v?: number): VitalStatus {
  if (v == null) return 'normal';
  if (v < 35 || v > 39.5) return 'critical';
  if (v < 36 || v > 38) return 'warning';
  return 'normal';
}

function painStatus(v?: number): VitalStatus {
  if (v == null) return 'normal';
  if (v >= 8) return 'critical';
  if (v >= 4) return 'warning';
  return 'normal';
}

const vitalColor = (status: VitalStatus): string => {
  switch (status) {
    case 'critical': return COLORS.crit;
    case 'warning': return COLORS.warn;
    case 'normal': return COLORS.ok;
  }
};

// ─────────────────────────────────────────────────────────────────────────
// Reusable sub-components
// ─────────────────────────────────────────────────────────────────────────

/** Accordion section header — tap to expand / collapse. */
const AccordionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
}> = ({ icon, title, expanded, onToggle, badge }) => (
  <button
    onClick={onToggle}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: SPACE.sm,
      width: '100%',
      minHeight: 44,
      padding: `${SPACE.sm}px 0`,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: COLORS.textPrimary,
      fontFamily: FONTS.sans,
      fontSize: TYPE.bodySm.size,
      fontWeight: 600,
      letterSpacing: TYPE.bodySm.tracking,
      textAlign: 'left',
    }}
  >
    <span style={{ color: COLORS.textSecondary, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {icon}
    </span>
    <span style={{ flex: 1 }}>{title}</span>
    {badge}
    <span style={{ color: COLORS.textMuted, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {expanded ? <ChevronUp size={19} /> : <ChevronDown size={19} />}
    </span>
  </button>
);

/** Small info row — label + value on one line. */
const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}> = ({ label, value, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 28 }}>
    <Mono tone="muted" size="xs">{label}</Mono>
    {mono ? (
      <Mono tone="primary" size="sm">{value}</Mono>
    ) : (
      <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textPrimary }}>
        {value}
      </span>
    )}
  </div>
);

/** Small vital card for the 2-column grid. */
const VitalMiniCard: React.FC<{
  label: string;
  value: string;
  unit?: string;
  status: VitalStatus;
  icon: React.ReactNode;
}> = ({ label, value, unit, status, icon }) => (
  <div
    style={{
      background: COLORS.surface,
      border: `1px solid ${status === 'critical' ? COLORS.crit + '40' : status === 'warning' ? COLORS.warn + '40' : COLORS.border}`,
      borderRadius: RADIUS.sm,
      padding: SPACE.md,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
      <span style={{ color: vitalColor(status), display: 'flex', alignItems: 'center' }}>{icon}</span>
      <Mono tone="muted" size="xs">{label}</Mono>
    </div>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 28,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: vitalColor(status),
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {unit && (
        <Mono tone="muted" size="xs">{unit}</Mono>
      )}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Early-warning score chip + breakdown
//
// ScoreChip is the compact tile the clinician sees in the Vitals
// section — three of them sit in a grid (MEWS · NEWS2 · qSOFA).
// Tapping it toggles the expanded ScoreBreakdown which explains
// *why* the number is what it is, parameter-by-parameter, plus a
// one-line action guidance pulled from the score definition.
//
// The components are deliberately dumb. All score computation
// happens upstream in `lib/clinicalScores.ts`. These only render
// the result.
// ─────────────────────────────────────────────────────────────────────────

const ScoreChip: React.FC<{
  score: EarlyWarningScore;
  active: boolean;
  onClick: () => void;
}> = ({ score, active, onClick }) => {
  const color = riskColor(score.risk);
  const tone = riskTone(score.risk);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${score.name} score ${score.value}, ${score.risk} risk — tap to ${active ? 'collapse' : 'expand'} breakdown`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: SPACE.sm,
        background: active ? `${color}14` : `${color}08`,
        border: `1px solid ${active ? color : `${color}25`}`,
        borderRadius: RADIUS.sm,
        cursor: 'pointer',
        textAlign: 'left',
        transition: 'background 120ms ease, border-color 120ms ease',
        minWidth: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, width: '100%' }}>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 28,
            fontWeight: 700,
            color,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {score.value}
        </span>
        <Mono tone="muted" size="xs">
          /{score.maxValue}
        </Mono>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, width: '100%' }}>
        <Mono tone={tone} size="xs">
          {score.name}
        </Mono>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 11,
            letterSpacing: '0.1em',
            color: COLORS.textMuted,
            textTransform: 'uppercase',
          }}
        >
          {score.risk}
        </span>
      </div>
    </button>
  );
};

const ScoreBreakdown: React.FC<{ score: EarlyWarningScore }> = ({ score }) => {
  const color = riskColor(score.risk);
  const tone = riskTone(score.risk);
  return (
    <div
      style={{
        marginTop: SPACE.xs,
        padding: SPACE.md,
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.sm,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.xs }}>
          <Mono tone={tone} size="sm">
            {score.name}
          </Mono>
          <Mono tone="muted" size="xs">
            {score.value} / {score.maxValue}
          </Mono>
        </div>
        <BracketLabel tone={tone} size="xs">
          {score.risk.toUpperCase()} RISK
        </BracketLabel>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {score.breakdown.map((row, i) => {
          const contributes = row.points > 0;
          return (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: SPACE.sm,
                padding: `${SPACE.xs}px ${SPACE.sm}px`,
                background: contributes ? `${color}08` : 'transparent',
                borderRadius: RADIUS.sm,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 15,
                  color: COLORS.textSecondary,
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {row.parameter}
              </span>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: SPACE.xs, flexShrink: 0 }}>
                {row.rawValue != null && (
                  <Mono tone="muted" size="xs">
                    {String(row.rawValue)}
                  </Mono>
                )}
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 15,
                    fontWeight: 600,
                    color: contributes ? color : COLORS.textMuted,
                    fontVariantNumeric: 'tabular-nums',
                    minWidth: 22,
                    textAlign: 'right',
                  }}
                >
                  {row.points > 0 ? `+${row.points}` : '0'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          padding: SPACE.sm,
          background: `${color}10`,
          border: `1px solid ${color}30`,
          borderRadius: RADIUS.sm,
          fontFamily: FONTS.sans,
          fontSize: 15,
          lineHeight: 1.4,
          color: COLORS.textPrimary,
        }}
      >
        <Mono tone={tone} size="xs">
          ACTION
        </Mono>
        <span style={{ marginLeft: 6 }}>{score.action}</span>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Safety banner pills
// ─────────────────────────────────────────────────────────────────────────

const SafetyPill: React.FC<{
  label: string;
  bg: string;
  color: string;
  borderColor?: string;
}> = ({ label, bg, color, borderColor }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      height: 24,
      padding: `0 ${SPACE.sm}px`,
      background: bg,
      border: `1px solid ${borderColor || bg}`,
      borderRadius: RADIUS.full,
      fontFamily: FONTS.mono,
      fontSize: 13,
      fontWeight: 600,
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      color,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}
  >
    {label}
  </span>
);

// ─────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────

export const MobilePatientDetailScreen: React.FC<MobilePatientDetailScreenProps> = ({
  patient,
  onClose,
  onSave: _onSave,
  showToast,
  onOpenNote,
  onOpenOrders,
  onOpenDischarge,
  onOpenCodeBlue,
  onOpenVitals,
  onPrintQR,
}) => {
  // Accordion state
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    info: true,
    encounter: true,
    vitals: true,
    allergies: patient.allergies.length === 0, // NKA = expanded; allergies present = collapsed
    problems: false,
    social: false,
  });

  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

  // Derived data
  const latestVitals = useMemo(
    () => (patient.vitalsHistory.length > 0 ? patient.vitalsHistory[patient.vitalsHistory.length - 1] : null),
    [patient.vitalsHistory],
  );

  const scores = useMemo(
    () => (latestVitals ? computeAllScores(latestVitals) : null),
    [latestVitals],
  );
  // Back-compat alias so the header badge still reads from the MEWS
  // result — NEWS2 and qSOFA render inside the Vitals section panel.
  const mews = scores?.mews ?? null;

  // Which early-warning score's "why this score" breakdown is
  // currently expanded inside the Vitals panel. null = all three show
  // as a compact strip; 'mews' | 'news2' | 'qsofa' = one expanded.
  const [openScore, setOpenScore] = useState<'mews' | 'news2' | 'qsofa' | null>(null);

  const enc = patient.currentEncounter;
  const age = ageInYears(patient.birthDate);
  const bmi = computeBMI(patient.weightKg, patient.heightCm);
  const fullName = `${patient.name.given} ${patient.name.family}`;

  const activeProblems = useMemo(
    () => patient.problems.filter((p) => p.status === 'active' || p.status === 'recurrence'),
    [patient.problems],
  );

  const hasSocialData = !!patient.socialDeterminants && (
    patient.socialDeterminants.housing != null ||
    patient.socialDeterminants.foodSecurity != null ||
    patient.socialDeterminants.transportation != null
  );

  // Code status pill styling
  const codeStatusDangerous = ['DNR', 'DNI', 'DNR/DNI', 'COMFORT'].includes(patient.codeStatus);
  const codeStatusBg = codeStatusDangerous ? COLORS.critDim : COLORS.okDim;
  const codeStatusColor = codeStatusDangerous ? COLORS.crit : COLORS.ok;

  // Isolation pill styling
  const isolationColors: Record<string, { bg: string; color: string }> = {
    CONTACT: { bg: COLORS.warnDim, color: COLORS.warn },
    DROPLET: { bg: COLORS.warnDim, color: COLORS.warn },
    AIRBORNE: { bg: COLORS.critDim, color: COLORS.crit },
    PROTECTIVE: { bg: COLORS.infoDim, color: COLORS.info },
  };

  // Bed assignment warning
  const bedUnassigned =
    enc?.bedAssignmentStatus === 'admitted-unassigned' || (enc != null && !enc.location?.bed);

  // Arrival mode display
  const arrivalModeLabel = (mode?: string): string => {
    switch (mode) {
      case 'ambulatory': return 'Ambulatory';
      case 'ems': return 'EMS';
      case 'private-vehicle': return 'Private Vehicle';
      case 'transfer': return 'Transfer';
      case 'walk-in': return 'Walk-in';
      default: return mode || '--';
    }
  };

  // Social determinant chip color
  const sdColor = (val?: string): { bg: string; color: string } => {
    if (!val) return { bg: COLORS.surface, color: COLORS.textMuted };
    const risk = ['unstable', 'unhoused', 'risk', 'insecure', 'inconsistent', 'none'];
    const stable = ['stable', 'secure', 'has-reliable'];
    if (risk.includes(val)) return { bg: COLORS.warnDim, color: COLORS.warn };
    if (stable.includes(val)) return { bg: COLORS.okDim, color: COLORS.ok };
    return { bg: COLORS.surface, color: COLORS.textSecondary };
  };

  // Boolean social det helper
  const boolSDColor = (val?: boolean): { bg: string; color: string } => {
    if (val === true) return { bg: COLORS.okDim, color: COLORS.ok };
    if (val === false) return { bg: COLORS.critDim, color: COLORS.crit };
    return { bg: COLORS.surface, color: COLORS.textMuted };
  };

  // iOS-style edge-swipe-to-close gesture
  const swipeBackRef = useSwipeBack<HTMLDivElement>({ onSwipeBack: onClose });

  return (
    <AnimatePresence>
      <motion.div
        key="patient-detail-overlay"
        ref={swipeBackRef}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: COLORS.bg,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONTS.sans,
          color: COLORS.textPrimary,
          overflow: 'hidden',
        }}
      >
        {/* ── 1. FIXED HEADER ────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            height: `calc(56px + env(safe-area-inset-top))`,
            paddingTop: 'env(safe-area-inset-top)',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: `max(${SPACE.sm}px, env(safe-area-inset-left))`,
            paddingRight: `max(${SPACE.sm}px, env(safe-area-inset-right))`,
            background: COLORS.surface,
            borderBottom: `1px solid ${COLORS.border}`,
            zIndex: 2,
          }}
        >
          {/* Back button */}
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              minWidth: 44,
              minHeight: 44,
              padding: `0 ${SPACE.sm}px`,
              background: 'none',
              border: 'none',
              color: COLORS.accent,
              fontFamily: FONTS.sans,
              fontSize: TYPE.bodySm.size,
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={23} />
            Back
          </button>

          {/* Patient name — center */}
          <div
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: FONTS.sans,
              fontSize: TYPE.bodySm.size,
              fontWeight: 600,
              letterSpacing: TYPE.bodySm.tracking,
              color: COLORS.textPrimary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: `0 ${SPACE.sm}px`,
            }}
          >
            {fullName}
          </div>

          {/* Print QR — small action button, only rendered when the
              parent wires an onPrintQR callback. Shows a QrCode icon
              so it's instantly readable next to the ESI badge. */}
          {onPrintQR && (
            <button
              type="button"
              onClick={onPrintQR}
              aria-label="Print patient QR ID band"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 28,
                marginRight: SPACE.xs,
                padding: 0,
                background: COLORS.surfaceElev,
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textSecondary,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <QrCode size={17} strokeWidth={1.75} />
            </button>
          )}

          {/* ESI badge — right */}
          {enc?.esi && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 28,
                minWidth: 56,
                padding: `0 ${SPACE.sm}px`,
                background: enc.esi <= 2 ? COLORS.critDim : enc.esi === 3 ? COLORS.warnDim : COLORS.okDim,
                border: `1px solid ${enc.esi <= 2 ? COLORS.crit + '40' : enc.esi === 3 ? COLORS.warn + '40' : COLORS.ok + '40'}`,
                borderRadius: RADIUS.full,
                fontFamily: FONTS.mono,
                fontSize: 14,
                fontWeight: 600,
                letterSpacing: '0.1em',
                color: enc.esi <= 2 ? COLORS.crit : enc.esi === 3 ? COLORS.warn : COLORS.ok,
                flexShrink: 0,
              }}
            >
              ESI {enc.esi}
            </span>
          )}
        </div>

        {/* ── 2. SAFETY BANNER ───────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.sm,
            padding: `${SPACE.sm}px ${SPACE.base}px`,
            background: COLORS.surface,
            borderBottom: `1px solid ${COLORS.border}`,
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            msOverflowStyle: 'none',
            scrollbarWidth: 'none',
          }}
        >
          {/* Code Status */}
          <SafetyPill
            label={patient.codeStatus}
            bg={codeStatusBg}
            color={codeStatusColor}
            borderColor={codeStatusColor + '30'}
          />

          {/* Isolation */}
          {patient.isolation !== 'NONE' && (
            <SafetyPill
              label={patient.isolation}
              bg={isolationColors[patient.isolation]?.bg || COLORS.warnDim}
              color={isolationColors[patient.isolation]?.color || COLORS.warn}
              borderColor={(isolationColors[patient.isolation]?.color || COLORS.warn) + '30'}
            />
          )}

          {/* Allergies count */}
          <SafetyPill
            label={patient.allergies.length > 0 ? `${patient.allergies.length} ALLERG${patient.allergies.length === 1 ? 'Y' : 'IES'}` : 'NKA'}
            bg={patient.allergies.length > 0 ? COLORS.critDim : COLORS.okDim}
            color={patient.allergies.length > 0 ? COLORS.crit : COLORS.ok}
            borderColor={(patient.allergies.length > 0 ? COLORS.crit : COLORS.ok) + '30'}
          />
        </div>

        {/* ── 3. SCROLLABLE CONTENT ──────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            padding: `${SPACE.base}px`,
            paddingBottom: `calc(${SPACE.base}px + 72px + env(safe-area-inset-bottom))`,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.md,
          }}
        >
          {/* ── Section A: Patient Info ───────────────────────────── */}
          <TacticalCard padding="sm">
            <AccordionHeader
              icon={<Users size={19} />}
              title="Patient Info"
              expanded={expanded.info}
              onToggle={() => toggle('info')}
            />
            <AnimatePresence initial={false}>
              {expanded.info && (
                <motion.div
                  key="info-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                  style={{ overflow: 'hidden' }}
                >
                  <Divider style={{ margin: `${SPACE.xs}px 0` }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: SPACE.sm }}>
                    <InfoRow label="NAME" value={fullName} />
                    {patient.name.preferred && patient.name.preferred !== patient.name.given && (
                      <InfoRow label="PREFERRED" value={patient.name.preferred} />
                    )}
                    <InfoRow label="MRN" value={patient.mrn} mono />
                    <InfoRow label="DOB" value={formatDate(patient.birthDate)} />
                    <InfoRow label="AGE" value={`${age} yr`} />
                    <InfoRow label="SEX" value={sexLabel(patient.sex)} />
                    <InfoRow label="LANGUAGE" value={patient.preferredLanguage.toUpperCase()} mono />
                    {patient.needsInterpreter && (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: SPACE.xs,
                          padding: `4px ${SPACE.sm}px`,
                          background: COLORS.warnDim,
                          border: `1px solid ${COLORS.warn}30`,
                          borderRadius: RADIUS.sm,
                          marginTop: 4,
                        }}
                      >
                        <AlertTriangle size={15} color={COLORS.warn} />
                        <Mono tone="warn" size="xs">INTERPRETER NEEDED</Mono>
                      </div>
                    )}
                    {patient.weightKg != null && (
                      <InfoRow label="WEIGHT" value={`${patient.weightKg} kg`} mono />
                    )}
                    {patient.heightCm != null && (
                      <InfoRow label="HEIGHT" value={`${patient.heightCm} cm`} mono />
                    )}
                    {bmi && (
                      <InfoRow label="BMI" value={bmi} mono />
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TacticalCard>

          {/* ── Section B: Bed & Encounter ────────────────────────── */}
          <TacticalCard padding="sm">
            <AccordionHeader
              icon={<Eye size={19} />}
              title="Bed & Encounter"
              expanded={expanded.encounter}
              onToggle={() => toggle('encounter')}
              badge={bedUnassigned ? (
                <span style={{
                  width: 8, height: 8, borderRadius: RADIUS.full,
                  background: COLORS.warn, boxShadow: `0 0 6px ${COLORS.warn}`,
                  flexShrink: 0,
                }} />
              ) : undefined}
            />
            <AnimatePresence initial={false}>
              {expanded.encounter && (
                <motion.div
                  key="encounter-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                  style={{ overflow: 'hidden' }}
                >
                  <Divider style={{ margin: `${SPACE.xs}px 0` }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: SPACE.sm }}>
                    {/* Bed assignment warning */}
                    {bedUnassigned && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: SPACE.sm,
                          padding: SPACE.md,
                          background: COLORS.warnDim,
                          border: `1px solid ${COLORS.warn}30`,
                          borderRadius: RADIUS.sm,
                          marginBottom: SPACE.sm,
                        }}
                      >
                        <AlertTriangle size={19} color={COLORS.warn} style={{ flexShrink: 0 }} />
                        <span style={{
                          fontFamily: FONTS.sans,
                          fontSize: TYPE.bodySm.size,
                          fontWeight: 600,
                          color: COLORS.warn,
                          lineHeight: 1.3,
                        }}>
                          UNASSIGNED — Patient admitted without bed assignment
                        </span>
                      </div>
                    )}

                    {/* Bed & zone */}
                    {enc?.location?.bed && (
                      <InfoRow label="BED" value={enc.location.bed} mono />
                    )}
                    {enc?.location?.zone && (
                      <InfoRow label="ZONE" value={enc.location.zone} mono />
                    )}
                    {enc && (
                      <>
                        <InfoRow label="CLASS" value={enc.class} mono />
                        <InfoRow label="STATUS" value={enc.status.toUpperCase()} mono />
                        <InfoRow label="ADMITTED" value={formatDateTime(enc.admittedAt)} />
                        {enc.chiefComplaint && (
                          <InfoRow label="CHIEF COMPLAINT" value={enc.chiefComplaint} />
                        )}
                        {enc.esi && (
                          <InfoRow label="ESI" value={`Level ${enc.esi}`} mono />
                        )}
                        {enc.arrivalMode && (
                          <InfoRow label="ARRIVAL" value={arrivalModeLabel(enc.arrivalMode)} />
                        )}
                      </>
                    )}
                    {!enc && (
                      <div style={{ padding: SPACE.sm }}>
                        <Mono tone="muted" size="sm">No active encounter</Mono>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TacticalCard>

          {/* ── Section C: Vitals ─────────────────────────────────── */}
          <TacticalCard padding="sm">
            <AccordionHeader
              icon={<Activity size={19} />}
              title="Vitals"
              expanded={expanded.vitals}
              onToggle={() => toggle('vitals')}
              badge={mews ? (
                <StatusPill
                  label={`MEWS ${mews.value}`}
                  tone={riskTone(mews.risk)}
                  size="xs"
                />
              ) : undefined}
            />
            <AnimatePresence initial={false}>
              {expanded.vitals && (
                <motion.div
                  key="vitals-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                  style={{ overflow: 'hidden' }}
                >
                  <Divider style={{ margin: `${SPACE.xs}px 0` }} />
                  {latestVitals ? (
                    <div style={{ paddingTop: SPACE.sm }}>
                      {/* 2-column vital grid */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: SPACE.sm,
                        }}
                      >
                        <VitalMiniCard
                          label="HR"
                          value={latestVitals.heartRate != null ? String(latestVitals.heartRate) : '--'}
                          unit="bpm"
                          status={hrStatus(latestVitals.heartRate)}
                          icon={<HeartPulse size={17} />}
                        />
                        <VitalMiniCard
                          label="BP"
                          value={
                            latestVitals.systolic != null && latestVitals.diastolic != null
                              ? `${latestVitals.systolic}/${latestVitals.diastolic}`
                              : '--'
                          }
                          unit="mmHg"
                          status={bpStatus(latestVitals.systolic, latestVitals.diastolic)}
                          icon={<Activity size={17} />}
                        />
                        <VitalMiniCard
                          label="SpO2"
                          value={latestVitals.spO2 != null ? String(latestVitals.spO2) : '--'}
                          unit="%"
                          status={spo2Status(latestVitals.spO2)}
                          icon={<Shield size={17} />}
                        />
                        <VitalMiniCard
                          label="RR"
                          value={latestVitals.respRate != null ? String(latestVitals.respRate) : '--'}
                          unit="/min"
                          status={rrStatus(latestVitals.respRate)}
                          icon={<Brain size={17} />}
                        />
                        <VitalMiniCard
                          label="TEMP"
                          value={latestVitals.temperature != null ? latestVitals.temperature.toFixed(1) : '--'}
                          unit="C"
                          status={tempStatus(latestVitals.temperature)}
                          icon={<Thermometer size={17} />}
                        />
                        <VitalMiniCard
                          label="PAIN"
                          value={latestVitals.painScore != null ? String(latestVitals.painScore) : '--'}
                          unit="/10"
                          status={painStatus(latestVitals.painScore)}
                          icon={<AlertTriangle size={17} />}
                        />
                      </div>

                      {/* Early-warning triad — MEWS, NEWS2, qSOFA.
                          Tapping a tile expands a "why this score"
                          breakdown (per-parameter contribution + one-
                          line action guidance) so the bedside
                          clinician can justify the number without
                          leaving the patient detail screen. */}
                      {scores && (
                        <div
                          style={{
                            marginTop: SPACE.md,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: SPACE.sm,
                          }}
                        >
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '1fr 1fr 1fr',
                              gap: SPACE.xs,
                            }}
                          >
                            <ScoreChip
                              score={scores.mews}
                              active={openScore === 'mews'}
                              onClick={() =>
                                setOpenScore(openScore === 'mews' ? null : 'mews')
                              }
                            />
                            <ScoreChip
                              score={scores.news2}
                              active={openScore === 'news2'}
                              onClick={() =>
                                setOpenScore(openScore === 'news2' ? null : 'news2')
                              }
                            />
                            <ScoreChip
                              score={scores.qsofa}
                              active={openScore === 'qsofa'}
                              onClick={() =>
                                setOpenScore(openScore === 'qsofa' ? null : 'qsofa')
                              }
                            />
                          </div>
                          <AnimatePresence initial={false}>
                            {openScore && (
                              <motion.div
                                key={`score-breakdown-${openScore}`}
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                                style={{ overflow: 'hidden' }}
                              >
                                <ScoreBreakdown
                                  score={
                                    openScore === 'mews'
                                      ? scores.mews
                                      : openScore === 'news2'
                                      ? scores.news2
                                      : scores.qsofa
                                  }
                                />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      )}

                      {/* Vitals timestamp */}
                      <div style={{ marginTop: SPACE.sm, textAlign: 'right' }}>
                        <Mono tone="muted" size="xs">
                          Recorded {formatDateTime(latestVitals.timestamp)}
                        </Mono>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: SPACE.base }}>
                      <Mono tone="muted" size="sm">No vitals recorded</Mono>
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </TacticalCard>

          {/* ── Section D: Allergies ──────────────────────────────── */}
          <TacticalCard padding="sm">
            <AccordionHeader
              icon={<AlertTriangle size={19} />}
              title="Allergies"
              expanded={expanded.allergies}
              onToggle={() => toggle('allergies')}
              badge={
                patient.allergies.length > 0 ? (
                  <StatusPill label={`${patient.allergies.length}`} tone="crit" size="xs" />
                ) : (
                  <StatusPill label="NKA" tone="ok" size="xs" />
                )
              }
            />
            <AnimatePresence initial={false}>
              {expanded.allergies && (
                <motion.div
                  key="allergies-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                  style={{ overflow: 'hidden' }}
                >
                  <Divider style={{ margin: `${SPACE.xs}px 0` }} />
                  <div style={{ paddingTop: SPACE.sm }}>
                    {patient.allergies.length === 0 ? (
                      <div style={{ padding: SPACE.sm }}>
                        <Mono tone="ok" size="sm">No Known Allergies</Mono>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                        {patient.allergies.map((a) => (
                          <div
                            key={a.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              padding: `${SPACE.sm}px`,
                              background: COLORS.bgDeep,
                              borderRadius: RADIUS.sm,
                              border: `1px solid ${COLORS.border}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <span style={{
                                fontFamily: FONTS.sans,
                                fontSize: TYPE.bodySm.size,
                                fontWeight: 600,
                                color: COLORS.textPrimary,
                              }}>
                                {a.substance}
                              </span>
                              <SafetyPill
                                label={a.severity === 'high' ? 'HIGH' : a.severity === 'low' ? 'LOW' : 'UNK'}
                                bg={a.severity === 'high' ? COLORS.critDim : a.severity === 'low' ? COLORS.warnDim : COLORS.surface}
                                color={a.severity === 'high' ? COLORS.crit : a.severity === 'low' ? COLORS.warn : COLORS.textMuted}
                              />
                            </div>
                            <Mono tone="secondary" size="xs">Reaction: {a.reaction}</Mono>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TacticalCard>

          {/* ── Section E: Active Problems ────────────────────────── */}
          <TacticalCard padding="sm">
            <AccordionHeader
              icon={<FileText size={19} />}
              title="Active Problems"
              expanded={expanded.problems}
              onToggle={() => toggle('problems')}
              badge={
                activeProblems.length > 0 ? (
                  <Mono tone="muted" size="xs">{activeProblems.length}</Mono>
                ) : undefined
              }
            />
            <AnimatePresence initial={false}>
              {expanded.problems && (
                <motion.div
                  key="problems-body"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                  style={{ overflow: 'hidden' }}
                >
                  <Divider style={{ margin: `${SPACE.xs}px 0` }} />
                  <div style={{ paddingTop: SPACE.sm }}>
                    {activeProblems.length === 0 ? (
                      <div style={{ padding: SPACE.sm }}>
                        <Mono tone="muted" size="sm">No active problems</Mono>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                        {activeProblems.map((p) => (
                          <div
                            key={p.id}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                              padding: `${SPACE.sm}px`,
                              background: COLORS.bgDeep,
                              borderRadius: RADIUS.sm,
                              border: `1px solid ${COLORS.border}`,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm }}>
                              <span style={{
                                fontFamily: FONTS.sans,
                                fontSize: TYPE.bodySm.size,
                                fontWeight: 500,
                                color: COLORS.textPrimary,
                                flex: 1,
                              }}>
                                {p.display}
                              </span>
                              <SafetyPill
                                label={p.status.toUpperCase()}
                                bg={p.status === 'active' ? COLORS.infoDim : COLORS.warnDim}
                                color={p.status === 'active' ? COLORS.info : COLORS.warn}
                              />
                            </div>
                            {p.icd10Code && (
                              <Mono tone="muted" size="xs">{p.icd10Code}</Mono>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </TacticalCard>

          {/* ── Section F: Social Determinants ────────────────────── */}
          {hasSocialData && (
            <TacticalCard padding="sm">
              <AccordionHeader
                icon={<Shield size={19} />}
                title="Social Determinants"
                expanded={expanded.social}
                onToggle={() => toggle('social')}
              />
              <AnimatePresence initial={false}>
                {expanded.social && (
                  <motion.div
                    key="social-body"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                    style={{ overflow: 'hidden' }}
                  >
                    <Divider style={{ margin: `${SPACE.xs}px 0` }} />
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: SPACE.sm,
                        paddingTop: SPACE.md,
                      }}
                    >
                      {patient.socialDeterminants?.housing != null && (() => {
                        const c = sdColor(patient.socialDeterminants!.housing);
                        return (
                          <SafetyPill
                            label={`Housing: ${patient.socialDeterminants!.housing}`}
                            bg={c.bg}
                            color={c.color}
                          />
                        );
                      })()}
                      {patient.socialDeterminants?.foodSecurity != null && (() => {
                        const c = sdColor(patient.socialDeterminants!.foodSecurity);
                        return (
                          <SafetyPill
                            label={`Food: ${patient.socialDeterminants!.foodSecurity}`}
                            bg={c.bg}
                            color={c.color}
                          />
                        );
                      })()}
                      {patient.socialDeterminants?.transportation != null && (() => {
                        const c = sdColor(patient.socialDeterminants!.transportation);
                        return (
                          <SafetyPill
                            label={`Transport: ${patient.socialDeterminants!.transportation}`}
                            bg={c.bg}
                            color={c.color}
                          />
                        );
                      })()}
                      {patient.socialDeterminants?.caregiverSupport != null && (() => {
                        const c = boolSDColor(patient.socialDeterminants!.caregiverSupport);
                        return (
                          <SafetyPill
                            label={`Caregiver: ${patient.socialDeterminants!.caregiverSupport ? 'Yes' : 'No'}`}
                            bg={c.bg}
                            color={c.color}
                          />
                        );
                      })()}
                      {patient.socialDeterminants?.utilitiesSecure != null && (() => {
                        const c = boolSDColor(patient.socialDeterminants!.utilitiesSecure);
                        return (
                          <SafetyPill
                            label={`Utilities: ${patient.socialDeterminants!.utilitiesSecure ? 'Secure' : 'Insecure'}`}
                            bg={c.bg}
                            color={c.color}
                          />
                        );
                      })()}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </TacticalCard>
          )}
        </div>

        {/* ── 4. BOTTOM ACTION BAR ───────────────────────────────── */}
        <div
          style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: `calc(72px + env(safe-area-inset-bottom))`,
            paddingBottom: 'env(safe-area-inset-bottom)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            gap: SPACE.xs,
            paddingLeft: `max(${SPACE.sm}px, env(safe-area-inset-left))`,
            paddingRight: `max(${SPACE.sm}px, env(safe-area-inset-right))`,
            background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.bg} 100%)`,
            borderTop: `1px solid ${COLORS.border}`,
            zIndex: 3,
          }}
        >
          {/* Vitals */}
          <button
            type="button"
            onClick={() => {
              if (onOpenVitals) onOpenVitals();
              else showToast('Vitals workflow coming soon', 'info');
            }}
            style={{
              flex: 1,
              minWidth: 0,
              height: 56,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: RADIUS.sm,
              color: COLORS.textPrimary,
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
            }}
          >
            <HeartPulse size={23} color={COLORS.accent} strokeWidth={2} />
            <span>Vitals</span>
          </button>
          {/* Note */}
          <button
            type="button"
            onClick={() => {
              if (onOpenNote) onOpenNote();
              else showToast('Note workflow coming soon', 'info');
            }}
            style={{
              flex: 1,
              minWidth: 0,
              height: 56,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: RADIUS.sm,
              color: COLORS.textPrimary,
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
            }}
          >
            <FileText size={23} color={COLORS.info} strokeWidth={2} />
            <span>Note</span>
          </button>
          {/* Orders (CPOE) */}
          <button
            type="button"
            onClick={() => {
              if (onOpenOrders) onOpenOrders();
              else showToast('Orders workflow coming soon', 'info');
            }}
            style={{
              flex: 1,
              minWidth: 0,
              height: 56,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: RADIUS.sm,
              color: COLORS.textPrimary,
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
            }}
          >
            <Pill size={23} color={COLORS.ok} strokeWidth={2} />
            <span>Orders</span>
          </button>
          {/* Discharge */}
          <button
            type="button"
            onClick={() => {
              if (onOpenDischarge) onOpenDischarge();
              else showToast('Discharge workflow coming soon', 'info');
            }}
            style={{
              flex: 1,
              minWidth: 0,
              height: 56,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: RADIUS.sm,
              color: COLORS.textPrimary,
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
            }}
          >
            <DoorOpen size={23} color={COLORS.warn} strokeWidth={2} />
            <span>Discharge</span>
          </button>
          {/* Code Blue */}
          <button
            type="button"
            onClick={() => {
              if (onOpenCodeBlue) onOpenCodeBlue();
              else showToast('Code Blue workflow coming soon', 'error');
            }}
            style={{
              flex: 1,
              minWidth: 0,
              height: 56,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: 'transparent',
              border: 'none',
              borderRadius: RADIUS.sm,
              color: COLORS.textPrimary,
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase' as const,
              cursor: 'pointer',
            }}
          >
            <Siren size={23} color={COLORS.crit} strokeWidth={2} />
            <span>Code Blue</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
