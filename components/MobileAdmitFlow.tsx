/**
 * MobileAdmitFlow — phone-native admission form.
 *
 * Unlike the desktop AdmitFlow (3-step wizard), this is a single
 * scrollable form that exposes every admission field at once:
 *
 *   1. Patient Demographics
 *   2. Clinical Info
 *   3. Admission Vitals
 *   4. Allergies (repeating rows)
 *   5. Problems / Diagnoses (repeating rows)
 *
 * Admission always proceeds — bed assignment is deferred; patients land
 * in the holding area tagged `admitted-unassigned`.
 *
 * Renders as a fullscreen overlay (position: fixed, inset: 0, z-index 50)
 * that slides up from the bottom.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Plus, Trash2 } from 'lucide-react';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  Mono,
  BracketLabel,
  TacticalCard,
  TacticalButton,
  Divider,
} from './design';
import type {
  AdmissionEntry,
  AdmissionAllergyInput,
  AdmissionProblemInput,
} from './clinical';
import { useSwipeBack } from '../lib/useSwipeBack';

// ─────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────

export interface MobileAdmitFlowProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  onSubmitAdmission?: (
    entry: Omit<AdmissionEntry, 'id' | 'status' | 'waitMin' | 'requestedAt'>,
  ) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Form state shape
// ─────────────────────────────────────────────────────────────────────────

type Sex = 'M' | 'F' | 'X' | 'U' | '';
type AllergySeverity = AdmissionAllergyInput['severity'];
type ProblemStatus = AdmissionProblemInput['status'];

interface FormState {
  firstName: string;
  lastName: string;
  mrn: string;
  dob: string;
  sex: Sex;
  weightKg: string;
  heightCm: string;
  insurance: string;
  emergencyContact: string;
  preferredLanguage: string;
  needsInterpreter: boolean;
  complaint: string;
  attending: string;
  esi: string;
  arrivalMode: string;
  isolation: string;
  codeStatus: string;
  hr: string;
  sbp: string;
  dbp: string;
  rr: string;
  spo2: string;
  temp: string;
  pain: string;
  gcs: string;
  allergies: AdmissionAllergyInput[];
  problems: AdmissionProblemInput[];
}

const BLANK_ALLERGY: AdmissionAllergyInput = {
  substance: '',
  reaction: '',
  severity: 'moderate',
};

const BLANK_PROBLEM: AdmissionProblemInput = {
  display: '',
  icd10: '',
  status: 'active',
};

const INITIAL_FORM: FormState = {
  firstName: '',
  lastName: '',
  mrn: '',
  dob: '',
  sex: '',
  weightKg: '',
  heightCm: '',
  insurance: '',
  emergencyContact: '',
  preferredLanguage: 'English',
  needsInterpreter: false,
  complaint: '',
  attending: '',
  esi: '3',
  arrivalMode: 'walk-in',
  isolation: 'NONE',
  codeStatus: 'FULL',
  hr: '',
  sbp: '',
  dbp: '',
  rr: '',
  spo2: '',
  temp: '',
  pain: '',
  gcs: '15',
  allergies: [{ ...BLANK_ALLERGY }, { ...BLANK_ALLERGY }, { ...BLANK_ALLERGY }],
  problems: [{ ...BLANK_PROBLEM }, { ...BLANK_PROBLEM }],
};

// ─────────────────────────────────────────────────────────────────────────
// Dropdown option sets
// ─────────────────────────────────────────────────────────────────────────

const LANGUAGE_OPTIONS = [
  'English',
  'Spanish',
  'Mandarin',
  'Cantonese',
  'Vietnamese',
  'Tagalog',
  'Arabic',
  'Russian',
  'French',
  'Other',
];

const ATTENDING_OPTIONS = [
  '',
  'Dr. Rivera',
  'Dr. Kim',
  'Dr. Chen',
  'Dr. Foster',
  'Dr. Adams',
  'Dr. Patel',
  'Dr. Nguyen',
  'Dr. Alvarez',
  'Dr. Hayes',
];

const ARRIVAL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'walk-in', label: 'Walk-in' },
  { value: 'ems', label: 'EMS' },
  { value: 'transfer', label: 'Transfer' },
  { value: 'direct', label: 'Direct' },
];

const ISOLATION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'NONE', label: 'None' },
  { value: 'CONTACT', label: 'Contact' },
  { value: 'DROPLET', label: 'Droplet' },
  { value: 'AIRBORNE', label: 'Airborne' },
  { value: 'PROTECTIVE', label: 'Protective' },
];

const CODE_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'FULL', label: 'Full Code' },
  { value: 'DNR', label: 'DNR' },
  { value: 'DNI', label: 'DNI' },
  { value: 'DNR-DNI', label: 'DNR-DNI' },
  { value: 'COMFORT', label: 'Comfort' },
  { value: 'LIMITED', label: 'Limited' },
  { value: 'UNKNOWN', label: 'Unknown' },
];

const SEX_OPTIONS: Array<{ value: Sex; label: string }> = [
  { value: '', label: '—' },
  { value: 'M', label: 'M' },
  { value: 'F', label: 'F' },
  { value: 'X', label: 'X' },
  { value: 'U', label: 'U' },
];

const SEVERITY_OPTIONS: Array<{ value: AllergySeverity; label: string }> = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
  { value: 'life-threatening', label: 'Life-threat' },
];

const PROBLEM_STATUS_OPTIONS: Array<{ value: ProblemStatus; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'inactive', label: 'Inactive' },
];

const ESI_OPTIONS = ['1', '2', '3', '4', '5'];

// ─────────────────────────────────────────────────────────────────────────
// Shared input styling
// ─────────────────────────────────────────────────────────────────────────

const baseInputStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 44,
  padding: '10px 12px',
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.sm,
  fontFamily: FONTS.sans,
  fontSize: 14,
  color: COLORS.textPrimary,
  outline: 'none',
  boxSizing: 'border-box',
  // Keep native elements from breaking phone layout.
  maxWidth: '100%',
};

const selectInputStyle: React.CSSProperties = {
  ...baseInputStyle,
  appearance: 'none',
  WebkitAppearance: 'none',
  MozAppearance: 'none',
  backgroundImage: `linear-gradient(45deg, transparent 50%, ${COLORS.textMuted} 50%), linear-gradient(135deg, ${COLORS.textMuted} 50%, transparent 50%)`,
  backgroundPosition: 'calc(100% - 14px) 50%, calc(100% - 9px) 50%',
  backgroundSize: '5px 5px, 5px 5px',
  backgroundRepeat: 'no-repeat',
  paddingRight: 28,
};

// ─────────────────────────────────────────────────────────────────────────
// Focus-aware input primitives
// ─────────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
  /** When true, label is rendered as a small mono caption above child. */
  monoLabel?: boolean;
  style?: React.CSSProperties;
}

