/**
 * ESITriageScreen — a wizard that walks a triage nurse through the
 * Gilboy / ENA Emergency Severity Index algorithm (v4) and produces an
 * ESI acuity level 1–5, a suggested disposition bay, and a one-line
 * handoff string ready to paste into a hand-off note.
 *
 * The algorithm is the published ESI v4 decision tree:
 *
 *   1. Is the patient dying? (needs immediate life-saving intervention:
 *      airway, breathing, circulation, or imminent arrest)
 *        → YES → ESI 1, route to Resus/Trauma 1
 *
 *   2. Is the patient high-risk / time-sensitive / severely distressed?
 *      (stroke symptoms <4.5h, STEMI equivalent, new AMS, severe pain
 *      or respiratory distress, etc.)
 *        → YES → ESI 2, route to Acute
 *
 *   3. How many resources will this patient need? (counted per ESI
 *      guidelines — labs, ECG, imaging, IV meds, consults, procedures)
 *      AND vital signs danger zone check (HR, RR, SpO2 thresholds
 *      per age group)
 *        → 0 resources → ESI 5, Fast Track
 *        → 1 resource  → ESI 4, Fast Track
 *        → ≥2 resources OR vitals in danger zone → ESI 3, Acute
 *
 * The screen is modal — parent renders `<ESITriageScreen open onClose/>`
 * and receives the triage result via `onComplete`. Parent persists
 * the result (typically to a new Encounter) and writes an AuditEntry.
 *
 * This implementation is deliberately form-heavy rather than
 * free-text — ESI is a structured algorithm and typing "chest pain"
 * into a box defeats the reproducibility the scale is designed for.
 */

import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BriefcaseMedical,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  FlaskConical,
  HeartPulse,
  Plus,
  Minus,
  Syringe,
  User,
  X,
  Zap,
} from 'lucide-react';
import type { EsiLevel, Vital } from '../../types';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION, cssTransition,
  TYPE,
  Mono,
  BracketLabel,
  CornerBracket,
  TacticalCard,
  TacticalButton,
  HudStrip,
  StatusPill,
  DotGridBg,
  Divider,
} from '../design';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface TriageResult {
  esi: EsiLevel;
  chiefComplaint: string;
  patientName: string;
  age: number;
  sex: 'M' | 'F' | 'X' | 'U';
  lifeThreat: boolean;
  highRisk: boolean;
  resourceCount: number;
  vitalsAbnormal: boolean;
  vitals: Partial<Vital>;
  suggestedBay: string;
  handoffLine: string;
  createdAt: string;
}

export interface ESITriageScreenProps {
  open: boolean;
  onClose: () => void;
  onComplete: (result: TriageResult) => void;
}

type Step =
  | 'identity'
  | 'lifeThreat'
  | 'highRisk'
  | 'vitals'
  | 'resources'
  | 'result';

const STEP_ORDER: Step[] = ['identity', 'lifeThreat', 'highRisk', 'vitals', 'resources', 'result'];

// ─────────────────────────────────────────────────────────────────────────
// ESI disposition table — published bay/zone suggestions by level
// ─────────────────────────────────────────────────────────────────────────

const dispositionByEsi: Record<EsiLevel, { bay: string; staffing: string; tone: 'crit' | 'warn' | 'info' | 'ok' }> = {
  1: { bay: 'Resus / Trauma 1', staffing: '1:1 RN + attending at bedside', tone: 'crit' },
  2: { bay: 'Acute · high-acuity bed', staffing: '1:2 RN', tone: 'crit' },
  3: { bay: 'Acute · standard bed', staffing: '1:4 RN', tone: 'warn' },
  4: { bay: 'Fast Track', staffing: '1:5 RN', tone: 'info' },
  5: { bay: 'Fast Track · quick-look', staffing: '1:5 RN', tone: 'ok' },
};

// ─────────────────────────────────────────────────────────────────────────
// ESI vital sign danger zones — ESI v4 table per age group
// Returns true if ANY vital is in the danger zone.
// ─────────────────────────────────────────────────────────────────────────

