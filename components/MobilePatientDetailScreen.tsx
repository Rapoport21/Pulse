/**
 * MobilePatientDetailScreen — phone-optimised patient detail view.
 *
 * Architecture (2026-04-18 redesign):
 * - Fixed top header: Back · Name + meta · small action icons (Send / QR
 *   / Code Blue) · ESI badge.
 * - Safety banner below header (code status, isolation, allergies).
 * - Sticky segmented top tabs: Overview · Vitals · Notes · Orders ·
 *   Discharge. ScanningLine + accent frame on the active tab.
 * - Scrollable content below, one tab at a time.
 *
 * No bottom action bar inside the overlay. The overlay itself stops ABOVE
 * MobileView's bottom HUD nav (via MOBILE_NAV_OVERLAY_INSET_BOTTOM) so the
 * main app tabs stay visible and tappable at all times — no more two-bar
 * overlap, no more extra step to get back.
 *
 * Renders as a fullscreen-minus-nav overlay (position: fixed, top/left/right: 0,
 * bottom: <nav height>, z-index 50) with slide-up entry animation.
 */

import React, { useMemo, useState } from 'react';
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
  Send,
  Plus,
  Check,
  Circle,
  Stethoscope,
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
  MOBILE_NAV_OVERLAY_INSET_BOTTOM,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
  TacticalButton,
  CornerBracket,
  ScanningLine,
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
  /** Open the "Send to..." device picker for this patient. */
  onSendTo?: () => void;
}

type TabId = 'overview' | 'vitals' | 'notes' | 'orders' | 'discharge';

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