const Field: React.FC<FieldProps> = ({ label, children, style }) => (
  <label
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      minWidth: 0,
      ...style,
    }}
  >
    <Mono tone="muted" size="xs">
      {label}
    </Mono>
    {children}
  </label>
);

interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const TextInput: React.FC<TextInputProps> = ({ style, onFocus, onBlur, ...rest }) => {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={{
        ...baseInputStyle,
        borderColor: focused ? COLORS.accent : COLORS.border,
        boxShadow: focused ? `0 0 0 1px ${COLORS.accent}40` : undefined,
        transition: `border-color ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease`,
        ...style,
      }}
    />
  );
};

interface SelectInputProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const SelectInput: React.FC<SelectInputProps> = ({ style, onFocus, onBlur, ...rest }) => {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={{
        ...selectInputStyle,
        borderColor: focused ? COLORS.accent : COLORS.border,
        boxShadow: focused ? `0 0 0 1px ${COLORS.accent}40` : undefined,
        transition: `border-color ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease`,
        ...style,
      }}
    />
  );
};

interface TextAreaInputProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const TextAreaInput: React.FC<TextAreaInputProps> = ({ style, onFocus, onBlur, ...rest }) => {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...rest}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={{
        ...baseInputStyle,
        minHeight: 72,
        resize: 'vertical',
        borderColor: focused ? COLORS.accent : COLORS.border,
        boxShadow: focused ? `0 0 0 1px ${COLORS.accent}40` : undefined,
        transition: `border-color ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease`,
        ...style,
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────
// Section card wrapper
// ─────────────────────────────────────────────────────────────────────────

interface SectionCardProps {
  title: string;
  accentHeader?: boolean;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, accentHeader, children }) => (
  <TacticalCard padding="sm">
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.sm,
        minHeight: 32,
      }}
    >
      {accentHeader ? (
        <BracketLabel tone="accent" size="sm">
          {title}
        </BracketLabel>
      ) : (
        <Mono tone="primary" size="sm" style={{ letterSpacing: '0.14em' }}>
          {title}
        </Mono>
      )}
    </div>
    <Divider style={{ margin: `${SPACE.sm}px 0 ${SPACE.md}px` }} />
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>{children}</div>
  </TacticalCard>
);