const vitalsDangerZone = (v: Partial<Vital>, ageYears: number): boolean => {
  // Infant / toddler thresholds intentionally left at adult defaults for
  // this demo — production would carry the full pediatric table.
  const isAdult = ageYears >= 8;

  if (!isAdult) {
    if (v.heartRate != null && (v.heartRate < 60 || v.heartRate > 180)) return true;
    if (v.respRate != null && (v.respRate < 18 || v.respRate > 40)) return true;
    if (v.spO2 != null && v.spO2 < 92) return true;
    return false;
  }

  // Adult danger zone — ESI v4
  if (v.heartRate != null && v.heartRate > 100) return true;
  if (v.respRate != null && v.respRate > 20) return true;
  if (v.spO2 != null && v.spO2 < 92) return true;
  // Temperature and SBP fall under "consider up-triage" but aren't
  // hard danger-zone triggers in the ESI table — we still surface them
  // in the step UI as a signal.
  return false;
};

// ─────────────────────────────────────────────────────────────────────────
// Resource list — canonical ESI v4 "counts as a resource"
// ─────────────────────────────────────────────────────────────────────────

interface Resource {
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

const RESOURCES: Resource[] = [
  { id: 'labs', label: 'Labs (blood / urine)', icon: FlaskConical },
  { id: 'ecg', label: 'ECG', icon: HeartPulse },
  { id: 'xray', label: 'X-Ray', icon: Activity },
  { id: 'ct-mri-us', label: 'CT / MRI / Ultrasound', icon: Activity },
  { id: 'iv-meds', label: 'IV fluids / IV meds', icon: Syringe },
  { id: 'specialty', label: 'Specialty consult', icon: BriefcaseMedical },
  { id: 'procedure', label: 'Simple procedure (suture, splint, LP)', icon: Zap },
  { id: 'complex-proc', label: 'Complex procedure (sedation, moderate)', icon: Zap },
];

/**
 * Things that look like a resource but officially do NOT count per ESI v4.
 * Rendered as greyed-out chips so the nurse can visually confirm they
 * weren't missed.
 */
const NON_RESOURCES: { id: string; label: string }[] = [
  { id: 'history', label: 'History & physical' },
  { id: 'po-meds', label: 'PO meds' },
  { id: 'tetanus', label: 'Tetanus booster' },
  { id: 'prescription', label: 'Rx refill' },
  { id: 'saline-lock', label: 'Saline lock (no meds)' },
  { id: 'point-of-care', label: 'POC glucose / urine dip' },
];

// ─────────────────────────────────────────────────────────────────────────
// Step header — bracket label + title + progress bar
// ─────────────────────────────────────────────────────────────────────────

const StepHeader: React.FC<{ index: number; total: number; label: string; title: string }> = ({
  index,
  total,
  label,
  title,
}) => (
  <div style={{ marginBottom: SPACE.lg }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: 6 }}>
      <Mono tone="dim" size="xs">
        // STEP {index + 1} / {total}
      </Mono>
      <BracketLabel tone="accent" size="xs">
        {label}
      </BracketLabel>
    </div>
    <h2
      style={{
        margin: 0,
        fontFamily: FONTS.sans,
        fontSize: TYPE.h2.size,
        fontWeight: TYPE.h2.weight,
        color: COLORS.textPrimary,
        letterSpacing: TYPE.h2.tracking,
        lineHeight: TYPE.h2.lineHeight,
      }}
    >
      {title}
    </h2>
    {/* Progress ticks */}
    <div style={{ display: 'flex', gap: 3, marginTop: SPACE.sm }}>
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            height: 2,
            background: i <= index ? COLORS.accent : COLORS.border,
            boxShadow: i <= index ? `0 0 6px ${COLORS.accent}80` : 'none',
            borderRadius: 1,
            transition: 'background 200ms ease',
          }}
        />
      ))}
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// YesNoButtons — big tappable Yes / No for binary decisions
// ─────────────────────────────────────────────────────────────────────────

