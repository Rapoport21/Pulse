/**
 * MobileAdmitFlow — phone-native admission wizard.
 *
 * A seven-step tactical wizard with a sleek progress bar, animated step
 * transitions, and a sticky Back/Next bar. Runs as a fullscreen overlay
 * (position: fixed, inset: 0, z-index 50) that slides up from the
 * bottom and supports iOS-style edge-swipe-to-close.
 *
 *   1. Demographics  (firstName + lastName required)
 *   2. Clinical      (chief complaint required)
 *   3. Vitals        (optional)
 *   4. Allergies     (optional, repeating)
 *   5. Problems      (optional, repeating)
 *   6. Review        (summary)
 *   7. Bed           (optional bed assignment, Admit button)
 *
 * If no bed is selected on step 7, the patient is admitted with
 * `admitted-unassigned` status and appears on Patients tab immediately.
 * Either way, the Patient record is created on Admit.
 */

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Check,
  UserRound,
  Stethoscope,
  Activity,
  ShieldAlert,
  ClipboardList,
  FileCheck2,
  BedDouble,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION,
  SHADOW,
  MOBILE_NAV_OVERLAY_INSET_BOTTOM,
  Mono,
  BracketLabel,
  TacticalCard,
  TacticalButton,
  CornerBracket,
  Divider,
} from './design';
import type {
  AdmissionEntry,
  AdmissionAllergyInput,
  AdmissionProblemInput,
} from './clinical';
import type { BedUnit, Bed } from '../data/bedMock';
import { useSwipeBack } from '../lib/useSwipeBack';
import { triggerHaptic } from '../lib/haptics';

// ─────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────

export interface MobileAdmitFlowProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string, type?: 'success' | 'info' | 'error') => void;
  /**
   * Called when the user taps Admit. `bedId` is optional — when present,
   * the patient is placed into that bed immediately; when absent, the
   * patient is admitted-unassigned and shows up on Patients tab with
   * no physical bed attached yet.
   */
  onSubmitAdmission?: (
    entry: Omit<AdmissionEntry, 'id' | 'status' | 'waitMin' | 'requestedAt'>,
    bedId?: string,
  ) => void;
  /** Live bed state, used to populate the bed picker on step 7. */
  bedUnits?: BedUnit[];
  /**
   * Bracelet numbers currently unlinked (SCAD demo). When non-empty,
   * step 1 shows a dropdown so the operator can tie this patient to a
   * physical wristband. Leave empty to hide the selector entirely.
   */
  availableBraceletNumbers?: string[];
  /**
   * When the admit flow is opened from a scan of an empty bracelet,
   * the scanner pre-fills the selector with that number so the operator
   * doesn't have to reselect it.
   */
  prefilledBraceletNumber?: string;
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
  /** Two-digit bracelet number (SCAD demo). Empty string = none selected. */
  braceletNumber: string;
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
  allergies: [{ ...BLANK_ALLERGY }],
  problems: [{ ...BLANK_PROBLEM }],
  braceletNumber: '',
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
// Step metadata
// ─────────────────────────────────────────────────────────────────────────

type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

interface StepMeta {
  id: StepId;
  label: string;       // mono caption under the bar
  title: string;       // title rendered above the step body
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
}

const STEPS: StepMeta[] = [
  { id: 1, label: 'DEMO',     title: 'Patient Demographics',  icon: UserRound },
  { id: 2, label: 'CLINICAL', title: 'Clinical Info',         icon: Stethoscope },
  { id: 3, label: 'VITALS',   title: 'Admission Vitals',      icon: Activity },
  { id: 4, label: 'ALLERGY',  title: 'Allergies',             icon: ShieldAlert },
  { id: 5, label: 'PROBLEMS', title: 'Problems / Diagnoses',  icon: ClipboardList },
  { id: 6, label: 'REVIEW',   title: 'Review',                icon: FileCheck2 },
  { id: 7, label: 'BED',      title: 'Bed Assignment',        icon: BedDouble },
];

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
// Focus-aware input primitives (micro-interaction: accent glow on focus)
// ─────────────────────────────────────────────────────────────────────────

interface FieldProps {
  label: string;
  children: React.ReactNode;
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

type TextInputProps = React.InputHTMLAttributes<HTMLInputElement>;

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
        boxShadow: focused ? `0 0 0 1px ${COLORS.accent}40, 0 0 12px ${COLORS.accent}22` : undefined,
        transition: `border-color ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease`,
        ...style,
      }}
    />
  );
};