// ─────────────────────────────────────────────────────────────────────────
// Pair row — for side-by-side fields on phone widths
// ─────────────────────────────────────────────────────────────────────────

const PairRow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: SPACE.sm,
      minWidth: 0,
    }}
  >
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const MobileAdmitFlow: React.FC<MobileAdmitFlowProps> = ({
  open,
  onClose,
  showToast,
  onSubmitAdmission,
}) => {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);

  // iOS-style edge-swipe-to-close gesture
  const swipeBackRef = useSwipeBack<HTMLDivElement>({
    onSwipeBack: onClose,
    enabled: open,
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateAllergy = <K extends keyof AdmissionAllergyInput>(
    idx: number,
    key: K,
    value: AdmissionAllergyInput[K],
  ) => {
    setForm((prev) => {
      const next = prev.allergies.slice();
      next[idx] = { ...next[idx], [key]: value };
      return { ...prev, allergies: next };
    });
  };

  const addAllergy = () => {
    setForm((prev) => ({ ...prev, allergies: [...prev.allergies, { ...BLANK_ALLERGY }] }));
  };

  const removeAllergy = (idx: number) => {
    setForm((prev) => ({ ...prev, allergies: prev.allergies.filter((_, i) => i !== idx) }));
  };

  const updateProblem = <K extends keyof AdmissionProblemInput>(
    idx: number,
    key: K,
    value: AdmissionProblemInput[K],
  ) => {
    setForm((prev) => {
      const next = prev.problems.slice();
      next[idx] = { ...next[idx], [key]: value };
      return { ...prev, problems: next };
    });
  };

  const addProblem = () => {
    setForm((prev) => ({ ...prev, problems: [...prev.problems, { ...BLANK_PROBLEM }] }));
  };

  const removeProblem = (idx: number) => {
    setForm((prev) => ({ ...prev, problems: prev.problems.filter((_, i) => i !== idx) }));
  };

  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const complaint = form.complaint.trim();
  const canSubmit = firstName.length > 0 && lastName.length > 0 && complaint.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) {
      showToast('Fill in name and chief complaint to admit.', 'error');
      return;
    }

    const fullName = `${firstName} ${lastName}`;
    const mrn = form.mrn.trim() || `MRN-${Math.floor(1000 + Math.random() * 9000)}`;
    const source: AdmissionEntry['source'] =
      form.arrivalMode === 'transfer'
        ? 'Transfer'
        : form.arrivalMode === 'direct'
        ? 'Direct'
        : 'ED';

    const toNum = (v: string): number | undefined => {
      if (!v.trim()) return undefined;
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const cleanedAllergies = form.allergies.filter((a) => a.substance.trim().length > 0);
    const cleanedProblems = form.problems.filter((p) => p.display.trim().length > 0);

    const entry: Omit<AdmissionEntry, 'id' | 'status' | 'waitMin' | 'requestedAt'> = {
      name: fullName,
      mrn,
      source,
      acuity: Number(form.esi) || 3,
      complaint,
      requestedUnit: 'Med-Surg',
      attending: form.attending || 'Unassigned',
      bedAssignmentStatus: 'admitted-unassigned',
      demographics: {
        dob: form.dob || undefined,
        sex: form.sex === '' ? undefined : form.sex,
        insurance: form.insurance.trim() || undefined,
        emergencyContact: form.emergencyContact.trim() || undefined,
        preferredLanguage: form.preferredLanguage || undefined,
        needsInterpreter: form.needsInterpreter,
        weightKg: toNum(form.weightKg),
        heightCm: toNum(form.heightCm),
        arrivalMode: form.arrivalMode || undefined,
        isolation: form.isolation || undefined,
        codeStatus: form.codeStatus || undefined,
        vitals: {
          hr: toNum(form.hr),
          systolic: toNum(form.sbp),
          diastolic: toNum(form.dbp),
          rr: toNum(form.rr),
          spo2: toNum(form.spo2),
          temp: toNum(form.temp),
          painScore: toNum(form.pain),
          gcs: toNum(form.gcs),
        },
        allergies: cleanedAllergies,
        problems: cleanedProblems,
      },
    };

    onSubmitAdmission?.(entry);
    showToast(`Admitted ${fullName} — BED UNASSIGNED`, 'success');
    setForm(INITIAL_FORM);
    onClose();
  };

  const handleCancel = () => {
    setForm(INITIAL_FORM);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="mobile-admit-flow"
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
          {/* ── FIXED HEADER ───────────────────────────────────────── */}
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
            <button
              onClick={handleCancel}
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
              <ChevronLeft size={18} />
              Cancel
            </button>

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
              New Admission Request
            </div>

            {/* Right spacer — balances left cancel button width */}
            <div style={{ minWidth: 44, flexShrink: 0 }} aria-hidden />
          </div>

          {/* ── SCROLLABLE BODY ────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              padding: SPACE.base,
              paddingBottom: `calc(${SPACE.base}px + 72px + env(safe-area-inset-bottom))`,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.lg,
            }}
          >
            {/* Accent title header */}
            <div style={{ paddingBottom: SPACE.xs }}>
              <BracketLabel tone="accent" size="base">
                + NEW ADMISSION REQUEST
              </BracketLabel>
            </div>

            {/* ── 1 · PATIENT DEMOGRAPHICS ─────────────────────────── */}
            <SectionCard title="1 · PATIENT DEMOGRAPHICS">
              <PairRow>
                <Field label="FIRST NAME">
                  <TextInput
                    value={form.firstName}
                    onChange={(e) => set('firstName', e.target.value)}
                    placeholder="Jane"
                    autoComplete="given-name"
                  />
                </Field>
                <Field label="LAST NAME">
                  <TextInput
                    value={form.lastName}
                    onChange={(e) => set('lastName', e.target.value)}
                    placeholder="Doe"
                    autoComplete="family-name"
                  />
                </Field>
              </PairRow>

              <Field label="MRN">
                <TextInput
                  value={form.mrn}
                  onChange={(e) => set('mrn', e.target.value)}
                  placeholder="MRN-0000"
                  inputMode="text"
                  style={{ fontFamily: FONTS.mono, letterSpacing: '0.08em' }}
                />
              </Field>

              <PairRow>
                <Field label="DATE OF BIRTH">
                  <TextInput
                    value={form.dob}
                    onChange={(e) => set('dob', e.target.value)}
                    placeholder="MM/DD/YYYY"
                    inputMode="numeric"
                    autoComplete="bday"
                  />
                </Field>
                <Field label="SEX">
                  <SelectInput value={form.sex} onChange={(e) => set('sex', e.target.value as Sex)}>
                    {SEX_OPTIONS.map((o) => (
                      <option key={o.value || 'empty'} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </PairRow>

              <PairRow>
                <Field label="WEIGHT (KG)">
                  <TextInput
                    value={form.weightKg}
                    onChange={(e) => set('weightKg', e.target.value)}
                    placeholder="70"
                    inputMode="decimal"
                  />
                </Field>
                <Field label="HEIGHT (CM)">
                  <TextInput
                    value={form.heightCm}
                    onChange={(e) => set('heightCm', e.target.value)}
                    placeholder="170"
                    inputMode="decimal"
                  />
                </Field>
              </PairRow>

              <Field label="INSURANCE / PAYER">
                <TextInput
                  value={form.insurance}
                  onChange={(e) => set('insurance', e.target.value)}
                  placeholder="Medicare, BCBS, Self-pay..."
                />
              </Field>

              <Field label="EMERGENCY CONTACT (NAME / PHONE)">
                <TextInput
                  value={form.emergencyContact}
                  onChange={(e) => set('emergencyContact', e.target.value)}
                  placeholder="John Doe / 555-1234"
                  autoComplete="off"
                />
              </Field>

              <Field label="LANGUAGE">
                <SelectInput
                  value={form.preferredLanguage}
                  onChange={(e) => set('preferredLanguage', e.target.value)}
                >
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              {/* Interpreter toggle — 44px touch target */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.sm,
                  minHeight: 44,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.needsInterpreter}
                  onChange={(e) => set('needsInterpreter', e.target.checked)}
                  style={{
                    width: 20,
                    height: 20,
                    accentColor: COLORS.accent,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                />
                <Mono tone="secondary" size="xs">
                  INTERPRETER NEEDED
                </Mono>
              </label>
            </SectionCard>

            {/* ── 2 · CLINICAL INFO ────────────────────────────────── */}
            <SectionCard title="2 · CLINICAL INFO">
              <Field label="CHIEF COMPLAINT">
                <TextAreaInput
                  value={form.complaint}
                  onChange={(e) => set('complaint', e.target.value)}
                  placeholder="e.g. chest pain radiating to jaw"
                />
              </Field>

              <Field label="ATTENDING">
                <SelectInput
                  value={form.attending}
                  onChange={(e) => set('attending', e.target.value)}
                >
                  {ATTENDING_OPTIONS.map((doc) => (
                    <option key={doc || 'unassigned'} value={doc}>
                      {doc || 'Unassigned'}
                    </option>
                  ))}
                </SelectInput>
              </Field>

              <PairRow>
                <Field label="ESI">
                  <SelectInput value={form.esi} onChange={(e) => set('esi', e.target.value)}>
                    {ESI_OPTIONS.map((e) => (
                      <option key={e} value={e}>
                        ESI {e}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="ARRIVAL">
                  <SelectInput
                    value={form.arrivalMode}
                    onChange={(e) => set('arrivalMode', e.target.value)}
                  >
                    {ARRIVAL_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </PairRow>

              <PairRow>
                <Field label="ISOLATION">
                  <SelectInput
                    value={form.isolation}
                    onChange={(e) => set('isolation', e.target.value)}
                  >
                    {ISOLATION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
                <Field label="CODE STATUS">
                  <SelectInput
                    value={form.codeStatus}
                    onChange={(e) => set('codeStatus', e.target.value)}
                  >
                    {CODE_STATUS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </SelectInput>
                </Field>
              </PairRow>
            </SectionCard>

            {/* ── 3 · ADMISSION VITALS ─────────────────────────────── */}
            <SectionCard title="3 · ADMISSION VITALS">
              <PairRow>
                <Field label="HR (BPM)">
                  <TextInput
                    value={form.hr}
                    onChange={(e) => set('hr', e.target.value)}
                    placeholder="80"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="RR (/MIN)">
                  <TextInput
                    value={form.rr}
                    onChange={(e) => set('rr', e.target.value)}
                    placeholder="16"
                    inputMode="numeric"
                  />
                </Field>
              </PairRow>

              <PairRow>
                <Field label="SBP (MMHG)">
                  <TextInput
                    value={form.sbp}
                    onChange={(e) => set('sbp', e.target.value)}
                    placeholder="120"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="DBP (MMHG)">
                  <TextInput
                    value={form.dbp}
                    onChange={(e) => set('dbp', e.target.value)}
                    placeholder="80"
                    inputMode="numeric"
                  />
                </Field>
              </PairRow>

              <PairRow>
                <Field label="SPO2 (%)">
                  <TextInput
                    value={form.spo2}
                    onChange={(e) => set('spo2', e.target.value)}
                    placeholder="98"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="TEMP (°C)">
                  <TextInput
                    value={form.temp}
                    onChange={(e) => set('temp', e.target.value)}
                    placeholder="37.0"
                    inputMode="decimal"
                  />
                </Field>
              </PairRow>

              <PairRow>
                <Field label="PAIN (0-10)">
                  <TextInput
                    value={form.pain}
                    onChange={(e) => set('pain', e.target.value)}
                    placeholder="0"
                    inputMode="numeric"
                  />
                </Field>
                <Field label="GCS (3-15)">
                  <TextInput
                    value={form.gcs}
                    onChange={(e) => set('gcs', e.target.value)}
                    placeholder="15"
                    inputMode="numeric"
                  />
                </Field>
              </PairRow>
            </SectionCard>

            {/* ── 4 · ALLERGIES ────────────────────────────────────── */}
            <SectionCard title="4 · ALLERGIES">
              <Mono tone="muted" size="xs">
                LEAVE BLANK FOR NKA
              </Mono>
              {form.allergies.map((allergy, idx) => (
                <div
                  key={`allergy-${idx}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.sm,
                    padding: SPACE.sm,
                    background: COLORS.bgDeep,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
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
                    <Mono tone="dim" size="xs">
                      # {idx + 1}
                    </Mono>
                    {form.allergies.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAllergy(idx)}
                        aria-label={`Remove allergy row ${idx + 1}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          background: 'transparent',
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.sm,
                          color: COLORS.textMuted,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <Field label="SUBSTANCE">
                    <TextInput
                      value={allergy.substance}
                      onChange={(e) => updateAllergy(idx, 'substance', e.target.value)}
                      placeholder="e.g. Penicillin"
                    />
                  </Field>
                  <Field label="REACTION">
                    <TextInput
                      value={allergy.reaction}
                      onChange={(e) => updateAllergy(idx, 'reaction', e.target.value)}
                      placeholder="e.g. Anaphylaxis"
                    />
                  </Field>
                  <Field label="SEVERITY">
                    <SelectInput
                      value={allergy.severity}
                      onChange={(e) =>
                        updateAllergy(idx, 'severity', e.target.value as AllergySeverity)
                      }
                    >
                      {SEVERITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </SelectInput>
                  </Field>
                </div>
              ))}

              <TacticalButton
                variant="secondary"
                fullWidth
                icon={<Plus size={14} />}
                onClick={addAllergy}
                style={{ minHeight: 44, height: 44 }}
              >
                Add Allergy
              </TacticalButton>
            </SectionCard>

            {/* ── 5 · PROBLEMS / DIAGNOSES ────────────────────────── */}
            <SectionCard title="5 · PROBLEMS / DIAGNOSES">
              {form.problems.map((problem, idx) => (
                <div
                  key={`problem-${idx}`}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.sm,
                    padding: SPACE.sm,
                    background: COLORS.bgDeep,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
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
                    <Mono tone="dim" size="xs">
                      # {idx + 1}
                    </Mono>
                    {form.problems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeProblem(idx)}
                        aria-label={`Remove problem row ${idx + 1}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 32,
                          height: 32,
                          background: 'transparent',
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.sm,
                          color: COLORS.textMuted,
                          cursor: 'pointer',
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <Field label="DIAGNOSIS">
                    <TextInput
                      value={problem.display}
                      onChange={(e) => updateProblem(idx, 'display', e.target.value)}
                      placeholder="e.g. Type 2 diabetes mellitus"
                    />
                  </Field>
                  <PairRow>
                    <Field label="ICD-10">
                      <TextInput
                        value={problem.icd10}
                        onChange={(e) => updateProblem(idx, 'icd10', e.target.value)}
                        placeholder="E11.9"
                        style={{ fontFamily: FONTS.mono, letterSpacing: '0.08em' }}
                      />
                    </Field>
                    <Field label="STATUS">
                      <SelectInput
                        value={problem.status}
                        onChange={(e) =>
                          updateProblem(idx, 'status', e.target.value as ProblemStatus)
                        }
                      >
                        {PROBLEM_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </SelectInput>
                    </Field>
                  </PairRow>
                </div>
              ))}

              <TacticalButton
                variant="secondary"
                fullWidth
                icon={<Plus size={14} />}
                onClick={addProblem}
                style={{ minHeight: 44, height: 44 }}
              >
                Add Problem
              </TacticalButton>
            </SectionCard>
          </div>

          {/* ── BOTTOM ACTION BAR ──────────────────────────────────── */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              paddingTop: SPACE.sm,
              paddingBottom: `calc(${SPACE.sm}px + env(safe-area-inset-bottom))`,
              paddingLeft: `max(${SPACE.base}px, env(safe-area-inset-left))`,
              paddingRight: `max(${SPACE.base}px, env(safe-area-inset-right))`,
              background: `linear-gradient(180deg, ${COLORS.bg}00 0%, ${COLORS.bg} 40%, ${COLORS.bg} 100%)`,
              borderTop: `1px solid ${COLORS.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.xs,
              zIndex: 3,
            }}
          >
            <TacticalButton
              variant="primary"
              fullWidth
              disabled={!canSubmit}
              onClick={handleSubmit}
              style={{ minHeight: 52, height: 52, fontSize: 13 }}
            >
              Admit Patient
            </TacticalButton>
            {!canSubmit && (
              <Mono tone="muted" size="xs" style={{ textAlign: 'center' }}>
                NAME + CHIEF COMPLAINT REQUIRED
              </Mono>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