const sexShort = (sex: Patient['sex']): string => {
  switch (sex) {
    case 'M': return 'M';
    case 'F': return 'F';
    case 'X': return 'NB';
    case 'U': return 'U';
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
// Mock notes / orders / discharge readiness — placeholders until we wire
// real charts. Keeps the non-Overview tabs from looking abandoned.
// ─────────────────────────────────────────────────────────────────────────

interface MockNote {
  id: string;
  kind: 'Triage' | 'Progress' | 'Nursing' | 'Consult';
  author: string;
  authorRole: string;
  at: string;
  preview: string;
}

interface MockOrder {
  id: string;
  kind: 'MED' | 'LAB' | 'IMG' | 'NURSE';
  display: string;
  detail: string;
  status: 'active' | 'pending' | 'given' | 'resulted';
  orderedAt: string;
}

interface DischargeItem {
  id: string;
  label: string;
  complete: boolean;
  detail?: string;
}

const mockNotes: MockNote[] = [
  {
    id: 'NOTE-1',
    kind: 'Progress',
    author: 'Dr. Emily Chen',
    authorRole: 'ED Attending',
    at: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
    preview:
      'Pt remains stable. Pain controlled on current regimen. Labs pending; reassess in 30 min. Bedside US: no free fluid.',
  },
  {
    id: 'NOTE-2',
    kind: 'Nursing',
    author: 'Sarah Jenkins, RN',
    authorRole: 'Charge Nurse',
    at: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
    preview:
      'IV placed R forearm 20g, running NS at KVO. Pt tolerating PO fluids. Ambulated to BR w/ stable gait.',
  },
  {
    id: 'NOTE-3',
    kind: 'Triage',
    author: 'Michael Chang, RN',
    authorRole: 'Triage RN',
    at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    preview:
      'CC: chest discomfort x2h. Onset sudden while at rest. No radiation, no SOB. Hx HTN. Triage vitals WNL except HR 102.',
  },
];

const mockOrders: MockOrder[] = [
  {
    id: 'ORD-1',
    kind: 'MED',
    display: 'Ondansetron 4 mg IV',
    detail: 'q6h PRN nausea · started 25m ago',
    status: 'active',
    orderedAt: new Date(Date.now() - 1000 * 60 * 25).toISOString(),
  },
  {
    id: 'ORD-2',
    kind: 'MED',
    display: '0.9% NaCl 1 L IV',
    detail: '125 mL/hr · continuous',
    status: 'active',
    orderedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'ORD-3',
    kind: 'LAB',
    display: 'Troponin I',
    detail: 'STAT · serial q3h',
    status: 'resulted',
    orderedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    id: 'ORD-4',
    kind: 'LAB',
    display: 'CBC, BMP',
    detail: 'STAT · sent to lab',
    status: 'pending',
    orderedAt: new Date(Date.now() - 1000 * 60 * 55).toISOString(),
  },
  {
    id: 'ORD-5',
    kind: 'IMG',
    display: '12-Lead EKG',
    detail: 'STAT · completed, no ischemic changes',
    status: 'resulted',
    orderedAt: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
  },
];

const mockDischargeItems: DischargeItem[] = [
  { id: 'DC-1', label: 'Vitals stable ≥ 1 hr', complete: true, detail: 'Last check 0:14 ago' },
  { id: 'DC-2', label: 'Pain controlled (goal < 4/10)', complete: true, detail: 'Current 2/10' },
  { id: 'DC-3', label: 'Tolerating PO', complete: true },
  { id: 'DC-4', label: 'Labs reviewed by attending', complete: false, detail: '2 of 4 resulted' },
  { id: 'DC-5', label: 'Follow-up scheduled', complete: false },
  { id: 'DC-6', label: 'Discharge teaching completed', complete: false },
  { id: 'DC-7', label: 'Transport arranged', complete: false },
];

const orderKindColor = (kind: MockOrder['kind']): string => {
  switch (kind) {
    case 'MED': return COLORS.ok;
    case 'LAB': return COLORS.info;
    case 'IMG': return COLORS.warn;
    case 'NURSE': return COLORS.accent;
  }
};

const orderStatusTone = (s: MockOrder['status']): 'ok' | 'warn' | 'info' | 'neutral' => {
  switch (s) {
    case 'active': return 'ok';
    case 'given': return 'ok';
    case 'pending': return 'warn';
    case 'resulted': return 'info';
  }
};

const formatRelative = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
};

// ─────────────────────────────────────────────────────────────────────────
// Header action button (Send / QR / Code Blue)
// ─────────────────────────────────────────────────────────────────────────

const HeaderActionButton: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: 'neutral' | 'crit';
}> = ({ icon, label, onClick, tone = 'neutral' }) => {
  const borderColor = tone === 'crit' ? `${COLORS.crit}60` : COLORS.borderStrong;
  const color = tone === 'crit' ? COLORS.crit : COLORS.textSecondary;
  const bg = tone === 'crit' ? `${COLORS.crit}10` : COLORS.surfaceElev;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 34,
        height: 30,
        padding: 0,
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
        color,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      {icon}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Accordion header — tap to expand / collapse
// ─────────────────────────────────────────────────────────────────────────

const AccordionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  sectionId?: string;
  expanded: boolean;
  onToggle: () => void;
  badge?: React.ReactNode;
}> = ({ icon, title, sectionId, expanded, onToggle, badge }) => (
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
      textAlign: 'left',
    }}
  >
    <span style={{ color: COLORS.accent, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {icon}
    </span>
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
      {sectionId && (
        <Mono tone="dim" size="xs">// {sectionId}</Mono>
      )}
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 15,
          fontWeight: 600,
          color: COLORS.textPrimary,
          letterSpacing: '-0.005em',
        }}
      >
        {title}
      </span>
    </div>
    {badge}
    <span style={{ color: COLORS.textMuted, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
    </span>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────
// Info row — label + value
// ─────────────────────────────────────────────────────────────────────────

const InfoRow: React.FC<{
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}> = ({ label, value, mono }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 30, gap: SPACE.sm }}>
    <Mono tone="muted" size="xs">{label}</Mono>
    {mono ? (
      <Mono tone="primary" size="sm" style={{ textAlign: 'right' }}>{value}</Mono>
    ) : (
      <span
        style={{
          fontFamily: FONTS.sans,
          fontSize: 14,
          color: COLORS.textPrimary,
          textAlign: 'right',
          fontWeight: 500,
          letterSpacing: '-0.005em',
        }}
      >
        {value}
      </span>
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Vital mini card
// ─────────────────────────────────────────────────────────────────────────

const VitalMiniCard: React.FC<{
  label: string;
  value: string;
  unit?: string;
  status: VitalStatus;
  icon: React.ReactNode;
}> = ({ label, value, unit, status, icon }) => {
  const c = vitalColor(status);
  return (
    <div
      style={{
        position: 'relative',
        background: COLORS.surface,
        border: `1px solid ${status === 'critical' ? `${COLORS.crit}55` : status === 'warning' ? `${COLORS.warn}55` : COLORS.border}`,
        borderRadius: RADIUS.sm,
        padding: SPACE.md,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        overflow: 'hidden',
      }}
    >
      {status !== 'normal' && (
        <>
          <CornerBracket position="tl" color={c} size={6} thickness={1} inset={-1} />
          <CornerBracket position="br" color={c} size={6} thickness={1} inset={-1} />
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ color: c, display: 'flex', alignItems: 'center' }}>{icon}</span>
        <Mono tone="muted" size="xs">{label}</Mono>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span
          style={{
            fontFamily: FONTS.mono,
            fontSize: 26,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: c,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
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
};

// ─────────────────────────────────────────────────────────────────────────
// Early-warning score chip + breakdown
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
      aria-label={`${score.name} score ${score.value}, ${score.risk} risk`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
        padding: SPACE.sm,
        background: active ? `${color}18` : `${color}0a`,
        border: `1px solid ${active ? color : `${color}30`}`,
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
            fontSize: 24,
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
            fontSize: 9,
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                background: contributes ? `${color}0d` : 'transparent',
                borderRadius: RADIUS.sm,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 13,
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
                  <Mono tone="muted" size="xs">{String(row.rawValue)}</Mono>
                )}
                <span
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: 13,
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
          background: `${color}14`,
          border: `1px solid ${color}35`,
          borderRadius: RADIUS.sm,
          fontFamily: FONTS.sans,
          fontSize: 13,
          lineHeight: 1.4,
          color: COLORS.textPrimary,
        }}
      >
        <Mono tone={tone} size="xs" style={{ marginRight: 6 }}>
          ACTION
        </Mono>
        {score.action}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Safety pill
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
      height: 26,
      padding: `0 ${SPACE.sm}px`,
      background: bg,
      border: `1px solid ${borderColor || bg}`,
      borderRadius: RADIUS.full,
      fontFamily: FONTS.mono,
      fontSize: 10,
      fontWeight: 600,
      letterSpacing: '0.12em',
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
// Segmented top tabs
// ─────────────────────────────────────────────────────────────────────────

const TopSegmentedTabs: React.FC<{
  active: TabId;
  onChange: (tab: TabId) => void;
}> = ({ active, onChange }) => {
  const tabs: Array<{ id: TabId; label: string; Icon: React.ComponentType<{ size?: number; strokeWidth?: number }> }> = [
    { id: 'overview', label: 'Overview', Icon: Users },
    { id: 'vitals', label: 'Vitals', Icon: HeartPulse },
    { id: 'notes', label: 'Notes', Icon: FileText },
    { id: 'orders', label: 'Orders', Icon: Pill },
    { id: 'discharge', label: 'Discharge', Icon: DoorOpen },
  ];

  return (
    <div
      style={{
        flexShrink: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(${tabs.length}, 1fr)`,
        background: COLORS.surface,
        borderBottom: `1px solid ${COLORS.border}`,
        zIndex: 2,
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            aria-pressed={isActive}
            style={{
              position: 'relative',
              minHeight: 50,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 3,
              padding: `${SPACE.sm}px 2px`,
              background: isActive ? COLORS.surfaceElev : 'transparent',
              border: 'none',
              borderRight: `1px solid ${COLORS.border}`,
              cursor: 'pointer',
              color: isActive ? COLORS.textPrimary : COLORS.textMuted,
              transition: `color ${MOTION.fast}s ease, background ${MOTION.fast}s ease`,
              overflow: 'hidden',
            }}
          >
            <t.Icon size={15} strokeWidth={2} />
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}
            >
              {t.label}
            </span>
            {/* Active indicator — top accent + scanning line */}
            {isActive && (
              <>
                <motion.span
                  layoutId="patient-tab-active"
                  aria-hidden
                  transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 2,
                    background: COLORS.accent,
                    boxShadow: `0 0 10px ${COLORS.accent}80`,
                  }}
                />
                <ScanningLine color={COLORS.accent} duration={5} />
              </>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// OverviewTab — the info accordion stack
// ─────────────────────────────────────────────────────────────────────────

const OverviewTab: React.FC<{
  patient: Patient;
}> = ({ patient }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    info: true,
    encounter: true,
    allergies: patient.allergies.length === 0,
    problems: false,
    social: false,
  });
  const toggle = (key: string) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

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

  const bedUnassigned =
    enc?.bedAssignmentStatus === 'admitted-unassigned' || (enc != null && !enc.location?.bed);

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

  const sdColor = (val?: string): { bg: string; color: string } => {
    if (!val) return { bg: COLORS.surface, color: COLORS.textMuted };
    const risk = ['unstable', 'unhoused', 'risk', 'insecure', 'inconsistent', 'none'];
    const stable = ['stable', 'secure', 'has-reliable'];
    if (risk.includes(val)) return { bg: COLORS.warnDim, color: COLORS.warn };
    if (stable.includes(val)) return { bg: COLORS.okDim, color: COLORS.ok };
    return { bg: COLORS.surface, color: COLORS.textSecondary };
  };

  const boolSDColor = (val?: boolean): { bg: string; color: string } => {
    if (val === true) return { bg: COLORS.okDim, color: COLORS.ok };
    if (val === false) return { bg: COLORS.critDim, color: COLORS.crit };
    return { bg: COLORS.surface, color: COLORS.textMuted };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      {/* ── Patient Info ───────────────────────────────────────────── */}
      <TacticalCard padding="sm">
        <AccordionHeader
          icon={<Users size={16} />}
          title="Patient Info"
          sectionId="INFO"
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: SPACE.sm }}>
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
                      padding: `5px ${SPACE.sm}px`,
                      background: COLORS.warnDim,
                      border: `1px solid ${COLORS.warn}40`,
                      borderRadius: RADIUS.sm,
                      marginTop: 6,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <AlertTriangle size={12} color={COLORS.warn} />
                    <Mono tone="warn" size="xs">INTERPRETER NEEDED</Mono>
                  </div>
                )}
                {patient.weightKg != null && (
                  <InfoRow label="WEIGHT" value={`${patient.weightKg} kg`} mono />
                )}
                {patient.heightCm != null && (
                  <InfoRow label="HEIGHT" value={`${patient.heightCm} cm`} mono />
                )}
                {bmi && <InfoRow label="BMI" value={bmi} mono />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </TacticalCard>

      {/* ── Encounter ─────────────────────────────────────────────── */}
      <TacticalCard padding="sm">
        <AccordionHeader
          icon={<Eye size={16} />}
          title="Bed & Encounter"
          sectionId="ENC"
          expanded={expanded.encounter}
          onToggle={() => toggle('encounter')}
          badge={bedUnassigned ? (
            <span
              style={{
                width: 8, height: 8, borderRadius: RADIUS.full,
                background: COLORS.warn, boxShadow: `0 0 6px ${COLORS.warn}`,
                flexShrink: 0,
              }}
            />
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: SPACE.sm }}>
                {bedUnassigned && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.sm,
                      padding: SPACE.md,
                      background: COLORS.warnDim,
                      border: `1px solid ${COLORS.warn}40`,
                      borderRadius: RADIUS.sm,
                      marginBottom: SPACE.sm,
                    }}
                  >
                    <AlertTriangle size={16} color={COLORS.warn} style={{ flexShrink: 0 }} />
                    <span style={{
                      fontFamily: FONTS.sans,
                      fontSize: 13,
                      fontWeight: 600,
                      color: COLORS.warn,
                      lineHeight: 1.3,
                    }}>
                      UNASSIGNED — Patient admitted without bed assignment
                    </span>
                  </div>
                )}
                {enc?.location?.bed && <InfoRow label="BED" value={enc.location.bed} mono />}
                {enc?.location?.zone && <InfoRow label="ZONE" value={enc.location.zone} mono />}
                {enc && (
                  <>
                    <InfoRow label="CLASS" value={enc.class} mono />
                    <InfoRow label="STATUS" value={enc.status.toUpperCase()} mono />
                    <InfoRow label="ADMITTED" value={formatDateTime(enc.admittedAt)} />
                    {enc.chiefComplaint && (
                      <InfoRow label="CHIEF COMPLAINT" value={enc.chiefComplaint} />
                    )}
                    {enc.esi && <InfoRow label="ESI" value={`Level ${enc.esi}`} mono />}
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

      {/* ── Allergies ──────────────────────────────────────────────── */}
      <TacticalCard padding="sm">
        <AccordionHeader
          icon={<AlertTriangle size={16} />}
          title="Allergies"
          sectionId="ALG"
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
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          background: COLORS.bgDeep,
                          borderRadius: RADIUS.sm,
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm }}>
                          <span style={{
                            fontFamily: FONTS.sans,
                            fontSize: 14,
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

      {/* ── Active Problems ───────────────────────────────────────── */}
      <TacticalCard padding="sm">
        <AccordionHeader
          icon={<FileText size={16} />}
          title="Active Problems"
          sectionId="PROB"
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
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          background: COLORS.bgDeep,
                          borderRadius: RADIUS.sm,
                          border: `1px solid ${COLORS.border}`,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm }}>
                          <span style={{
                            fontFamily: FONTS.sans,
                            fontSize: 14,
                            fontWeight: 500,
                            color: COLORS.textPrimary,
                            flex: 1,
                            letterSpacing: '-0.005em',
                          }}>
                            {p.display}
                          </span>
                          <SafetyPill
                            label={p.status.toUpperCase()}
                            bg={p.status === 'active' ? COLORS.infoDim : COLORS.warnDim}
                            color={p.status === 'active' ? COLORS.info : COLORS.warn}
                          />
                        </div>
                        {p.icd10Code && <Mono tone="muted" size="xs">{p.icd10Code}</Mono>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </TacticalCard>

      {/* ── Social Determinants ───────────────────────────────────── */}
      {hasSocialData && (
        <TacticalCard padding="sm">
          <AccordionHeader
            icon={<Shield size={16} />}
            title="Social Determinants"
            sectionId="SOC"
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
  );
};

// ─────────────────────────────────────────────────────────────────────────
// VitalsTab — vitals grid + early warning scores + record button
// ─────────────────────────────────────────────────────────────────────────

const VitalsTab: React.FC<{
  patient: Patient;
  onOpenVitals?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}> = ({ patient, onOpenVitals, showToast }) => {
  const latestVitals = useMemo(
    () => (patient.vitalsHistory.length > 0 ? patient.vitalsHistory[patient.vitalsHistory.length - 1] : null),
    [patient.vitalsHistory],
  );
  const scores = useMemo(
    () => (latestVitals ? computeAllScores(latestVitals) : null),
    [latestVitals],
  );
  const [openScore, setOpenScore] = useState<'mews' | 'news2' | 'qsofa' | null>(null);

  if (!latestVitals) {
    return (
      <TacticalCard padding="lg">
        <div style={{ textAlign: 'center', padding: SPACE.xl, display: 'flex', flexDirection: 'column', gap: SPACE.base, alignItems: 'center' }}>
          <Activity size={40} color={COLORS.textMuted} strokeWidth={1.5} />
          <Mono tone="muted" size="sm">// NO VITALS RECORDED</Mono>
          <TacticalButton
            variant="primary"
            size="md"
            icon={<Plus size={14} />}
            onClick={() => {
              if (onOpenVitals) onOpenVitals();
              else showToast('Vitals workflow coming soon', 'info');
            }}
          >
            Record Vitals
          </TacticalButton>
        </div>
      </TacticalCard>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      {/* Record vitals CTA */}
      <TacticalButton
        variant="primary"
        size="md"
        fullWidth
        icon={<Plus size={14} />}
        onClick={() => {
          if (onOpenVitals) onOpenVitals();
          else showToast('Vitals workflow coming soon', 'info');
        }}
      >
        Record New Vitals
      </TacticalButton>

      {/* Vitals mini-grid */}
      <TacticalCard padding="sm">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${SPACE.sm}px 0 ${SPACE.sm}px ${SPACE.xs}px` }}>
          <BracketLabel tone="accent" size="xs">CURRENT VITALS</BracketLabel>
          <Mono tone="muted" size="xs">
            {formatRelative(latestVitals.timestamp).toUpperCase()}
          </Mono>
        </div>
        <Divider style={{ margin: `0 0 ${SPACE.sm}px 0` }} />
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
            icon={<HeartPulse size={14} />}
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
            icon={<Activity size={14} />}
          />
          <VitalMiniCard
            label="SpO2"
            value={latestVitals.spO2 != null ? String(latestVitals.spO2) : '--'}
            unit="%"
            status={spo2Status(latestVitals.spO2)}
            icon={<Shield size={14} />}
          />
          <VitalMiniCard
            label="RR"
            value={latestVitals.respRate != null ? String(latestVitals.respRate) : '--'}
            unit="/min"
            status={rrStatus(latestVitals.respRate)}
            icon={<Brain size={14} />}
          />
          <VitalMiniCard
            label="TEMP"
            value={latestVitals.temperature != null ? latestVitals.temperature.toFixed(1) : '--'}
            unit="C"
            status={tempStatus(latestVitals.temperature)}
            icon={<Thermometer size={14} />}
          />
          <VitalMiniCard
            label="PAIN"
            value={latestVitals.painScore != null ? String(latestVitals.painScore) : '--'}
            unit="/10"
            status={painStatus(latestVitals.painScore)}
            icon={<AlertTriangle size={14} />}
          />
        </div>
        <Mono tone="dim" size="xs" style={{ marginTop: SPACE.sm, display: 'block', textAlign: 'right' }}>
          Recorded {formatDateTime(latestVitals.timestamp)}
        </Mono>
      </TacticalCard>

      {/* Early warning scores */}
      {scores && (
        <TacticalCard padding="sm">
          <div style={{ padding: `${SPACE.sm}px 0 ${SPACE.sm}px ${SPACE.xs}px` }}>
            <BracketLabel tone="accent" size="xs">EARLY WARNING</BracketLabel>
          </div>
          <Divider style={{ margin: `0 0 ${SPACE.sm}px 0` }} />
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
              onClick={() => setOpenScore(openScore === 'mews' ? null : 'mews')}
            />
            <ScoreChip
              score={scores.news2}
              active={openScore === 'news2'}
              onClick={() => setOpenScore(openScore === 'news2' ? null : 'news2')}
            />
            <ScoreChip
              score={scores.qsofa}
              active={openScore === 'qsofa'}
              onClick={() => setOpenScore(openScore === 'qsofa' ? null : 'qsofa')}
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
        </TacticalCard>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// NotesTab
// ─────────────────────────────────────────────────────────────────────────

const NotesTab: React.FC<{
  onOpenNote?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}> = ({ onOpenNote, showToast }) => {
  const handleNew = () => {
    if (onOpenNote) onOpenNote();
    else showToast('Note workflow coming soon', 'info');
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <TacticalButton
        variant="primary"
        size="md"
        fullWidth
        icon={<Plus size={14} />}
        onClick={handleNew}
      >
        New Note
      </TacticalButton>
      <TacticalCard padding="sm">
        <div style={{ padding: `${SPACE.sm}px 0 ${SPACE.sm}px ${SPACE.xs}px` }}>
          <BracketLabel tone="accent" size="xs">DOCUMENTATION</BracketLabel>
        </div>
        <Divider style={{ margin: `0 0 ${SPACE.sm}px 0` }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          {mockNotes.map((note) => (
            <div
              key={note.id}
              role="button"
              onClick={() => showToast(`Opening ${note.kind.toLowerCase()} note…`, 'info')}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: `${SPACE.md}px`,
                background: COLORS.bgDeep,
                border: `1px solid ${COLORS.border}`,
                borderLeft: `2px solid ${COLORS.accent}`,
                borderRadius: RADIUS.sm,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm }}>
                <BracketLabel tone="accent" size="xs">{note.kind.toUpperCase()}</BracketLabel>
                <Mono tone="muted" size="xs">{formatRelative(note.at).toUpperCase()}</Mono>
              </div>
              <div
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  color: COLORS.textPrimary,
                  lineHeight: 1.45,
                  letterSpacing: '-0.005em',
                }}
              >
                {note.preview}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <Stethoscope size={11} strokeWidth={2} color={COLORS.textMuted} />
                <Mono tone="secondary" size="xs">{note.author}</Mono>
                <Mono tone="dim" size="xs">· {note.authorRole}</Mono>
              </div>
            </div>
          ))}
        </div>
      </TacticalCard>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// OrdersTab
// ─────────────────────────────────────────────────────────────────────────

const OrdersTab: React.FC<{
  onOpenOrders?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}> = ({ onOpenOrders, showToast }) => {
  const activeCount = mockOrders.filter((o) => o.status === 'active' || o.status === 'pending').length;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <TacticalButton
        variant="primary"
        size="md"
        fullWidth
        icon={<Plus size={14} />}
        onClick={() => {
          if (onOpenOrders) onOpenOrders();
          else showToast('Orders workflow coming soon', 'info');
        }}
      >
        New Order
      </TacticalButton>

      <TacticalCard padding="sm">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: `${SPACE.sm}px 0 ${SPACE.sm}px ${SPACE.xs}px` }}>
          <BracketLabel tone="accent" size="xs">ACTIVE ORDERS</BracketLabel>
          <StatusPill label={`${activeCount} LIVE`} tone="info" size="xs" />
        </div>
        <Divider style={{ margin: `0 0 ${SPACE.sm}px 0` }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          {mockOrders.map((o) => {
            const kindColor = orderKindColor(o.kind);
            const tone = orderStatusTone(o.status);
            return (
              <div
                key={o.id}
                role="button"
                onClick={() => showToast(`Opening order ${o.id}…`, 'info')}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  padding: `${SPACE.md}px`,
                  background: COLORS.bgDeep,
                  border: `1px solid ${COLORS.border}`,
                  borderLeft: `2px solid ${kindColor}`,
                  borderRadius: RADIUS.sm,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACE.sm }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <Mono
                      tone="muted"
                      size="xs"
                      style={{
                        color: kindColor,
                        padding: '2px 6px',
                        background: `${kindColor}14`,
                        borderRadius: RADIUS.sm,
                        border: `1px solid ${kindColor}35`,
                      }}
                    >
                      {o.kind}
                    </Mono>
                    <span
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 14,
                        fontWeight: 600,
                        color: COLORS.textPrimary,
                        letterSpacing: '-0.005em',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {o.display}
                    </span>
                  </div>
                  <StatusPill label={o.status.toUpperCase()} tone={tone} size="xs" />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Mono tone="secondary" size="xs">{o.detail}</Mono>
                  <Mono tone="dim" size="xs">{formatRelative(o.orderedAt)}</Mono>
                </div>
              </div>
            );
          })}
        </div>
      </TacticalCard>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// DischargeTab
// ─────────────────────────────────────────────────────────────────────────

const DischargeTab: React.FC<{
  onOpenDischarge?: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
}> = ({ onOpenDischarge, showToast }) => {
  const total = mockDischargeItems.length;
  const completed = mockDischargeItems.filter((i) => i.complete).length;
  const pct = Math.round((completed / total) * 100);
  const readyToDischarge = completed === total;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      {/* Readiness gauge */}
      <TacticalCard padding="md" accentBar={readyToDischarge} highlight={readyToDischarge}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.sm }}>
          <div>
            <Mono tone="muted" size="xs">READINESS</Mono>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 24,
                fontWeight: 700,
                color: readyToDischarge ? COLORS.ok : COLORS.textPrimary,
                letterSpacing: '-0.02em',
                marginTop: 4,
              }}
            >
              {completed} / {total}
              <span style={{ fontSize: 14, color: COLORS.textMuted, marginLeft: 8 }}>
                ({pct}%)
              </span>
            </div>
          </div>
          <StatusPill
            label={readyToDischarge ? 'READY' : 'NOT READY'}
            tone={readyToDischarge ? 'ok' : 'warn'}
            pulse={readyToDischarge}
            size="sm"
          />
        </div>
        <div
          style={{
            height: 6,
            background: COLORS.surfaceElev,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.full,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: '100%',
              background: readyToDischarge ? COLORS.ok : COLORS.warn,
              transition: `width ${MOTION.base}s ease`,
            }}
          />
        </div>
      </TacticalCard>

      {/* Start discharge CTA */}
      <TacticalButton
        variant="primary"
        size="md"
        fullWidth
        icon={<DoorOpen size={14} />}
        onClick={() => {
          if (onOpenDischarge) onOpenDischarge();
          else showToast('Discharge workflow coming soon', 'info');
        }}
      >
        {readyToDischarge ? 'Start Discharge' : 'Continue Discharge'}
      </TacticalButton>

      {/* Checklist */}
      <TacticalCard padding="sm">
        <div style={{ padding: `${SPACE.sm}px 0 ${SPACE.sm}px ${SPACE.xs}px` }}>
          <BracketLabel tone="accent" size="xs">CHECKLIST</BracketLabel>
        </div>
        <Divider style={{ margin: `0 0 ${SPACE.sm}px 0` }} />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {mockDischargeItems.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: SPACE.sm,
                padding: `${SPACE.md}px 2px`,
                borderBottom: i === mockDischargeItems.length - 1 ? 'none' : `1px solid ${COLORS.border}`,
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 22,
                  height: 22,
                  flexShrink: 0,
                  background: item.complete ? `${COLORS.ok}1a` : 'transparent',
                  border: `1px solid ${item.complete ? COLORS.ok : COLORS.borderStrong}`,
                  borderRadius: RADIUS.sm,
                  color: item.complete ? COLORS.ok : COLORS.textMuted,
                }}
              >
                {item.complete ? <Check size={13} strokeWidth={2.5} /> : <Circle size={8} strokeWidth={0} fill="transparent" />}
              </span>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 14,
                    fontWeight: 500,
                    color: item.complete ? COLORS.textSecondary : COLORS.textPrimary,
                    textDecoration: item.complete ? 'line-through' : undefined,
                    letterSpacing: '-0.005em',
                    lineHeight: 1.3,
                  }}
                >
                  {item.label}
                </span>
                {item.detail && (
                  <Mono tone="dim" size="xs">
                    {item.detail}
                  </Mono>
                )}
              </div>
            </div>
          ))}
        </div>
      </TacticalCard>
    </div>
  );
};

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
  onSendTo,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('overview');

  // Early-warning score for the header badge (MEWS is the fastest read).
  const latestVitals = useMemo(
    () => (patient.vitalsHistory.length > 0 ? patient.vitalsHistory[patient.vitalsHistory.length - 1] : null),
    [patient.vitalsHistory],
  );
  const scores = useMemo(
    () => (latestVitals ? computeAllScores(latestVitals) : null),
    [latestVitals],
  );
  const mews = scores?.mews ?? null;

  const enc = patient.currentEncounter;
  const age = ageInYears(patient.birthDate);
  const fullName = `${patient.name.given} ${patient.name.family}`;

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
          top: 0,
          left: 0,
          right: 0,
          // Stop above the bottom HUD nav so the app tabs stay visible.
          bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM,
          zIndex: 50,
          background: COLORS.bg,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONTS.sans,
          color: COLORS.textPrimary,
          overflow: 'hidden',
          borderTop: `1px solid ${COLORS.border}`,
        }}
      >
        {/* ── 1. FIXED HEADER ───────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            paddingTop: 'env(safe-area-inset-top)',
            display: 'flex',
            alignItems: 'center',
            gap: SPACE.xs,
            minHeight: `calc(58px + env(safe-area-inset-top))`,
            paddingLeft: `max(${SPACE.sm}px, env(safe-area-inset-left))`,
            paddingRight: `max(${SPACE.sm}px, env(safe-area-inset-right))`,
            background: COLORS.surface,
            borderBottom: `1px solid ${COLORS.border}`,
            zIndex: 3,
            position: 'relative',
          }}
        >
          {/* Back */}
          <button
            onClick={onClose}
            aria-label="Close patient detail"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              minWidth: 58,
              minHeight: 44,
              padding: `0 ${SPACE.xs}px`,
              background: 'none',
              border: 'none',
              color: COLORS.accent,
              fontFamily: FONTS.sans,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <ChevronLeft size={20} />
            Back
          </button>

          {/* Patient name + meta — center */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              minWidth: 0,
              padding: `0 ${SPACE.xs}px`,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 16,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                color: COLORS.textPrimary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
                lineHeight: 1.15,
              }}
            >
              {fullName}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: FONTS.mono,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.08em',
                color: COLORS.textMuted,
                textTransform: 'uppercase',
                lineHeight: 1,
              }}
            >
              <span>{patient.mrn}</span>
              <span style={{ color: COLORS.textDim }}>·</span>
              <span>{age}Y</span>
              <span style={{ color: COLORS.textDim }}>·</span>
              <span>{sexShort(patient.sex)}</span>
              {enc?.location?.bed && (
                <>
                  <span style={{ color: COLORS.textDim }}>·</span>
                  <span style={{ color: COLORS.textSecondary }}>{enc.location.bed}</span>
                </>
              )}
            </div>
          </div>

          {/* Right action icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, flexShrink: 0 }}>
            {onSendTo && (
              <HeaderActionButton
                icon={<Send size={13} strokeWidth={1.75} />}
                label="Send chart to another device"
                onClick={onSendTo}
              />
            )}
            {onPrintQR && (
              <HeaderActionButton
                icon={<QrCode size={13} strokeWidth={1.75} />}
                label="Print patient QR ID band"
                onClick={onPrintQR}
              />
            )}
            {/* Code Blue — demoted from bottom-tab to a small header icon.
                Rare but legitimate at-bedside action, keeps CodeBlueScreen
                accessible without letting it squat a whole top-level tab. */}
            {onOpenCodeBlue && (
              <HeaderActionButton
                icon={<Siren size={13} strokeWidth={1.75} />}
                label="Initiate Code Blue"
                onClick={onOpenCodeBlue}
                tone="crit"
              />
            )}
            {/* ESI */}
            {enc?.esi && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 30,
                  minWidth: 52,
                  padding: `0 ${SPACE.sm}px`,
                  background: enc.esi <= 2 ? COLORS.critDim : enc.esi === 3 ? COLORS.warnDim : COLORS.okDim,
                  border: `1px solid ${enc.esi <= 2 ? COLORS.crit + '50' : enc.esi === 3 ? COLORS.warn + '50' : COLORS.ok + '50'}`,
                  borderRadius: RADIUS.full,
                  fontFamily: FONTS.mono,
                  fontSize: 11,
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
        </div>

        {/* ── 2. SAFETY BANNER ──────────────────────────────────── */}
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
            zIndex: 3,
            position: 'relative',
          }}
        >
          {/* MEWS badge */}
          {mews && (
            <StatusPill
              label={`MEWS ${mews.value}`}
              tone={riskTone(mews.risk)}
              size="sm"
            />
          )}
          {/* Code Status */}
          <SafetyPill
            label={patient.codeStatus}
            bg={codeStatusBg}
            color={codeStatusColor}
            borderColor={codeStatusColor + '40'}
          />
          {/* Isolation */}
          {patient.isolation !== 'NONE' && (
            <SafetyPill
              label={patient.isolation}
              bg={isolationColors[patient.isolation]?.bg || COLORS.warnDim}
              color={isolationColors[patient.isolation]?.color || COLORS.warn}
              borderColor={(isolationColors[patient.isolation]?.color || COLORS.warn) + '40'}
            />
          )}
          {/* Allergies count */}
          <SafetyPill
            label={
              patient.allergies.length > 0
                ? `${patient.allergies.length} ALLERG${patient.allergies.length === 1 ? 'Y' : 'IES'}`
                : 'NKA'
            }
            bg={patient.allergies.length > 0 ? COLORS.critDim : COLORS.okDim}
            color={patient.allergies.length > 0 ? COLORS.crit : COLORS.ok}
            borderColor={(patient.allergies.length > 0 ? COLORS.crit : COLORS.ok) + '40'}
          />
          {patient.advanceDirective && (
            <SafetyPill
              label="AD ON FILE"
              bg={COLORS.infoDim}
              color={COLORS.info}
              borderColor={`${COLORS.info}40`}
            />
          )}
        </div>

        {/* ── 3. SEGMENTED TOP TABS ─────────────────────────────── */}
        <TopSegmentedTabs active={activeTab} onChange={setActiveTab} />

        {/* ── 4. SCROLLABLE CONTENT ─────────────────────────────── */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          <div
            style={{
              padding: `${SPACE.base}px`,
              // Leave room for the main app nav that sits below this
              // overlay — even though the overlay covers it, iOS momentum
              // scroll ends here and the last card shouldn't hide behind
              // the system home-indicator safe area.
              paddingBottom: `calc(${SPACE.base}px + env(safe-area-inset-bottom))`,
            }}
          >
            {activeTab === 'overview' && <OverviewTab patient={patient} />}
            {activeTab === 'vitals' && (
              <VitalsTab
                patient={patient}
                onOpenVitals={onOpenVitals}
                showToast={showToast}
              />
            )}
            {activeTab === 'notes' && (
              <NotesTab onOpenNote={onOpenNote} showToast={showToast} />
            )}
            {activeTab === 'orders' && (
              <OrdersTab onOpenOrders={onOpenOrders} showToast={showToast} />
            )}
            {activeTab === 'discharge' && (
              <DischargeTab onOpenDischarge={onOpenDischarge} showToast={showToast} />
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