type SelectInputProps = React.SelectHTMLAttributes<HTMLSelectElement>;

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
        boxShadow: focused ? `0 0 0 1px ${COLORS.accent}40, 0 0 12px ${COLORS.accent}22` : undefined,
        transition: `border-color ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease`,
        ...style,
      }}
    />
  );
};

type TextAreaInputProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

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
        minHeight: 96,
        resize: 'vertical',
        borderColor: focused ? COLORS.accent : COLORS.border,
        boxShadow: focused ? `0 0 0 1px ${COLORS.accent}40, 0 0 12px ${COLORS.accent}22` : undefined,
        transition: `border-color ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease`,
        ...style,
      }}
    />
  );
};

// ─────────────────────────────────────────────────────────────────────────
// PairRow — side-by-side grid for phone widths
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
// ProgressBar — 6-segment tactical indicator
// ─────────────────────────────────────────────────────────────────────────

interface ProgressBarProps {
  currentStep: StepId;
  maxReached: StepId;
  onJump: (step: StepId) => void;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentStep, maxReached, onJump }) => (
  <div
    style={{
      flexShrink: 0,
      paddingTop: SPACE.md,
      paddingBottom: SPACE.md,
      paddingLeft: `max(${SPACE.base}px, env(safe-area-inset-left))`,
      paddingRight: `max(${SPACE.base}px, env(safe-area-inset-right))`,
      background: COLORS.bgDeep,
      borderBottom: `1px solid ${COLORS.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE.sm,
      position: 'relative',
    }}
  >
    {/* Segment bar row */}
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {STEPS.map((step) => {
        const done = step.id < currentStep;
        const active = step.id === currentStep;
        const reachable = step.id <= maxReached;
        return (
          <button
            key={step.id}
            type="button"
            disabled={!reachable}
            onClick={() => reachable && onJump(step.id)}
            aria-label={`Step ${step.id}: ${step.title}`}
            style={{
              flex: 1,
              minWidth: 0,
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: reachable ? 'pointer' : 'default',
              position: 'relative',
            }}
          >
            <motion.div
              layout
              initial={false}
              animate={{
                height: active ? 6 : 3,
                backgroundColor: done
                  ? COLORS.accent
                  : active
                    ? COLORS.accent
                    : COLORS.border,
                boxShadow: active ? `0 0 10px ${COLORS.accentGlow}` : '0 0 0 rgba(0,0,0,0)',
              }}
              transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              style={{
                width: '100%',
                borderRadius: RADIUS.full,
              }}
            />
            {/* Corner brackets on active segment */}
            {active && (
              <motion.div
                layoutId="active-step-brackets"
                style={{
                  position: 'absolute',
                  inset: '-4px -3px',
                  pointerEvents: 'none',
                }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              >
                <CornerBracket position="tl" color={COLORS.accent} size={6} thickness={1} inset={0} />
                <CornerBracket position="tr" color={COLORS.accent} size={6} thickness={1} inset={0} />
                <CornerBracket position="bl" color={COLORS.accent} size={6} thickness={1} inset={0} />
                <CornerBracket position="br" color={COLORS.accent} size={6} thickness={1} inset={0} />
              </motion.div>
            )}
          </button>
        );
      })}
    </div>

    {/* Labels row */}
    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      {STEPS.map((step) => {
        const active = step.id === currentStep;
        const done = step.id < currentStep;
        return (
          <div
            key={`label-${step.id}`}
            style={{
              flex: 1,
              minWidth: 0,
              textAlign: 'center',
              fontFamily: FONTS.mono,
              fontSize: 8,
              letterSpacing: '0.12em',
              fontWeight: 600,
              color: active ? COLORS.accent : done ? COLORS.textSecondary : COLORS.textMuted,
              transition: `color ${MOTION.fast}s ease`,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {step.label}
          </div>
        );
      })}
    </div>

    {/* Scanline under progress — subtle ambient */}
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent 0%, ${COLORS.accent}88 50%, transparent 100%)`,
        opacity: 0.4,
        pointerEvents: 'none',
      }}
    />
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// StepHeader — renders above each step body
// ─────────────────────────────────────────────────────────────────────────

const StepHeader: React.FC<{ step: StepMeta }> = ({ step }) => {
  const Icon = step.icon;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.md,
        paddingBottom: SPACE.sm,
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.accentDim,
          border: `1px solid ${COLORS.accent}`,
          borderRadius: RADIUS.sm,
          color: COLORS.accent,
          flexShrink: 0,
          position: 'relative',
        }}
      >
        <Icon size={18} strokeWidth={1.75} />
        <CornerBracket position="tl" color={COLORS.accent} size={5} thickness={1} />
        <CornerBracket position="tr" color={COLORS.accent} size={5} thickness={1} />
        <CornerBracket position="bl" color={COLORS.accent} size={5} thickness={1} />
        <CornerBracket position="br" color={COLORS.accent} size={5} thickness={1} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
        <Mono tone="muted" size="xs">
          STEP {step.id} / {STEPS.length}
        </Mono>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 18,
            fontWeight: 600,
            letterSpacing: TYPE.h4.tracking,
            color: COLORS.textPrimary,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {step.title}
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// ReviewRow — summary line used inside the Review step
// ─────────────────────────────────────────────────────────────────────────