const YesNoButtons: React.FC<{
  onYes: () => void;
  onNo: () => void;
  yesTone?: 'crit' | 'warn';
}> = ({ onYes, onNo, yesTone = 'crit' }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.md, marginTop: SPACE.lg }}>
    <BigChoiceButton
      label="NO"
      sublabel="Continue"
      onClick={onNo}
      tone="ok"
      icon={<ArrowRight size={14} strokeWidth={2} />}
    />
    <BigChoiceButton
      label="YES"
      sublabel="Escalate"
      onClick={onYes}
      tone={yesTone}
      icon={<AlertTriangle size={14} strokeWidth={2} />}
    />
  </div>
);

const BigChoiceButton: React.FC<{
  label: string;
  sublabel: string;
  onClick: () => void;
  tone: 'ok' | 'warn' | 'crit';
  icon?: React.ReactNode;
}> = ({ label, sublabel, onClick, tone, icon }) => {
  const color = tone === 'crit' ? COLORS.crit : tone === 'warn' ? COLORS.warn : COLORS.ok;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
      style={{
        position: 'relative',
        padding: `${SPACE.lg}px ${SPACE.base}px`,
        background: 'rgba(255,255,255,0.015)',
        border: `1px solid ${color}`,
        borderLeft: `3px solid ${color}`,
        borderRadius: RADIUS.sm,
        color: COLORS.textPrimary,
        fontFamily: FONTS.sans,
        textAlign: 'left',
        cursor: 'pointer',
        overflow: 'hidden',
      }}
    >
      <CornerBracket position="tl" color={color} size={6} thickness={1} inset={-1} />
      <CornerBracket position="br" color={color} size={6} thickness={1} inset={-1} />
      <div
        style={{
          fontFamily: FONTS.mono,
          fontSize: 24,
          fontWeight: 700,
          color,
          letterSpacing: '0.06em',
          lineHeight: 1,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginTop: 6,
        }}
      >
        {icon}
        <Mono tone="muted" size="xs">
          {sublabel}
        </Mono>
      </div>
    </motion.button>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// IdentityStep — chief complaint + name/age/sex
// ─────────────────────────────────────────────────────────────────────────

const IdentityStep: React.FC<{
  value: { name: string; age: string; sex: 'M' | 'F' | 'X' | 'U'; chiefComplaint: string };
  onChange: (next: { name: string; age: string; sex: 'M' | 'F' | 'X' | 'U'; chiefComplaint: string }) => void;
}> = ({ value, onChange }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <LabeledInput
        label="PATIENT NAME"
        value={value.name}
        onChange={(name) => onChange({ ...value, name })}
        placeholder="Last, First"
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm }}>
        <LabeledInput
          label="AGE"
          value={value.age}
          onChange={(age) => onChange({ ...value, age })}
          placeholder="45"
          type="number"
        />
        <div>
          <BracketLabel tone="muted" size="xs">
            SEX
          </BracketLabel>
          <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
            {(['M', 'F', 'X', 'U'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ ...value, sex: s })}
                style={{
                  flex: 1,
                  padding: `${SPACE.sm + 2}px 0`,
                  background: value.sex === s ? COLORS.accent : COLORS.bgDeep,
                  border: `1px solid ${value.sex === s ? COLORS.accent : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: value.sex === s ? COLORS.bg : COLORS.textSecondary,
                  fontFamily: FONTS.mono,
                  fontWeight: 600,
                  fontSize: 12,
                  letterSpacing: '0.14em',
                  cursor: 'pointer',
                  transition: cssTransition(),
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
      <LabeledInput
        label="CHIEF COMPLAINT"
        value={value.chiefComplaint}
        onChange={(cc) => onChange({ ...value, chiefComplaint: cc })}
        placeholder="e.g. Chest pain radiating to left arm, onset 20m"
        multiline
      />
    </div>
  );
};

const LabeledInput: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  multiline?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', multiline }) => {
  const [focused, setFocused] = useState(false);
  const common: React.CSSProperties = {
    width: '100%',
    padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
    background: COLORS.bgDeep,
    border: `1px solid ${focused ? COLORS.accent : COLORS.border}`,
    borderRadius: RADIUS.sm,
    color: COLORS.textPrimary,
    fontFamily: FONTS.sans,
    fontSize: 16, // 16px to prevent iOS auto-zoom on focus
    fontWeight: 500,
    outline: 'none',
    transition: cssTransition(),
    boxShadow: focused ? `0 0 0 3px ${COLORS.accentGlow}` : 'none',
  };
  return (
    <div>
      <BracketLabel tone="muted" size="xs">
        {label}
      </BracketLabel>
      <div style={{ marginTop: 4 }}>
        {multiline ? (
          <textarea
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{ ...common, minHeight: 72, resize: 'vertical', fontFamily: FONTS.sans }}
          />
        ) : (
          <input
            type={type}
            value={value}
            placeholder={placeholder}
            inputMode={type === 'number' ? 'numeric' : undefined}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={common}
          />
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// VitalsStep — mini vital entry with danger-zone highlighting
// ─────────────────────────────────────────────────────────────────────────

const VitalsStep: React.FC<{
  vitals: Partial<Vital>;
  onChange: (v: Partial<Vital>) => void;
  ageYears: number;
}> = ({ vitals, onChange, ageYears }) => {
  const danger = useMemo(() => vitalsDangerZone(vitals, ageYears), [vitals, ageYears]);
  const setField = (key: keyof Vital) => (raw: string) => {
    const num = raw === '' ? undefined : Number(raw);
    onChange({ ...vitals, [key]: Number.isNaN(num) ? undefined : num });
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <div
        style={{
          padding: SPACE.md,
          border: `1px solid ${danger ? COLORS.accent : COLORS.border}`,
          background: danger ? 'rgba(225,29,72,0.05)' : COLORS.surface,
          borderRadius: RADIUS.sm,
          display: 'flex',
          alignItems: 'center',
          gap: SPACE.sm,
        }}
      >
        {danger ? (
          <>
            <AlertTriangle size={14} color={COLORS.accent} strokeWidth={2.5} />
            <Mono tone="accent" size="base">
              VITALS IN ESI DANGER ZONE · CONSIDER UP-TRIAGE
            </Mono>
          </>
        ) : (
          <>
            <CheckCircle2 size={14} color={COLORS.ok} strokeWidth={2} />
            <Mono tone="ok" size="base">
              VITALS WITHIN ESI ACCEPTABLE RANGE
            </Mono>
          </>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm }}>
        <VitalEntry label="HR" unit="bpm" value={vitals.heartRate} onChange={setField('heartRate')} />
        <VitalEntry label="RR" unit="/min" value={vitals.respRate} onChange={setField('respRate')} />
        <VitalEntry label="SBP" unit="mmHg" value={vitals.systolic} onChange={setField('systolic')} />
        <VitalEntry label="DBP" unit="mmHg" value={vitals.diastolic} onChange={setField('diastolic')} />
        <VitalEntry label="SpO2" unit="%" value={vitals.spO2} onChange={setField('spO2')} />
        <VitalEntry label="Temp" unit="°C" value={vitals.temperature} onChange={setField('temperature')} step={0.1} />
      </div>
    </div>
  );
};

const VitalEntry: React.FC<{
  label: string;
  unit: string;
  value: number | undefined;
  onChange: (v: string) => void;
  step?: number;
}> = ({ label, unit, value, onChange, step = 1 }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <BracketLabel tone="muted" size="xs">
        {label}
      </BracketLabel>
      <div
        style={{
          marginTop: 4,
          position: 'relative',
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          step={step}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: `${SPACE.sm + 2}px 38px ${SPACE.sm + 2}px ${SPACE.md}px`,
            background: COLORS.bgDeep,
            border: `1px solid ${focused ? COLORS.accent : COLORS.border}`,
            borderRadius: RADIUS.sm,
            color: COLORS.textPrimary,
            fontFamily: FONTS.mono,
            fontSize: 16,
            fontWeight: 700,
            outline: 'none',
            boxShadow: focused ? `0 0 0 3px ${COLORS.accentGlow}` : 'none',
            fontVariantNumeric: 'tabular-nums',
          }}
        />
        <Mono
          tone="muted"
          size="xs"
          style={{
            position: 'absolute',
            right: SPACE.md,
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          {unit}
        </Mono>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ResourcesStep — checkbox list with live count + non-resource reference
// ─────────────────────────────────────────────────────────────────────────

const ResourcesStep: React.FC<{
  selected: Set<string>;
  onToggle: (id: string) => void;
}> = ({ selected, onToggle }) => {
  const count = selected.size;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: SPACE.md,
          border: `1px solid ${COLORS.borderStrong}`,
          background: COLORS.surfaceElev,
          borderRadius: RADIUS.sm,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Mono tone="muted" size="xs">
            RESOURCE COUNT
          </Mono>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 32,
              fontWeight: 700,
              lineHeight: 1,
              color:
                count === 0 ? COLORS.ok : count === 1 ? COLORS.info : count >= 2 ? COLORS.warn : COLORS.textPrimary,
            }}
          >
            {count}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Mono tone="muted" size="xs">
            PROJECTED
          </Mono>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.textPrimary,
              marginTop: 4,
            }}
          >
            {count === 0 ? 'ESI 5' : count === 1 ? 'ESI 4' : 'ESI 3'}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {RESOURCES.map((r) => {
          const isSelected = selected.has(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => onToggle(r.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                background: isSelected ? 'rgba(225,29,72,0.06)' : COLORS.bgDeep,
                border: `1px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                borderLeft: `3px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                borderRadius: RADIUS.sm,
                cursor: 'pointer',
                textAlign: 'left',
                transition: cssTransition(),
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isSelected ? COLORS.accent : COLORS.surface,
                  border: `1px solid ${isSelected ? COLORS.accent : COLORS.borderStrong}`,
                  borderRadius: RADIUS.sm,
                  color: '#000',
                  flexShrink: 0,
                }}
              >
                {isSelected && <CheckCircle2 size={12} strokeWidth={3} />}
              </div>
              <r.icon
                size={13}
                strokeWidth={2}
                color={isSelected ? COLORS.accent : COLORS.textMuted}
              />
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 13,
                  fontWeight: 500,
                  color: isSelected ? COLORS.textPrimary : COLORS.textSecondary,
                }}
              >
                {r.label}
              </span>
            </button>
          );
        })}
      </div>

      <div
        style={{
          padding: SPACE.md,
          background: COLORS.surface,
          border: `1px dashed ${COLORS.borderStrong}`,
          borderRadius: RADIUS.sm,
        }}
      >
        <Mono tone="muted" size="xs">
          DOES NOT COUNT AS A RESOURCE (ESI v4)
        </Mono>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 4,
            marginTop: 6,
          }}
        >
          {NON_RESOURCES.map((r) => (
            <span
              key={r.id}
              style={{
                padding: '3px 8px',
                background: COLORS.bgDeep,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                fontFamily: FONTS.sans,
                fontSize: 11,
                color: COLORS.textMuted,
              }}
            >
              {r.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ResultStep — the final ESI badge + disposition card
// ─────────────────────────────────────────────────────────────────────────

const ResultStep: React.FC<{ result: TriageResult; onConfirm: () => void; onReset: () => void }> = ({
  result,
  onConfirm,
  onReset,
}) => {
  const disp = dispositionByEsi[result.esi];
  const color =
    disp.tone === 'crit' ? COLORS.crit : disp.tone === 'warn' ? COLORS.warn : disp.tone === 'info' ? COLORS.info : COLORS.ok;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.lg }}>
      {/* ESI badge */}
      <div
        style={{
          position: 'relative',
          padding: `${SPACE['2xl']}px ${SPACE.base}px`,
          border: `1px solid ${color}`,
          borderLeft: `3px solid ${color}`,
          background: 'rgba(0,0,0,0.4)',
          borderRadius: RADIUS.sm,
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <CornerBracket position="tl" color={color} size={10} thickness={1.5} inset={-1} />
        <CornerBracket position="tr" color={color} size={10} thickness={1.5} inset={-1} />
        <CornerBracket position="bl" color={color} size={10} thickness={1.5} inset={-1} />
        <CornerBracket position="br" color={color} size={10} thickness={1.5} inset={-1} />

        <Mono tone="muted" size="xs" style={{ marginBottom: 10 }}>
          ASSIGNED ACUITY
        </Mono>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 76,
            fontWeight: 700,
            color,
            lineHeight: 0.9,
            letterSpacing: '-0.05em',
            textShadow: `0 0 28px ${color}55`,
          }}
        >
          ESI {result.esi}
        </div>
        <Mono tone="secondary" size="base" style={{ marginTop: SPACE.sm }}>
          {result.esi === 1
            ? 'IMMEDIATE LIFE THREAT'
            : result.esi === 2
            ? 'HIGH RISK · URGENT'
            : result.esi === 3
            ? 'MODERATE · MULTIPLE RESOURCES'
            : result.esi === 4
            ? 'LOW · ONE RESOURCE'
            : 'MINIMAL · NO RESOURCES'}
        </Mono>
      </div>

      {/* Disposition */}
      <TacticalCard padding="md">
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          <Mono tone="muted" size="xs">
            DISPOSITION
          </Mono>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 17,
              fontWeight: 600,
              color: COLORS.textPrimary,
            }}
          >
            {disp.bay}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <User size={12} strokeWidth={2} color={COLORS.textMuted} />
            <Mono tone="secondary" size="xs">
              {disp.staffing}
            </Mono>
          </div>
        </div>
      </TacticalCard>

      {/* One-line handoff */}
      <TacticalCard padding="md" accentBar>
        <Mono tone="muted" size="xs" style={{ marginBottom: 6 }}>
          ONE-LINE HANDOFF · COPY-PASTE READY
        </Mono>
        <div
          style={{
            padding: SPACE.md,
            background: COLORS.bgDeep,
            border: `1px solid ${COLORS.border}`,
            borderRadius: RADIUS.sm,
            fontFamily: FONTS.mono,
            fontSize: 13,
            fontWeight: 500,
            color: COLORS.textPrimary,
            lineHeight: 1.5,
            userSelect: 'all',
          }}
        >
          {result.handoffLine}
        </div>
      </TacticalCard>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.sm }}>
        <TacticalButton variant="secondary" onClick={onReset} icon={<ChevronLeft size={13} strokeWidth={2} />}>
          Start Over
        </TacticalButton>
        <TacticalButton variant="primary" onClick={onConfirm} icon={<CheckCircle2 size={13} strokeWidth={2} />}>
          Assign & Route
        </TacticalButton>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Main ESITriageScreen
// ─────────────────────────────────────────────────────────────────────────

const emptyIdentity = { name: '', age: '', sex: 'U' as 'M' | 'F' | 'X' | 'U', chiefComplaint: '' };

export const ESITriageScreen: React.FC<ESITriageScreenProps> = ({ open, onClose, onComplete }) => {
  const [stepIdx, setStepIdx] = useState(0);
  const [identity, setIdentity] = useState(emptyIdentity);
  const [lifeThreat, setLifeThreat] = useState(false);
  const [highRisk, setHighRisk] = useState(false);
  const [vitals, setVitals] = useState<Partial<Vital>>({});
  const [resources, setResources] = useState<Set<string>>(new Set());

  // Reset when the screen opens
  React.useEffect(() => {
    if (open) {
      setStepIdx(0);
      setIdentity(emptyIdentity);
      setLifeThreat(false);
      setHighRisk(false);
      setVitals({});
      setResources(new Set());
    }
  }, [open]);

  const ageYears = Number(identity.age) || 0;

  // Compute the ESI the moment we reach the result step
  const result = useMemo<TriageResult | null>(() => {
    const complete = STEP_ORDER[stepIdx] === 'result';
    if (!complete) return null;

    let esi: EsiLevel;
    if (lifeThreat) esi = 1;
    else if (highRisk) esi = 2;
    else {
      const abnormalVitals = vitalsDangerZone(vitals, ageYears);
      if (abnormalVitals) esi = 3;
      else if (resources.size >= 2) esi = 3;
      else if (resources.size === 1) esi = 4;
      else esi = 5;
    }
    const disposition = dispositionByEsi[esi];

    const sex = identity.sex;
    const ageStr = identity.age ? `${identity.age}${sex}` : '—';
    const bpStr =
      vitals.systolic != null && vitals.diastolic != null
        ? `${vitals.systolic}/${vitals.diastolic}`
        : '—';
    const handoffLine = `ESI ${esi} · ${identity.name || 'Unknown'} · ${ageStr} · CC: ${identity.chiefComplaint || 'not documented'} · HR ${vitals.heartRate ?? '—'} BP ${bpStr} SpO2 ${vitals.spO2 ?? '—'}% RR ${vitals.respRate ?? '—'} T ${vitals.temperature ?? '—'}°C · ${resources.size} resource(s) · route to ${disposition.bay}`;

    return {
      esi,
      chiefComplaint: identity.chiefComplaint,
      patientName: identity.name,
      age: Number(identity.age) || 0,
      sex,
      lifeThreat,
      highRisk,
      resourceCount: resources.size,
      vitalsAbnormal: vitalsDangerZone(vitals, ageYears),
      vitals,
      suggestedBay: disposition.bay,
      handoffLine,
      createdAt: new Date().toISOString(),
    };
  }, [stepIdx, identity, lifeThreat, highRisk, vitals, resources, ageYears]);

  const step = STEP_ORDER[stepIdx];

  const goNext = () => {
    // Conditional skipping:
    //   • lifeThreat = YES → jump straight to result (ESI 1)
    //   • highRisk  = YES → jump straight to result (ESI 2)
    if (step === 'lifeThreat' && lifeThreat) {
      setStepIdx(STEP_ORDER.indexOf('result'));
      return;
    }
    if (step === 'highRisk' && highRisk) {
      setStepIdx(STEP_ORDER.indexOf('result'));
      return;
    }
    setStepIdx((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  };

  const goBack = () => setStepIdx((i) => Math.max(i - 1, 0));

  const canAdvanceFromIdentity =
    identity.name.trim().length > 1 && identity.age.trim().length > 0 && identity.chiefComplaint.trim().length > 2;

  const toggleResource = (id: string) =>
    setResources((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleConfirm = () => {
    if (result) onComplete(result);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="esi-triage"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 200,
          background: COLORS.bg,
          color: COLORS.textPrimary,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONTS.sans,
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
          paddingRight: 'env(safe-area-inset-right)',
          overflow: 'hidden',
        }}
      >
        <DotGridBg />

        <HudStrip side="top" fixed={false} height={52}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flex: 1, minWidth: 0 }}>
            <motion.button
              type="button"
              onClick={onClose}
              aria-label="Close"
              whileTap={{ scale: 0.97 }}
              style={{
                width: 32,
                height: 32,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: COLORS.textSecondary,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              <X size={18} strokeWidth={2} />
            </motion.button>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <BracketLabel tone="accent" size="xs">
                ESI · TRIAGE
              </BracketLabel>
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  letterSpacing: '-0.003em',
                }}
              >
                Emergency Severity Index
              </span>
            </div>
          </div>
          <StatusPill label="V4" tone="info" size="xs" />
        </HudStrip>

        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE['3xl']}px`,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              >
                {step === 'identity' && (
                  <>
                    <StepHeader
                      index={0}
                      total={STEP_ORDER.length}
                      label="INTAKE"
                      title="Who is the patient?"
                    />
                    <IdentityStep value={identity} onChange={setIdentity} />
                  </>
                )}

                {step === 'lifeThreat' && (
                  <>
                    <StepHeader
                      index={1}
                      total={STEP_ORDER.length}
                      label="DECISION · A"
                      title="Does the patient require an immediate life-saving intervention?"
                    />
                    <CriteriaList
                      label="YES if any of:"
                      items={[
                        'Unresponsive or peri-arrest',
                        'Airway compromised · apnea · severe respiratory distress',
                        'SpO2 < 90% on room air · cyanosis',
                        'Hemodynamically unstable · active severe bleeding',
                        'Witnessed seizure activity · status epilepticus',
                        'Severe hypoglycemia · altered mental status',
                      ]}
                    />
                    <YesNoButtons
                      onNo={() => {
                        setLifeThreat(false);
                        goNext();
                      }}
                      onYes={() => {
                        setLifeThreat(true);
                        setStepIdx(STEP_ORDER.indexOf('result'));
                      }}
                    />
                  </>
                )}

                {step === 'highRisk' && (
                  <>
                    <StepHeader
                      index={2}
                      total={STEP_ORDER.length}
                      label="DECISION · B"
                      title="Is this a high-risk or time-sensitive situation?"
                    />
                    <CriteriaList
                      label="YES if any of:"
                      items={[
                        'Chest pain with age >50, risk factors, or reassurance-refractory',
                        'Acute stroke symptoms (FAST positive, onset <4.5h)',
                        'New altered mental status · new confusion',
                        'Severe pain (8–10/10)',
                        'Active psychiatric emergency (SI with plan, agitated)',
                        'Immunocompromised host with fever',
                        'Pregnancy with bleeding or severe abdominal pain',
                      ]}
                    />
                    <YesNoButtons
                      yesTone="warn"
                      onNo={() => {
                        setHighRisk(false);
                        goNext();
                      }}
                      onYes={() => {
                        setHighRisk(true);
                        setStepIdx(STEP_ORDER.indexOf('result'));
                      }}
                    />
                  </>
                )}

                {step === 'vitals' && (
                  <>
                    <StepHeader
                      index={3}
                      total={STEP_ORDER.length}
                      label="DECISION · C1"
                      title="Capture vital signs"
                    />
                    <VitalsStep vitals={vitals} onChange={setVitals} ageYears={ageYears} />
                    <StepNav onBack={goBack} onNext={goNext} nextLabel="Next: Resources" />
                  </>
                )}

                {step === 'resources' && (
                  <>
                    <StepHeader
                      index={4}
                      total={STEP_ORDER.length}
                      label="DECISION · C2"
                      title="How many resources does this patient need?"
                    />
                    <ResourcesStep selected={resources} onToggle={toggleResource} />
                    <StepNav onBack={goBack} onNext={goNext} nextLabel="Compute ESI" />
                  </>
                )}

                {step === 'result' && result && (
                  <>
                    <StepHeader
                      index={5}
                      total={STEP_ORDER.length}
                      label="RESULT"
                      title="Triage complete"
                    />
                    <ResultStep
                      result={result}
                      onConfirm={handleConfirm}
                      onReset={() => setStepIdx(0)}
                    />
                  </>
                )}

                {/* Identity step has its own nav to gate on required fields. */}
                {step === 'identity' && (
                  <StepNav
                    onBack={() => undefined}
                    backDisabled
                    onNext={goNext}
                    nextLabel="Begin triage"
                    nextDisabled={!canAdvanceFromIdentity}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </motion.div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Shared sub-components
// ─────────────────────────────────────────────────────────────────────────

const CriteriaList: React.FC<{ label: string; items: string[] }> = ({ label, items }) => (
  <div
    style={{
      padding: SPACE.md,
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      marginTop: SPACE.md,
    }}
  >
    <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.sm }}>
      {label}
    </Mono>
    <ul
      style={{
        margin: 0,
        paddingLeft: SPACE.md,
        listStyle: 'none',
      }}
    >
      {items.map((item) => (
        <li
          key={item}
          style={{
            position: 'relative',
            paddingLeft: SPACE.md,
            fontFamily: FONTS.sans,
            fontSize: 13,
            lineHeight: 1.55,
            color: COLORS.textSecondary,
          }}
        >
          <span
            style={{
              position: 'absolute',
              left: 0,
              top: 8,
              width: 6,
              height: 1,
              background: COLORS.accent,
            }}
          />
          {item}
        </li>
      ))}
    </ul>
  </div>
);

const StepNav: React.FC<{
  onBack: () => void;
  onNext: () => void;
  backDisabled?: boolean;
  nextDisabled?: boolean;
  nextLabel?: string;
}> = ({ onBack, onNext, backDisabled, nextDisabled, nextLabel = 'Next' }) => (
  <div
    style={{
      display: 'flex',
      gap: SPACE.sm,
      marginTop: SPACE.xl,
    }}
  >
    <TacticalButton
      variant="ghost"
      onClick={onBack}
      disabled={backDisabled}
      icon={<ArrowLeft size={13} strokeWidth={2} />}
    >
      Back
    </TacticalButton>
    <div style={{ flex: 1 }} />
    <TacticalButton
      variant="primary"
      onClick={onNext}
      disabled={nextDisabled}
      icon={<ArrowRight size={13} strokeWidth={2} />}
    >
      {nextLabel}
    </TacticalButton>
  </div>
);

export default ESITriageScreen;