const ReviewRow: React.FC<{ label: string; value: string; tone?: 'primary' | 'muted' }> = ({
  label,
  value,
  tone = 'primary',
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      gap: SPACE.md,
      padding: `${SPACE.xs}px 0`,
      borderBottom: `1px dashed ${COLORS.border}`,
    }}
  >
    <Mono tone="muted" size="xs" style={{ flexShrink: 0 }}>
      {label}
    </Mono>
    <div
      style={{
        fontFamily: FONTS.sans,
        fontSize: 13,
        fontWeight: 500,
        color: tone === 'muted' ? COLORS.textSecondary : COLORS.textPrimary,
        textAlign: 'right',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: '65%',
      }}
    >
      {value || '—'}
    </div>
  </div>
);

const ReviewCard: React.FC<{
  title: string;
  step: StepId;
  onJump: (step: StepId) => void;
  children: React.ReactNode;
}> = ({ title, step, onJump, children }) => (
  <TacticalCard padding="sm">
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE.sm,
      }}
    >
      <BracketLabel tone="accent" size="sm">
        {title}
      </BracketLabel>
      <button
        type="button"
        onClick={() => onJump(step)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          fontFamily: FONTS.mono,
          fontSize: 10,
          letterSpacing: '0.14em',
          fontWeight: 600,
          color: COLORS.accent,
        }}
      >
        EDIT
      </button>
    </div>
    <Divider style={{ margin: `${SPACE.sm}px 0 ${SPACE.xs}px` }} />
    <div style={{ display: 'flex', flexDirection: 'column' }}>{children}</div>
  </TacticalCard>
);

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const MobileAdmitFlow: React.FC<MobileAdmitFlowProps> = ({
  open,
  onClose,
  showToast,
  onSubmitAdmission,
  bedUnits,
  availableBraceletNumbers = [],
  prefilledBraceletNumber,
}) => {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [currentStep, setCurrentStep] = useState<StepId>(1);
  const [maxReached, setMaxReached] = useState<StepId>(1);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [shake, setShake] = useState(false);
  const [selectedBedId, setSelectedBedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Options shown in the bracelet dropdown: any currently-empty slot plus
  // the pre-filled number (if any) so it stays visible even after the pool
  // updates. Deduped.
  const braceletOptions = useMemo(() => {
    const set = new Set<string>(availableBraceletNumbers);
    if (prefilledBraceletNumber) set.add(prefilledBraceletNumber);
    return Array.from(set).sort();
  }, [availableBraceletNumbers, prefilledBraceletNumber]);

  // iOS-style edge-swipe-to-close
  const swipeBackRef = useSwipeBack<HTMLDivElement>({
    onSwipeBack: () => {
      if (currentStep === 1) onClose();
      else goBack();
    },
    enabled: open,
  });

  // Reset wizard when opened. If a bracelet was pre-filled (e.g. scanner
  // opened the flow with a specific empty bracelet selected), seed it.
  useEffect(() => {
    if (open) {
      setCurrentStep(1);
      setMaxReached(1);
      setDirection(1);
      setShake(false);
      setSelectedBedId(null);
      setForm((prev) => ({
        ...prev,
        braceletNumber: prefilledBraceletNumber ?? prev.braceletNumber ?? '',
      }));
    }
  }, [open, prefilledBraceletNumber]);

  // Compute available (ready) beds grouped by unit — used in step 7
  const availableBedsByUnit = useMemo(() => {
    if (!bedUnits) return [] as Array<{ unit: BedUnit; beds: Bed[] }>;
    return bedUnits
      .filter((u) => !u.surgeOnly)
      .map((u) => ({ unit: u, beds: u.beds.filter((b) => b.state === 'ready') }))
      .filter((x) => x.beds.length > 0);
  }, [bedUnits]);

  const selectedBedDisplay = useMemo(() => {
    if (!selectedBedId || !bedUnits) return null;
    for (const unit of bedUnits) {
      const bed = unit.beds.find((b) => b.id === selectedBedId);
      if (bed) return { bed, unit };
    }
    return null;
  }, [selectedBedId, bedUnits]);

  // Scroll to top on step change so users see the new step header
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [currentStep]);

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

  // ── Validation ─────────────────────────────────────────────────────────
  const firstName = form.firstName.trim();
  const lastName = form.lastName.trim();
  const complaint = form.complaint.trim();

  const stepValid = (step: StepId): boolean => {
    switch (step) {
      case 1:
        return firstName.length > 0 && lastName.length > 0;
      case 2:
        return complaint.length > 0;
      default:
        return true;
    }
  };

  const stepValidationMessage = (step: StepId): string | null => {
    if (step === 1 && !stepValid(1)) return 'FIRST + LAST NAME REQUIRED';
    if (step === 2 && !stepValid(2)) return 'CHIEF COMPLAINT REQUIRED';
    return null;
  };

  const canSubmit = stepValid(1) && stepValid(2);

  // ── Navigation ─────────────────────────────────────────────────────────
  const goNext = () => {
    if (!stepValid(currentStep)) {
      triggerHaptic('heavy');
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
      return;
    }
    if (currentStep >= STEPS.length) return;
    const next = (currentStep + 1) as StepId;
    triggerHaptic('light');
    setDirection(1);
    setCurrentStep(next);
    if (next > maxReached) setMaxReached(next);
  };

  const goBack = () => {
    if (currentStep <= 1) return;
    const prev = (currentStep - 1) as StepId;
    triggerHaptic('light');
    setDirection(-1);
    setCurrentStep(prev);
  };

  const jumpTo = (target: StepId) => {
    if (target === currentStep) return;
    if (target > maxReached) return;
    triggerHaptic('light');
    setDirection(target > currentStep ? 1 : -1);
    setCurrentStep(target);
  };

  // ── Submit ─────────────────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!canSubmit) {
      showToast('Fill in name and chief complaint to admit.', 'error');
      setShake(true);
      window.setTimeout(() => setShake(false), 420);
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
      requestedUnit: selectedBedDisplay?.unit.shortName || 'Med-Surg',
      attending: form.attending || 'Unassigned',
      bedAssignmentStatus: selectedBedId ? 'assigned' : 'admitted-unassigned',
      braceletNumber: form.braceletNumber.trim() || undefined,
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

    onSubmitAdmission?.(entry, selectedBedId || undefined);
    triggerHaptic('heavy');
    if (selectedBedDisplay) {
      showToast(
        `Admitted ${fullName} → ${selectedBedDisplay.bed.label} (${selectedBedDisplay.unit.shortName})`,
        'success',
      );
    } else {
      showToast(`Admitted ${fullName} — bed unassigned`, 'success');
    }
    setForm(INITIAL_FORM);
    setSelectedBedId(null);
    onClose();
  };

  const handleCancel = () => {
    setForm(INITIAL_FORM);
    setSelectedBedId(null);
    onClose();
  };

  const step = STEPS[currentStep - 1];
  const validationMsg = stepValidationMessage(currentStep);
  const isLastStep = currentStep === STEPS.length;

  // ── Derived summaries for Review step ──────────────────────────────────
  const fullNameDisplay = firstName && lastName ? `${firstName} ${lastName}` : '—';
  const vitalSummary = [
    form.hr && `HR ${form.hr}`,
    form.sbp && form.dbp && `BP ${form.sbp}/${form.dbp}`,
    form.rr && `RR ${form.rr}`,
    form.spo2 && `SpO₂ ${form.spo2}%`,
    form.temp && `T ${form.temp}°C`,
  ]
    .filter(Boolean)
    .join(' · ');
  const allergyCount = form.allergies.filter((a) => a.substance.trim()).length;
  const problemCount = form.problems.filter((p) => p.display.trim()).length;

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
            top: 0,
            left: 0,
            right: 0,
            // Stop above MobileView's bottom HUD nav so app tabs stay visible.
            bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM,
            zIndex: 50,
            background: COLORS.bg,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONTS.sans,
            color: COLORS.textPrimary,
            overflow: 'hidden',
            borderTop: `1px solid ${COLORS.borderStrong}`,
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
              New Admission
            </div>

            <div style={{ minWidth: 44, flexShrink: 0 }} aria-hidden />
          </div>

          {/* ── PROGRESS BAR ───────────────────────────────────────── */}
          <ProgressBar
            currentStep={currentStep}
            maxReached={maxReached}
            onJump={jumpTo}
          />

          {/* ── SCROLLABLE STEP BODY ───────────────────────────────── */}
          <div
            ref={scrollRef}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              position: 'relative',
            }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={`step-${currentStep}`}
                initial={{ opacity: 0, x: direction * 30 }}
                animate={{
                  opacity: 1,
                  x: shake ? [0, -8, 8, -6, 6, -3, 3, 0] : 0,
                }}
                exit={{ opacity: 0, x: direction * -30 }}
                transition={{
                  duration: shake ? 0.4 : MOTION.base,
                  ease: MOTION.ease,
                }}
                style={{
                  padding: SPACE.base,
                  paddingBottom: SPACE.lg,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: SPACE.md,
                }}
              >
                <StepHeader step={step} />

                {/* ── STEP 1 · DEMOGRAPHICS ────────────────────────── */}
                {currentStep === 1 && (
                  <TacticalCard padding="sm">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                      {/* SCAD demo — bracelet selector. Hidden when there
                          are no options (pool not provided or exhausted). */}
                      {braceletOptions.length > 0 && (
                        <Field label="BRACELET NUMBER">
                          <SelectInput
                            value={form.braceletNumber}
                            onChange={(e) => set('braceletNumber', e.target.value)}
                            style={{ fontFamily: FONTS.mono, letterSpacing: '0.08em' }}
                          >
                            <option value="">— NONE —</option>
                            {braceletOptions.map((n) => (
                              <option key={n} value={n}>
                                #{n}
                              </option>
                            ))}
                          </SelectInput>
                        </Field>
                      )}

                      <PairRow>
                        <Field label="FIRST NAME *">
                          <TextInput
                            value={form.firstName}
                            onChange={(e) => set('firstName', e.target.value)}
                            placeholder="Jane"
                            autoComplete="given-name"
                          />
                        </Field>
                        <Field label="LAST NAME *">
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

                      <Field label="EMERGENCY CONTACT">
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
                    </div>
                  </TacticalCard>
                )}

                {/* ── STEP 2 · CLINICAL ────────────────────────────── */}
                {currentStep === 2 && (
                  <TacticalCard padding="sm">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                      <Field label="CHIEF COMPLAINT *">
                        <TextAreaInput
                          value={form.complaint}
                          onChange={(e) => set('complaint', e.target.value)}
                          placeholder="e.g. chest pain radiating to jaw"
                          autoFocus
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
                    </div>
                  </TacticalCard>
                )}

                {/* ── STEP 3 · VITALS ──────────────────────────────── */}
                {currentStep === 3 && (
                  <TacticalCard padding="sm">
                    <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.sm, display: 'block' }}>
                      ALL FIELDS OPTIONAL · LEAVE BLANK IF NOT ASSESSED
                    </Mono>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
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
                    </div>
                  </TacticalCard>
                )}

                {/* ── STEP 4 · ALLERGIES ───────────────────────────── */}
                {currentStep === 4 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                    <Mono tone="muted" size="xs">
                      LEAVE SUBSTANCE BLANK FOR NKA. ADD MORE AS NEEDED.
                    </Mono>

                    <AnimatePresence initial={false}>
                      {form.allergies.map((allergy, idx) => (
                        <motion.div
                          key={`allergy-${idx}`}
                          layout
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96, height: 0 }}
                          transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: SPACE.sm,
                            padding: SPACE.sm,
                            background: COLORS.surface,
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
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    <TacticalButton
                      variant="secondary"
                      fullWidth
                      icon={<Plus size={14} />}
                      onClick={addAllergy}
                      style={{ minHeight: 44, height: 44 }}
                    >
                      Add Allergy
                    </TacticalButton>
                  </div>
                )}

                {/* ── STEP 5 · PROBLEMS ────────────────────────────── */}
                {currentStep === 5 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                    <Mono tone="muted" size="xs">
                      LEAVE BLANK IF NONE KNOWN. ADD MORE AS NEEDED.
                    </Mono>

                    <AnimatePresence initial={false}>
                      {form.problems.map((problem, idx) => (
                        <motion.div
                          key={`problem-${idx}`}
                          layout
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.96, height: 0 }}
                          transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: SPACE.sm,
                            padding: SPACE.sm,
                            background: COLORS.surface,
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
                        </motion.div>
                      ))}
                    </AnimatePresence>

                    <TacticalButton
                      variant="secondary"
                      fullWidth
                      icon={<Plus size={14} />}
                      onClick={addProblem}
                      style={{ minHeight: 44, height: 44 }}
                    >
                      Add Problem
                    </TacticalButton>
                  </div>
                )}

                {/* ── STEP 6 · REVIEW ──────────────────────────────── */}
                {currentStep === 6 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                    {!canSubmit && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                        style={{
                          padding: SPACE.sm,
                          background: COLORS.critDim,
                          border: `1px solid ${COLORS.crit}`,
                          borderRadius: RADIUS.sm,
                        }}
                      >
                        <Mono tone="primary" size="xs" style={{ color: COLORS.crit }}>
                          MISSING REQUIRED FIELDS — TAP "EDIT" ON A CARD BELOW.
                        </Mono>
                      </motion.div>
                    )}

                    <ReviewCard title="PATIENT" step={1} onJump={jumpTo}>
                      <ReviewRow label="NAME" value={fullNameDisplay} />
                      <ReviewRow label="MRN" value={form.mrn || '—'} />
                      <ReviewRow label="DOB" value={form.dob || '—'} />
                      <ReviewRow label="SEX" value={form.sex || '—'} />
                      <ReviewRow label="WEIGHT" value={form.weightKg ? `${form.weightKg} kg` : '—'} />
                      <ReviewRow label="HEIGHT" value={form.heightCm ? `${form.heightCm} cm` : '—'} />
                      <ReviewRow label="LANGUAGE" value={form.preferredLanguage} />
                      {form.needsInterpreter && (
                        <ReviewRow label="INTERPRETER" value="REQUIRED" />
                      )}
                    </ReviewCard>

                    <ReviewCard title="CLINICAL" step={2} onJump={jumpTo}>
                      <ReviewRow label="COMPLAINT" value={complaint || '—'} />
                      <ReviewRow label="ATTENDING" value={form.attending || 'Unassigned'} />
                      <ReviewRow label="ESI" value={`ESI ${form.esi}`} />
                      <ReviewRow label="ARRIVAL" value={form.arrivalMode.toUpperCase()} />
                      <ReviewRow label="ISOLATION" value={form.isolation} />
                      <ReviewRow label="CODE" value={form.codeStatus} />
                    </ReviewCard>

                    <ReviewCard title="VITALS" step={3} onJump={jumpTo}>
                      <ReviewRow
                        label="ADMISSION"
                        value={vitalSummary || 'Not assessed'}
                        tone={vitalSummary ? 'primary' : 'muted'}
                      />
                      <ReviewRow label="PAIN" value={form.pain ? `${form.pain}/10` : '—'} />
                      <ReviewRow label="GCS" value={form.gcs || '—'} />
                    </ReviewCard>

                    <ReviewCard title="ALLERGIES" step={4} onJump={jumpTo}>
                      <ReviewRow
                        label="COUNT"
                        value={allergyCount === 0 ? 'NKA' : `${allergyCount} recorded`}
                      />
                      {form.allergies
                        .filter((a) => a.substance.trim())
                        .slice(0, 3)
                        .map((a, i) => (
                          <ReviewRow
                            key={`rev-alg-${i}`}
                            label={`· ${a.severity.toUpperCase()}`}
                            value={a.substance}
                          />
                        ))}
                    </ReviewCard>

                    <ReviewCard title="PROBLEMS" step={5} onJump={jumpTo}>
                      <ReviewRow
                        label="COUNT"
                        value={problemCount === 0 ? 'None' : `${problemCount} recorded`}
                      />
                      {form.problems
                        .filter((p) => p.display.trim())
                        .slice(0, 3)
                        .map((p, i) => (
                          <ReviewRow
                            key={`rev-prb-${i}`}
                            label={`· ${p.status.toUpperCase()}`}
                            value={p.display}
                          />
                        ))}
                    </ReviewCard>

                    <div
                      style={{
                        padding: SPACE.md,
                        background: COLORS.surface,
                        border: `1px dashed ${COLORS.borderStrong}`,
                        borderRadius: RADIUS.sm,
                        textAlign: 'center',
                      }}
                    >
                      <Mono tone="muted" size="xs" style={{ display: 'block' }}>
                        NEXT · BED ASSIGNMENT
                      </Mono>
                      <div
                        style={{
                          marginTop: 4,
                          fontFamily: FONTS.sans,
                          fontSize: 11,
                          color: COLORS.textSecondary,
                        }}
                      >
                        Pick a bed now or skip to admit into holding.
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 7 · BED ASSIGNMENT ──────────────────────── */}
                {currentStep === 7 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                    {/* Selection status card */}
                    <motion.div
                      layout
                      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                      style={{
                        padding: SPACE.md,
                        background: selectedBedDisplay ? COLORS.accentDim : COLORS.surface,
                        border: `1px solid ${selectedBedDisplay ? COLORS.accent : COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        position: 'relative',
                      }}
                    >
                      {selectedBedDisplay && (
                        <>
                          <CornerBracket position="tl" color={COLORS.accent} size={8} />
                          <CornerBracket position="tr" color={COLORS.accent} size={8} />
                          <CornerBracket position="bl" color={COLORS.accent} size={8} />
                          <CornerBracket position="br" color={COLORS.accent} size={8} />
                        </>
                      )}
                      <Mono
                        tone="muted"
                        size="xs"
                        style={{
                          display: 'block',
                          color: selectedBedDisplay ? COLORS.accent : COLORS.textMuted,
                        }}
                      >
                        {selectedBedDisplay ? 'BED SELECTED' : 'NO BED SELECTED'}
                      </Mono>
                      <div
                        style={{
                          marginTop: 4,
                          fontFamily: FONTS.sans,
                          fontSize: 14,
                          fontWeight: 600,
                          color: COLORS.textPrimary,
                        }}
                      >
                        {selectedBedDisplay
                          ? `${selectedBedDisplay.bed.label} · ${selectedBedDisplay.unit.shortName}`
                          : 'Patient will be admitted unassigned'}
                      </div>
                      <div
                        style={{
                          marginTop: 2,
                          fontFamily: FONTS.sans,
                          fontSize: 11,
                          color: COLORS.textSecondary,
                        }}
                      >
                        {selectedBedDisplay
                          ? 'Tap bed again to deselect · Skip & admit unassigned is still available below.'
                          : 'You can assign a bed later from the Admissions tab.'}
                      </div>
                    </motion.div>

                    {availableBedsByUnit.length === 0 ? (
                      <TacticalCard padding="md">
                        <Mono tone="muted" size="xs" style={{ display: 'block', textAlign: 'center' }}>
                          NO READY BEDS AVAILABLE
                        </Mono>
                        <div
                          style={{
                            marginTop: 4,
                            fontFamily: FONTS.sans,
                            fontSize: 11,
                            color: COLORS.textSecondary,
                            textAlign: 'center',
                          }}
                        >
                          Admit unassigned — assign later from Admissions tab.
                        </div>
                      </TacticalCard>
                    ) : (
                      availableBedsByUnit.map(({ unit, beds }) => (
                        <TacticalCard key={unit.id} padding="sm">
                          <BracketLabel tone="accent" size="sm">
                            {unit.shortName} · {beds.length} READY
                          </BracketLabel>
                          <Divider style={{ margin: `${SPACE.sm}px 0` }} />
                          <div
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
                              gap: SPACE.sm,
                            }}
                          >
                            {beds.map((bed) => {
                              const picked = selectedBedId === bed.id;
                              return (
                                <motion.button
                                  key={bed.id}
                                  type="button"
                                  whileTap={{ scale: 0.96 }}
                                  onClick={() => {
                                    triggerHaptic('light');
                                    setSelectedBedId((prev) => (prev === bed.id ? null : bed.id));
                                  }}
                                  style={{
                                    position: 'relative',
                                    minHeight: 56,
                                    padding: `${SPACE.sm}px ${SPACE.xs}px`,
                                    background: picked ? COLORS.accentDim : COLORS.surface,
                                    border: `1px solid ${picked ? COLORS.accent : COLORS.border}`,
                                    borderRadius: RADIUS.sm,
                                    color: picked ? COLORS.accent : COLORS.textPrimary,
                                    fontFamily: FONTS.mono,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    letterSpacing: '0.08em',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 2,
                                    transition: `background ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
                                  }}
                                >
                                  {picked && (
                                    <>
                                      <CornerBracket position="tl" color={COLORS.accent} size={5} />
                                      <CornerBracket position="tr" color={COLORS.accent} size={5} />
                                      <CornerBracket position="bl" color={COLORS.accent} size={5} />
                                      <CornerBracket position="br" color={COLORS.accent} size={5} />
                                    </>
                                  )}
                                  {bed.label}
                                  <span
                                    style={{
                                      fontFamily: FONTS.mono,
                                      fontSize: 9,
                                      letterSpacing: '0.14em',
                                      color: picked ? COLORS.accent : COLORS.textMuted,
                                      fontWeight: 500,
                                    }}
                                  >
                                    READY
                                  </span>
                                </motion.button>
                              );
                            })}
                          </div>
                        </TacticalCard>
                      ))
                    )}

                    {selectedBedId && (
                      <TacticalButton
                        variant="ghost"
                        fullWidth
                        onClick={() => {
                          triggerHaptic('light');
                          setSelectedBedId(null);
                        }}
                        style={{ minHeight: 44, height: 44 }}
                      >
                        Clear selection
                      </TacticalButton>
                    )}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── BOTTOM NAV BAR ─────────────────────────────────────── */}
          <div
            style={{
              flexShrink: 0,
              paddingTop: SPACE.sm,
              paddingBottom: `calc(${SPACE.sm}px + env(safe-area-inset-bottom))`,
              paddingLeft: `max(${SPACE.base}px, env(safe-area-inset-left))`,
              paddingRight: `max(${SPACE.base}px, env(safe-area-inset-right))`,
              background: COLORS.surface,
              borderTop: `1px solid ${COLORS.border}`,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.xs,
              zIndex: 3,
            }}
          >
            <div style={{ display: 'flex', gap: SPACE.sm }}>
              {/* BACK button */}
              <motion.button
                type="button"
                onClick={goBack}
                disabled={currentStep === 1}
                whileTap={{ scale: currentStep === 1 ? 1 : 0.97 }}
                style={{
                  flex: '0 0 auto',
                  minWidth: 88,
                  minHeight: 52,
                  padding: `0 ${SPACE.base}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  background: 'transparent',
                  border: `1px solid ${currentStep === 1 ? COLORS.textDim : COLORS.borderStrong}`,
                  borderRadius: RADIUS.sm,
                  color: currentStep === 1 ? COLORS.textDim : COLORS.textPrimary,
                  fontFamily: FONTS.mono,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: currentStep === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentStep === 1 ? 0.4 : 1,
                  transition: `opacity ${MOTION.fast}s ease, border-color ${MOTION.fast}s ease`,
                }}
              >
                <ChevronLeft size={14} />
                Back
              </motion.button>

              {/* NEXT / ADMIT button */}
              <motion.button
                type="button"
                onClick={isLastStep ? handleSubmit : goNext}
                disabled={isLastStep ? !canSubmit : false}
                whileTap={{ scale: 0.98 }}
                style={{
                  flex: 1,
                  minHeight: 52,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: SPACE.sm,
                  background: isLastStep
                    ? canSubmit
                      ? `linear-gradient(180deg, ${COLORS.accent} 0%, ${COLORS.accentDeep} 100%)`
                      : COLORS.surfaceElev
                    : COLORS.accent,
                  border: `1px solid ${isLastStep && !canSubmit ? COLORS.border : COLORS.accent}`,
                  borderRadius: RADIUS.sm,
                  color: isLastStep && !canSubmit ? COLORS.textMuted : COLORS.textPrimary,
                  fontFamily: FONTS.mono,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  cursor: isLastStep && !canSubmit ? 'not-allowed' : 'pointer',
                  boxShadow:
                    isLastStep && canSubmit
                      ? SHADOW.accentGlowSm
                      : !isLastStep
                        ? `0 0 8px ${COLORS.accent}44`
                        : undefined,
                  transition: `box-shadow ${MOTION.fast}s ease`,
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {isLastStep ? (
                  <>
                    <Check size={16} />
                    {selectedBedId ? 'Admit to Bed' : 'Admit Unassigned'}
                  </>
                ) : (
                  <>
                    Next · {STEPS[currentStep].label}
                    <ChevronRight size={14} />
                  </>
                )}
              </motion.button>
            </div>

            {validationMsg && (
              <motion.div
                initial={{ opacity: 0, y: -2 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: MOTION.fast }}
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 10,
                  letterSpacing: '0.14em',
                  fontWeight: 600,
                  color: COLORS.warn,
                  textAlign: 'center',
                }}
              >
                {validationMsg}
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
