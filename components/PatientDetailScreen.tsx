import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronLeft,
  Activity,
  Pill,
  FileText,
  Scale,
  AlertTriangle,
  Syringe,
  Plus,
  CheckCircle2,
  CreditCard,
  Clock,
  ScanLine,
  ListTodo,
  Droplets,
  Loader2,
  Save,
  FlaskConical,
  StickyNote,
  ImageIcon,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  UserCheck,
  ArrowRightLeft,
  Timer,
} from 'lucide-react';
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
  TacticalButton,
  CornerBracket,
  HudStrip,
  DotGridBg,
  Divider,
} from './design';
import { PatientHeaderStrip, VitalsPanel, NoteComposer, OrderEntry, HandoffComposer } from './clinical';
import type { Patient } from '../types';
import { MOCK_LABS, MOCK_NOTES, MOCK_MEDS, MOCK_IMAGING, type ImagingOrder } from '../data/ehrMock';
import { ConfidenceBadge } from './design';

/**
 * Minimal legacy shape that the MobileView list used to pass in —
 * `name`, `age`, `mrn`, `code`, `notes`, `vitals` etc. The new FHIR-
 * aligned clinical data lives under `clinical` when the caller has
 * upgraded to MOCK_PATIENTS. Both shapes are accepted so the wedge
 * can ship without MobileView refactoring in the same commit.
 */
interface LegacyPatientShape {
  id?: string;
  name?: string;
  age?: string;
  mrn?: string;
  code?: string;
  notes?: string;
  loc?: string;
  status?: string;
  vitals?: { hr?: string; bp?: string; o2?: string };
  clinical?: Patient;
}

type PatientLike = LegacyPatientShape | Patient;

interface PatientDetailScreenProps {
  patient: PatientLike;
  onClose: () => void;
  onSave: () => void;
  showToast: (message: string, type?: 'success' | 'info' | 'error') => void;
  embedded?: boolean;
  /** Synced clinical notes — shown in notes section */
  clinicalNotes?: import('../types').ClinicalNote[];
  /** Cross-device vitals update — pushes new vitals to all devices */
  onUpdateVitals?: (patientId: string, vitals: Omit<import('../types').Vital, 'id' | 'timestamp'>) => void;
  /** Cross-device note creation — syncs note to all devices */
  onAddNote?: (note: Omit<import('../types').ClinicalNote, 'id' | 'createdAt'>) => void;
  /** Cross-device discharge — frees bed and updates status everywhere */
  onDischargePatient?: (patientId: string) => void;
}

/** Return the FHIR Patient when the caller provided one, else undefined. */
const extractClinicalPatient = (p: PatientLike | undefined | null): Patient | undefined => {
  if (!p) return undefined;
  // Duck-type on `vitalsHistory` + `codeStatus` — the two fields a
  // legacy object never has.
  if ('vitalsHistory' in p && 'codeStatus' in p && Array.isArray((p as Patient).vitalsHistory)) {
    return p as Patient;
  }
  if ('clinical' in p && p.clinical) return p.clinical;
  return undefined;
};

// ─────────────────────────────────────────────────────────────────────────
// Section — a TacticalCard with a bracketed header row
// ─────────────────────────────────────────────────────────────────────────
const Section: React.FC<{
  id: string;
  title: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; color?: string }>;
  action?: React.ReactNode;
  children: React.ReactNode;
}> = ({ id, title, icon: Icon, action, children }) => (
  <TacticalCard padding="none" style={{ marginBottom: SPACE.md }}>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: SPACE.sm,
        padding: `${SPACE.base}px ${SPACE.md}px`,
        borderBottom: `1px solid ${COLORS.border}`,
        background: COLORS.surfaceElev,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
        <div
          style={{
            position: 'relative',
            width: 26,
            height: 26,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: COLORS.surface,
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: RADIUS.sm,
            color: COLORS.textSecondary,
            flexShrink: 0,
          }}
        >
          <Icon size={12} strokeWidth={2} />
        </div>
        <div style={{ minWidth: 0 }}>
          <Mono tone="muted" size="xs">
            {id}
          </Mono>
          <div
            style={{
              fontFamily: FONTS.sans,
              fontSize: 14,
              fontWeight: 600,
              color: COLORS.textPrimary,
              letterSpacing: '-0.003em',
              lineHeight: 1.2,
            }}
          >
            {title}
          </div>
        </div>
      </div>
      {action}
    </div>
    <div style={{ padding: SPACE.md }}>{children}</div>
  </TacticalCard>
);

// ─────────────────────────────────────────────────────────────────────────
// Field — tactical labeled input with optional unit
// ─────────────────────────────────────────────────────────────────────────
const Field: React.FC<{
  label: string;
  defaultValue?: string;
  type?: string;
  unit?: string;
  placeholder?: string;
}> = ({ label, defaultValue, type = 'text', unit, placeholder }) => {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <BracketLabel tone="muted" size="xs">
        {label}
      </BracketLabel>
      <div style={{ position: 'relative', marginTop: 4 }}>
        <input
          type={type}
          defaultValue={defaultValue}
          placeholder={placeholder}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
            paddingRight: unit ? 44 : SPACE.md,
            background: COLORS.bgDeep,
            border: `1px solid ${focused ? COLORS.accent : COLORS.border}`,
            borderRadius: RADIUS.sm,
            color: COLORS.textPrimary,
            fontFamily: FONTS.sans,
            fontSize: 14,
            fontWeight: 500,
            outline: 'none',
            transition: `all ${MOTION.fast}s ease`,
            boxShadow: focused ? `0 0 0 3px ${COLORS.accentGlow}` : 'none',
          }}
        />
        {unit && (
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
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// StatBox — a framed label/value readout used in the patient banner
// ─────────────────────────────────────────────────────────────────────────
const StatBox: React.FC<{
  label: string;
  value: string;
  tone?: 'default' | 'crit' | 'warn' | 'info';
}> = ({ label, value, tone = 'default' }) => {
  const color =
    tone === 'crit'
      ? COLORS.crit
      : tone === 'warn'
        ? COLORS.warn
        : tone === 'info'
          ? COLORS.info
          : COLORS.textPrimary;
  const borderColor =
    tone === 'crit'
      ? COLORS.crit
      : tone === 'warn'
        ? COLORS.warn
        : tone === 'info'
          ? COLORS.info
          : COLORS.border;
  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `${SPACE.base}px ${SPACE.sm}px`,
        background: tone === 'default' ? COLORS.surface : 'rgba(225,29,72,0.04)',
        border: `1px solid ${borderColor}`,
        borderRadius: RADIUS.sm,
      }}
    >
      <CornerBracket position="tl" color={borderColor} size={4} thickness={1} inset={-1} />
      <CornerBracket position="br" color={borderColor} size={4} thickness={1} inset={-1} />
      <Mono tone="muted" size="xs">
        {label}
      </Mono>
      <div
        style={{
          fontFamily: FONTS.sans,
          fontSize: 18,
          fontWeight: 700,
          color,
          letterSpacing: '-0.01em',
          marginTop: 2,
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
    </div>
  );
};

/**
 * PatientDetailScreen — tactical patient chart detail. Full-screen slide-in
 * with HUD strip, patient banner (age/code/acuity), and a sequence of
 * Section cards for Intake, I&O, Clinical Profile, Medications, Nursing
 * Orders, and Admin & Insurance.
 */
export const PatientDetailScreen: React.FC<PatientDetailScreenProps> = ({
  patient,
  onClose,
  onSave,
  showToast,
  embedded,
  clinicalNotes,
  onUpdateVitals,
  onAddNote,
  onDischargePatient,
}) => {
  const [painScore, setPainScore] = useState(4);
  const [isSaving, setIsSaving] = useState(false);
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [showOrderEntry, setShowOrderEntry] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [isGuarantorSame, setIsGuarantorSame] = useState(true);
  const [chiefComplaintFocused, setChiefComplaintFocused] = useState(false);
  const [orders, setOrders] = useState([
    {
      id: 'o1',
      task: 'Turn patient q2h',
      time: '15:00',
      status: 'pending',
      type: 'routine',
    },
    {
      id: 'o2',
      task: 'Neuro check q1h',
      time: '15:30',
      status: 'pending',
      type: 'stat',
    },
    {
      id: 'o3',
      task: 'Draw CBC & BMP',
      time: '14:00',
      status: 'completed',
      type: 'routine',
    },
  ]);

  const handleSave = () => {
    setIsSaving(true);
    // Push vitals cross-device if the patient has clinical data
    const clinicalPt = extractClinicalPatient(patient);
    if (onUpdateVitals && clinicalPt) {
      const latest = clinicalPt.vitalsHistory[clinicalPt.vitalsHistory.length - 1];
      if (latest) {
        onUpdateVitals(clinicalPt.id, {
          heartRate: latest.heartRate,
          systolic: latest.systolic,
          diastolic: latest.diastolic,
          respRate: latest.respRate,
          spO2: latest.spO2,
          temperature: latest.temperature,
          painScore: painScore,
          gcs: latest.gcs,
        });
      }
    }
    setTimeout(() => {
      setIsSaving(false);
      onSave();
      onClose();
    }, 800);
  };

  // When the caller has upgraded to FHIR-aligned data, `clinical` is a
  // real `Patient`. Otherwise we fall back to the legacy strings so the
  // existing MobileView wiring keeps working during the migration.
  const clinical: Patient | undefined = extractClinicalPatient(patient);
  const legacyCode = (patient as LegacyPatientShape)?.code ?? '';
  const isDnr = clinical
    ? clinical.codeStatus === 'DNR' ||
      clinical.codeStatus === 'DNI' ||
      clinical.codeStatus === 'DNR/DNI'
    : String(legacyCode).includes('DNR');
  const displayName =
    clinical != null
      ? `${clinical.name.family}, ${clinical.name.given}`
      : ((patient as LegacyPatientShape)?.name ?? 'Unknown');
  const displayMrn = clinical?.mrn ?? (patient as LegacyPatientShape)?.mrn ?? 'MRN —';

  // ── Embedded mode ───────────────────────────────────────────────────
  // When embedded=true, render as inline content that fills the parent
  // container instead of a full-screen fixed overlay. No slide-in
  // animation, no safe-area padding, no close/back button — just the
  // patient name breadcrumb in the HUD header.
  if (embedded) {
    return (
      <div
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
          background: COLORS.bg,
          color: COLORS.textPrimary,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: FONTS.sans,
        }}
      >
        <DotGridBg />

        {/* Top HUD strip — patient name breadcrumb + save (no back button) */}
        <HudStrip side="top" fixed={false} height={52}>
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
                flex: 1,
              }}
            >
              <BracketLabel tone="secondary" size="xs">
                PATIENT · DETAIL
              </BracketLabel>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: SPACE.sm,
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 14,
                    fontWeight: 700,
                    color: COLORS.textPrimary,
                    letterSpacing: '-0.003em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {displayName}
                </span>
                <Mono tone="muted" size="xs">
                  {displayMrn}
                </Mono>
              </div>
            </div>
          </div>

          <TacticalButton
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            icon={
              isSaving ? (
                <Loader2
                  size={13}
                  strokeWidth={2}
                  style={{ animation: 'spin 1.2s linear infinite' }}
                />
              ) : (
                <Save size={13} strokeWidth={2} />
              )
            }
          >
            {isSaving ? 'Saving…' : 'Save'}
          </TacticalButton>
        </HudStrip>

        {/* Scrollable main content */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: `${SPACE.lg}px ${SPACE.xl}px ${SPACE['3xl']}px`,
            position: 'relative',
            zIndex: 10,
          }}
        >
          <div style={{ width: '100%' }}>
            {clinical ? (
              <>
                <PatientHeaderStrip patient={clinical} />
                <VitalsPanel patient={clinical} />
              </>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: SPACE.sm,
                  marginBottom: SPACE.lg,
                }}
              >
                <StatBox label="Age / Sex" value={(patient as LegacyPatientShape)?.age ?? '—'} />
                <StatBox
                  label="Code Status"
                  value={(patient as LegacyPatientShape)?.code ?? '—'}
                  tone={isDnr ? 'info' : 'default'}
                />
                <StatBox label="Acuity" value="ESI 2" tone="crit" />
              </div>
            )}

            {/* Two-column grid: Timeline + Care Team */}
            {clinical && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: SPACE.lg, alignItems: 'start' }}>
            <Section id="PT.TIMELINE" title="Encounter Timeline" icon={Timer}>
                <div style={{ position: 'relative', paddingLeft: 20 }}>
                  <div
                    aria-hidden
                    style={{
                      position: 'absolute',
                      left: 6,
                      top: 4,
                      bottom: 4,
                      width: 1,
                      background: `linear-gradient(180deg, ${COLORS.ok} 0%, ${COLORS.info} 50%, ${COLORS.border} 100%)`,
                    }}
                  />
                  {[
                    { time: '12:15', label: 'Arrival', detail: `Ambulatory walk-in · ${clinical.currentEncounter?.chiefComplaint ?? 'Chest pain'}`, tone: COLORS.ok, done: true },
                    { time: '12:22', label: 'Triage (ESI ' + (clinical.currentEncounter?.esiLevel ?? 2) + ')', detail: 'Vitals recorded · MEWS calculated · Allergies verified', tone: COLORS.ok, done: true },
                    { time: '12:35', label: 'Assessment', detail: clinical.currentEncounter?.attendingId ? `Attending: ${clinical.currentEncounter.attendingId}` : 'Attending: Dr. Reeves', tone: COLORS.ok, done: true },
                    { time: '13:00', label: 'Labs Drawn', detail: 'CBC, BMP, Troponin, BNP · Results pending', tone: COLORS.info, done: true },
                    { time: '13:15', label: 'Imaging', detail: 'CT Head ordered · In progress', tone: COLORS.warn, done: false },
                    { time: '—', label: 'Disposition', detail: 'Pending attending review', tone: COLORS.textMuted, done: false },
                  ].map((step, i) => (
                    <div key={i} style={{ display: 'flex', gap: SPACE.md, marginBottom: i < 5 ? SPACE.md : 0, position: 'relative' }}>
                      <div style={{
                        position: 'absolute',
                        left: -20,
                        top: 2,
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: step.done ? step.tone : COLORS.surface,
                        border: `2px solid ${step.tone}`,
                        boxShadow: step.done ? `0 0 6px ${step.tone}40` : 'none',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: 2 }}>
                          <Mono tone="dim" size="xs">{step.time}</Mono>
                          <span style={{
                            fontFamily: FONTS.sans,
                            fontSize: 13,
                            fontWeight: step.done ? 600 : 500,
                            color: step.done ? COLORS.textPrimary : COLORS.textMuted,
                          }}>
                            {step.label}
                          </span>
                          {!step.done && <StatusPill label="PENDING" tone="warn" size="xs" />}
                        </div>
                        <span style={{
                          fontFamily: FONTS.sans,
                          fontSize: 11,
                          color: COLORS.textSecondary,
                          lineHeight: 1.4,
                        }}>
                          {step.detail}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </Section>

              <Section
                id="PT.TEAM"
                title="Care Team"
                icon={UserCheck}
                action={
                  <TacticalButton variant="ghost" size="sm" icon={<ArrowRightLeft size={12} />} onClick={() => setShowHandoff(true)}>
                    Handoff
                  </TacticalButton>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
                  {[
                    { role: 'ATTENDING', name: clinical.currentEncounter?.attendingId ?? 'Dr. R. Reeves', dept: 'Emergency Medicine', active: true },
                    { role: 'PRIMARY RN', name: clinical.currentEncounter?.nurseId ?? 'RN J. Kim', dept: 'ED Acute', active: true },
                    { role: 'CHARGE', name: 'RN S. Lee', dept: 'ED', active: true },
                    { role: 'PHARM', name: 'Dr. T. Pham', dept: 'Clinical Pharmacy', active: false },
                    { role: 'CONSULT', name: 'Dr. M. Chen', dept: 'Cardiology', active: false },
                  ].map((member) => (
                    <div
                      key={member.role}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: SPACE.sm,
                        padding: `${SPACE.sm}px ${SPACE.md}px`,
                        background: COLORS.bgDeep,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                        <div style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: member.active ? COLORS.ok : COLORS.textMuted,
                          boxShadow: member.active ? `0 0 4px ${COLORS.ok}` : 'none',
                          flexShrink: 0,
                        }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontFamily: FONTS.sans,
                            fontSize: 13,
                            fontWeight: 500,
                            color: COLORS.textPrimary,
                            lineHeight: 1.25,
                          }}>
                            {member.name}
                          </div>
                          <Mono tone="muted" size="xs">{member.dept}</Mono>
                        </div>
                      </div>
                      <StatusPill label={member.role} tone={member.active ? 'ok' : 'neutral'} size="xs" />
                    </div>
                  ))}
                </div>
              </Section>
            </div>
            )}

            {/* Intake & Measurements */}
            <Section id="PT.INTAKE" title="Intake & Measurements" icon={Scale}>
              <div
                style={{
                  display: 'flex',
                  gap: SPACE.sm,
                  marginBottom: SPACE.md,
                  flexWrap: 'wrap',
                }}
              >
                <Field
                  label="Height"
                  defaultValue={
                    clinical?.heightCm != null ? String(clinical.heightCm) : '178'
                  }
                  unit="cm"
                  type="number"
                />
                <Field
                  label="Weight"
                  defaultValue={
                    clinical?.weightKg != null ? String(clinical.weightKg) : '82.5'
                  }
                  unit="kg"
                  type="number"
                />
                <div style={{ flex: 1, minWidth: 120 }}>
                  <BracketLabel tone="muted" size="xs">
                    BMI
                  </BracketLabel>
                  <div
                    style={{
                      marginTop: 4,
                      padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                      background: COLORS.bgDeep,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: SPACE.sm,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 14,
                        fontWeight: 700,
                        color: COLORS.warn,
                      }}
                    >
                      26.0
                    </span>
                    <StatusPill label="Overweight" tone="warn" />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: SPACE.md }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.xs,
                    marginBottom: 6,
                  }}
                >
                  <Activity size={11} strokeWidth={2} color={COLORS.textMuted} />
                  <BracketLabel tone="muted" size="xs">
                    PAIN SCALE · 0–10
                  </BracketLabel>
                </div>
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
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      marginBottom: SPACE.sm,
                    }}
                  >
                    <Mono tone="ok" size="xs">
                      0
                    </Mono>
                    <div
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 32,
                        fontWeight: 700,
                        color: COLORS.textPrimary,
                        fontVariantNumeric: 'tabular-nums',
                        lineHeight: 1,
                      }}
                    >
                      {painScore}
                    </div>
                    <Mono tone="crit" size="xs">
                      10
                    </Mono>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    value={painScore}
                    onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
                    style={{
                      width: '100%',
                      accentColor: COLORS.accent,
                      cursor: 'pointer',
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: SPACE.sm,
                }}
              >
                <Field label="Temp" defaultValue="37.2" unit="°C" type="number" />
                <Field label="Resp Rate" defaultValue="18" unit="bpm" type="number" />
              </div>
            </Section>

            {/* I&O */}
            <Section id="PT.IO" title="I&O · Intake / Output" icon={Droplets}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: SPACE.sm,
                  marginBottom: SPACE.sm,
                }}
              >
                <IoBlock
                  label="Total Intake"
                  value="1250"
                  unit="mL"
                  sub="PO: 250mL · IV: 1000mL"
                  color={COLORS.info}
                />
                <IoBlock
                  label="Total Output"
                  value="800"
                  unit="mL"
                  sub="Void: 800mL"
                  color={COLORS.warn}
                />
              </div>
              <div style={{ display: 'flex', gap: SPACE.sm }}>
                <TacticalButton
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => showToast('Add Intake dialog opened', 'info')}
                  icon={<Plus size={12} strokeWidth={2} />}
                >
                  Add Intake
                </TacticalButton>
                <TacticalButton
                  variant="secondary"
                  size="sm"
                  fullWidth
                  onClick={() => showToast('Add Output dialog opened', 'info')}
                  icon={<Plus size={12} strokeWidth={2} />}
                >
                  Add Output
                </TacticalButton>
              </div>
            </Section>

            {/* Clinical Profile */}
            <Section id="PT.CLINICAL" title="Clinical Profile" icon={FileText}>
              <div style={{ marginBottom: SPACE.md }}>
                <BracketLabel tone="muted" size="xs">
                  CHIEF COMPLAINT
                </BracketLabel>
                <textarea
                  defaultValue={
                    clinical?.currentEncounter?.chiefComplaint ??
                    (patient as LegacyPatientShape)?.notes ??
                    ''
                  }
                  onFocus={() => setChiefComplaintFocused(true)}
                  onBlur={() => setChiefComplaintFocused(false)}
                  style={{
                    width: '100%',
                    marginTop: 4,
                    minHeight: 84,
                    padding: SPACE.md,
                    background: COLORS.bgDeep,
                    border: `1px solid ${chiefComplaintFocused ? COLORS.accent : COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.textPrimary,
                    fontFamily: FONTS.sans,
                    fontSize: 13,
                    lineHeight: 1.5,
                    outline: 'none',
                    resize: 'vertical',
                    boxShadow: chiefComplaintFocused
                      ? `0 0 0 3px ${COLORS.accentGlow}`
                      : 'none',
                    transition: `all ${MOTION.fast}s ease`,
                  }}
                />
              </div>

              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: SPACE.xs + 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertTriangle size={12} strokeWidth={2} color={COLORS.crit} />
                    <BracketLabel tone="muted" size="xs">
                      ALLERGIES
                    </BracketLabel>
                  </div>
                  <button
                    type="button"
                    onClick={() => showToast('Add Allergy dialog opened', 'info')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      background: 'transparent',
                      border: 'none',
                      color: COLORS.textSecondary,
                      cursor: 'pointer',
                      fontFamily: FONTS.mono,
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      fontWeight: 500,
                    }}
                  >
                    <Plus size={11} strokeWidth={2} /> Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {clinical && clinical.allergies.length > 0 ? (
                    clinical.allergies.map((a) => (
                      <AllergyChip
                        key={a.id}
                        label={`${a.substance} · ${a.reaction}`}
                        critical={a.severity === 'high'}
                      />
                    ))
                  ) : clinical ? (
                    <AllergyChip label="NKA · No Known Allergies" />
                  ) : (
                    <>
                      <AllergyChip label="Penicillin" critical />
                      <AllergyChip label="Latex" />
                    </>
                  )}
                </div>
              </div>
            </Section>

            {/* Medications (MAR) */}
            <Section
              id="PT.MAR"
              title="Medications · MAR"
              icon={Pill}
              action={
                <TacticalButton
                  variant="ghost"
                  size="sm"
                  onClick={() => showToast('Barcode Scanner Activated', 'info')}
                  icon={<ScanLine size={12} strokeWidth={2} />}
                >
                  Scan to Admin
                </TacticalButton>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
                {(() => {
                  const patientId = clinical?.id;
                  const meds = patientId ? (MOCK_MEDS[patientId] ?? []) : [];
                  if (meds.length === 0) {
                    return (
                      <>
                        <MedRow
                          icon={<CheckCircle2 size={14} color={COLORS.ok} strokeWidth={2} />}
                          title="Ondansetron (Zofran)"
                          sub="4mg IV Push · Given 14:30"
                          status="given"
                        />
                        <MedRow
                          icon={<Syringe size={14} color={COLORS.textSecondary} strokeWidth={2} />}
                          title="Morphine Sulfate"
                          sub="2mg IV Push · Due 16:00"
                          action={
                            <TacticalButton variant="primary" size="sm" onClick={() => showToast('Medication administered', 'success')}>
                              Administer
                            </TacticalButton>
                          }
                        />
                      </>
                    );
                  }
                  return meds.map((med) => {
                    const isCompleted = med.status === 'completed';
                    const isHighAlert = med.priorityHigh;
                    return (
                      <MedRow
                        key={med.id}
                        icon={
                          isCompleted
                            ? <CheckCircle2 size={14} color={COLORS.ok} strokeWidth={2} />
                            : isHighAlert
                              ? <AlertTriangle size={14} color={COLORS.warn} strokeWidth={2} />
                              : <Syringe size={14} color={COLORS.textSecondary} strokeWidth={2} />
                        }
                        title={med.medication}
                        sub={`${med.dose} ${med.route} · ${med.frequency}${med.indication ? ` · ${med.indication}` : ''}`}
                        status={isCompleted ? 'given' : undefined}
                        action={
                          !isCompleted ? (
                            <TacticalButton
                              variant={isHighAlert ? 'danger' : 'primary'}
                              size="sm"
                              onClick={() => showToast(`${med.medication} administered`, 'success')}
                            >
                              Admin
                            </TacticalButton>
                          ) : undefined
                        }
                      />
                    );
                  });
                })()}
              </div>
            </Section>

            {/* Lab Results */}
            {(() => {
              const patientId = clinical?.id;
              const labs = patientId ? (MOCK_LABS[patientId] ?? []) : [];
              if (labs.length === 0) return null;
              return (
                <Section
                  id="PT.LABS"
                  title="Lab Results"
                  icon={FlaskConical}
                  action={<ConfidenceBadge confidence={96} ageMinutes={15} compact />}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 80px 60px 50px',
                      gap: SPACE.xs,
                      padding: `${SPACE.xs}px 0`,
                      borderBottom: `1px solid ${COLORS.border}`,
                    }}>
                      <Mono tone="muted" size="xs">TEST</Mono>
                      <Mono tone="muted" size="xs">VALUE</Mono>
                      <Mono tone="muted" size="xs">REF</Mono>
                      <Mono tone="muted" size="xs">FLAG</Mono>
                    </div>
                    {labs.map((lab) => {
                      const isCritical = lab.flag === 'HH' || lab.flag === 'LL';
                      const isAbnormal = lab.flag === 'H' || lab.flag === 'L';
                      const flagColor = isCritical ? COLORS.crit : isAbnormal ? COLORS.warn : COLORS.ok;
                      const flagLabel = lab.flag === 'HH' ? 'CRIT ↑' : lab.flag === 'LL' ? 'CRIT ↓' : lab.flag === 'H' ? 'HIGH' : lab.flag === 'L' ? 'LOW' : lab.flag === 'N' ? 'NL' : '—';
                      const isPending = lab.status === 'preliminary';
                      return (
                        <div
                          key={lab.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '1fr 80px 60px 50px',
                            gap: SPACE.xs,
                            padding: `${SPACE.sm}px 0`,
                            borderBottom: `1px solid ${COLORS.border}`,
                            background: isCritical ? `${COLORS.crit}06` : 'transparent',
                            borderLeft: isCritical ? `2px solid ${COLORS.crit}` : '2px solid transparent',
                            paddingLeft: SPACE.xs,
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{
                              fontFamily: FONTS.sans,
                              fontSize: 12,
                              fontWeight: 500,
                              color: isPending ? COLORS.textMuted : COLORS.textPrimary,
                              lineHeight: 1.2,
                            }}>
                              {lab.name}
                            </div>
                          </div>
                          <div style={{
                            fontFamily: FONTS.mono,
                            fontSize: 12,
                            fontWeight: 600,
                            color: isPending ? COLORS.textMuted : isCritical ? COLORS.crit : isAbnormal ? COLORS.warn : COLORS.textPrimary,
                            letterSpacing: '0.04em',
                          }}>
                            {isPending ? '...' : `${lab.value}`}
                            {lab.unit && !isPending && <span style={{ fontSize: 9, color: COLORS.textMuted, marginLeft: 2 }}>{lab.unit}</span>}
                          </div>
                          <Mono tone="dim" size="xs">
                            {lab.referenceLow !== undefined && lab.referenceHigh !== undefined
                              ? `${lab.referenceLow}-${lab.referenceHigh}`
                              : '—'}
                          </Mono>
                          <span style={{
                            fontFamily: FONTS.mono,
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                            color: flagColor,
                          }}>
                            {isPending ? 'PEND' : flagLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              );
            })()}

            {/* Clinical Notes */}
            {(() => {
              const patientId = clinical?.id;
              const notes = patientId ? (MOCK_NOTES[patientId] ?? []) : [];
              if (notes.length === 0) return null;
              return (
                <Section
                  id="PT.NOTES"
                  title="Clinical Notes"
                  icon={StickyNote}
                  action={
                    <TacticalButton variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => setShowNoteComposer(true)}>
                      Add Note
                    </TacticalButton>
                  }
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                    {notes.map((note) => (
                      <div
                        key={note.id}
                        style={{
                          padding: SPACE.md,
                          background: COLORS.bgDeep,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.sm,
                          position: 'relative',
                        }}
                      >
                        <CornerBracket position="tl" color={COLORS.info} size={6} thickness={1} inset={0} />
                        <CornerBracket position="br" color={COLORS.info} size={6} thickness={1} inset={0} />
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: SPACE.sm,
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                            <StatusPill
                              label={note.type}
                              tone={note.type === 'H&P' ? 'info' : note.type === 'SOAP' ? 'ok' : 'neutral'}
                              size="xs"
                            />
                            <Mono tone="muted" size="xs">{note.authorId}</Mono>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {note.signed && <CheckCircle2 size={10} color={COLORS.ok} />}
                            <Mono tone="dim" size="xs">
                              {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </Mono>
                          </div>
                        </div>
                        <div style={{
                          fontFamily: FONTS.sans,
                          fontSize: 12,
                          color: COLORS.textSecondary,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          maxHeight: 160,
                          overflow: 'hidden',
                          maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                          WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                        }}>
                          {note.content.replace(/\*\*(.*?)\*\*/g, '$1')}
                        </div>
                        <TacticalButton
                          variant="ghost"
                          size="sm"
                          style={{ marginTop: SPACE.sm }}
                          onClick={() => showToast('Opening full note view', 'info')}
                        >
                          Read Full Note
                        </TacticalButton>
                      </div>
                    ))}
                  </div>
                </Section>
              );
            })()}

            {/* Imaging */}
            {(() => {
              const patientId = clinical?.id;
              const imaging = patientId ? (MOCK_IMAGING[patientId] ?? []) : [];
              if (imaging.length === 0) return null;
              return (
                <Section
                  id="PT.IMG"
                  title="Imaging"
                  icon={ImageIcon}
                  action={
                    <TacticalButton variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => setShowOrderEntry(true)}>
                      Order
                    </TacticalButton>
                  }
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                    {imaging.map((img) => {
                      const statusTone = img.status === 'resulted' ? 'ok' : img.status === 'in-progress' ? 'warn' : img.status === 'ordered' ? 'info' : 'neutral';
                      return (
                        <div
                          key={img.id}
                          style={{
                            padding: SPACE.md,
                            background: COLORS.bgDeep,
                            border: `1px solid ${COLORS.border}`,
                            borderLeft: `3px solid ${img.priority === 'stat' ? COLORS.crit : img.priority === 'urgent' ? COLORS.warn : COLORS.border}`,
                            borderRadius: RADIUS.sm,
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: img.resultSummary ? SPACE.xs : 0,
                          }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{
                                fontFamily: FONTS.sans,
                                fontSize: 13,
                                fontWeight: 500,
                                color: COLORS.textPrimary,
                                lineHeight: 1.2,
                              }}>
                                {img.study}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                <Mono tone="muted" size="xs">{img.modality}</Mono>
                                <Mono tone="dim" size="xs">·</Mono>
                                <Mono tone="muted" size="xs">{img.orderedBy}</Mono>
                                {img.priority === 'stat' && <StatusPill label="STAT" tone="crit" size="xs" />}
                              </div>
                            </div>
                            <StatusPill
                              label={img.status.toUpperCase().replace('-', ' ')}
                              tone={statusTone}
                              size="xs"
                            />
                          </div>
                          {img.resultSummary && (
                            <div style={{
                              fontFamily: FONTS.sans,
                              fontSize: 11,
                              color: COLORS.textSecondary,
                              lineHeight: 1.4,
                              padding: `${SPACE.xs}px ${SPACE.sm}px`,
                              background: `${COLORS.ok}06`,
                              border: `1px solid ${COLORS.ok}15`,
                              borderRadius: RADIUS.sm,
                              marginTop: SPACE.xs,
                            }}>
                              {img.resultSummary}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Section>
              );
            })()}

            {/* Nursing Orders */}
            <Section id="PT.ORDERS" title="Nursing Orders" icon={ListTodo}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
                {orders.map((order) => {
                  const completed = order.status === 'completed';
                  const isStat = order.type === 'stat';
                  return (
                    <div
                      key={order.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: SPACE.sm,
                        padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                        background: completed ? 'rgba(16,185,129,0.04)' : COLORS.bgDeep,
                        border: `1px solid ${completed ? COLORS.ok : isStat ? COLORS.crit : COLORS.border}`,
                        borderLeft: `3px solid ${completed ? COLORS.ok : isStat ? COLORS.crit : COLORS.border}`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setOrders((prev) =>
                              prev.map((o) =>
                                o.id === order.id
                                  ? {
                                      ...o,
                                      status:
                                        o.status === 'completed' ? 'pending' : 'completed',
                                    }
                                  : o,
                              ),
                            );
                            showToast(
                              `Order marked as ${completed ? 'pending' : 'completed'}`,
                              'success',
                            );
                          }}
                          style={{
                            width: 18,
                            height: 18,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: completed ? COLORS.ok : COLORS.surface,
                            border: `1px solid ${completed ? COLORS.ok : COLORS.borderStrong}`,
                            borderRadius: RADIUS.sm,
                            cursor: 'pointer',
                            flexShrink: 0,
                            color: '#000',
                            transition: `all ${MOTION.fast}s ease`,
                          }}
                        >
                          {completed && <CheckCircle2 size={11} strokeWidth={2.5} />}
                        </button>
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontFamily: FONTS.sans,
                              fontSize: 13,
                              fontWeight: 500,
                              color: completed ? COLORS.textMuted : COLORS.textPrimary,
                              textDecoration: completed ? 'line-through' : 'none',
                              lineHeight: 1.3,
                            }}
                          >
                            {order.task}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              marginTop: 2,
                            }}
                          >
                            <Clock size={10} strokeWidth={2} color={COLORS.textDim} />
                            <Mono tone="dim" size="xs">
                              Due {order.time}
                            </Mono>
                          </div>
                        </div>
                      </div>
                      {isStat && !completed && (
                        <StatusPill label="STAT" tone="crit" pulse />
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Admin & Insurance */}
            <Section id="PT.ADMIN" title="Admin & Insurance" icon={CreditCard}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                <Field
                  label="Primary Insurance"
                  defaultValue={
                    clinical?.currentEncounter?.payer?.primary ?? 'BlueCross BlueShield'
                  }
                />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: SPACE.sm,
                  }}
                >
                  <Field
                    label="Member ID"
                    defaultValue={
                      clinical?.currentEncounter?.payer?.memberId ?? 'XYZ123456789'
                    }
                  />
                  <Field
                    label="Group Number"
                    defaultValue={
                      clinical?.currentEncounter?.payer?.groupId ?? '98765'
                    }
                  />
                </div>
                <Divider />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <Mono tone="muted" size="xs">
                      TOGGLE
                    </Mono>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 13,
                        color: COLORS.textPrimary,
                        marginTop: 2,
                      }}
                    >
                      Guarantor same as patient
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsGuarantorSame(!isGuarantorSame)}
                    role="switch"
                    aria-checked={isGuarantorSame}
                    style={{
                      position: 'relative',
                      width: 42,
                      height: 22,
                      background: isGuarantorSame ? COLORS.ok : COLORS.surfaceElev,
                      border: `1px solid ${isGuarantorSame ? COLORS.ok : COLORS.borderStrong}`,
                      borderRadius: 999,
                      cursor: 'pointer',
                      transition: `all ${MOTION.fast}s ease`,
                      padding: 0,
                    }}
                  >
                    <motion.div
                      animate={{ x: isGuarantorSame ? 20 : 2 }}
                      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                      style={{
                        position: 'absolute',
                        top: 2,
                        width: 16,
                        height: 16,
                        background: isGuarantorSame ? '#000' : COLORS.textPrimary,
                        borderRadius: '50%',
                      }}
                    />
                  </button>
                </div>
              </div>
            </Section>
          </div>
        </main>

        <style>
          {`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}
        </style>

        {/* Clinical workflow overlays */}
        <NoteComposer
          open={showNoteComposer}
          onClose={() => setShowNoteComposer(false)}
          showToast={(msg) => showToast(msg, 'success')}
          patientId={clinical?.id}
          onAddNote={onAddNote}
        />
        <OrderEntry
          open={showOrderEntry}
          onClose={() => setShowOrderEntry(false)}
          showToast={(msg) => showToast(msg, 'success')}
          patientId={clinical?.id}
        />
        <HandoffComposer
          open={showHandoff}
          onClose={() => setShowHandoff(false)}
          showToast={(msg) => showToast(msg, 'success')}
        />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ duration: 0.42, ease: MOTION.ease }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: COLORS.bg,
        color: COLORS.textPrimary,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: FONTS.sans,
        // Honour iPhone safe areas — fixed elements don't inherit
        // padding from the parent shell, so the dynamic island and
        // home indicator would otherwise clip the chrome.
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <DotGridBg />

      {/* Top HUD strip — tactical header with back + save */}
      <HudStrip side="top" fixed={false} height={52}>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flex: 1, minWidth: 0 }}>
          {/* Minimal icon-only back button — the old bordered label+icon
              duplicated the "back" affordance with redundant chrome. */}
          <motion.button
            type="button"
            onClick={onClose}
            aria-label="Back"
            whileTap={{ scale: 0.9 }}
            whileHover={{ x: -2 }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
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
            <ChevronLeft size={18} strokeWidth={2} />
          </motion.button>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
              flex: 1,
            }}
          >
            <BracketLabel tone="secondary" size="xs">
              PATIENT · DETAIL
            </BracketLabel>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: SPACE.sm,
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontFamily: FONTS.sans,
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.textPrimary,
                  letterSpacing: '-0.003em',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {displayName}
              </span>
              <Mono tone="muted" size="xs">
                {displayMrn}
              </Mono>
            </div>
          </div>
        </div>

        <TacticalButton
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          icon={
            isSaving ? (
              <Loader2
                size={13}
                strokeWidth={2}
                style={{ animation: 'spin 1.2s linear infinite' }}
              />
            ) : (
              <Save size={13} strokeWidth={2} />
            )
          }
        >
          {isSaving ? 'Saving…' : 'Save'}
        </TacticalButton>
      </HudStrip>

      {/* Scrollable main content */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE['3xl']}px`,
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div style={{ maxWidth: 820, margin: '0 auto' }}>
          {/* Patient banner — tactical FHIR-aligned header strip with
              code status, isolation, allergies, and the dominant early
              warning score. Falls back to the legacy 3-box banner for
              any caller that hasn't migrated to Patient yet. */}
          {clinical ? (
            <>
              <PatientHeaderStrip patient={clinical} />
              <VitalsPanel patient={clinical} />
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                gap: SPACE.sm,
                marginBottom: SPACE.lg,
              }}
            >
              <StatBox label="Age / Sex" value={(patient as LegacyPatientShape)?.age ?? '—'} />
              <StatBox
                label="Code Status"
                value={(patient as LegacyPatientShape)?.code ?? '—'}
                tone={isDnr ? 'info' : 'default'}
              />
              <StatBox label="Acuity" value="ESI 2" tone="crit" />
            </div>
          )}

          {/* Encounter Timeline — shows the patient's ED journey */}
          {clinical && (
            <Section id="PT.TIMELINE" title="Encounter Timeline" icon={Timer}>
              <div style={{ position: 'relative', paddingLeft: 20 }}>
                {/* Vertical connector line */}
                <div
                  aria-hidden
                  style={{
                    position: 'absolute',
                    left: 6,
                    top: 4,
                    bottom: 4,
                    width: 1,
                    background: `linear-gradient(180deg, ${COLORS.ok} 0%, ${COLORS.info} 50%, ${COLORS.border} 100%)`,
                  }}
                />
                {[
                  { time: '12:15', label: 'Arrival', detail: `Ambulatory walk-in · ${clinical.currentEncounter?.chiefComplaint ?? 'Chest pain'}`, tone: COLORS.ok, done: true },
                  { time: '12:22', label: 'Triage (ESI ' + (clinical.currentEncounter?.esiLevel ?? 2) + ')', detail: 'Vitals recorded · MEWS calculated · Allergies verified', tone: COLORS.ok, done: true },
                  { time: '12:35', label: 'Assessment', detail: clinical.currentEncounter?.attendingId ? `Attending: ${clinical.currentEncounter.attendingId}` : 'Attending: Dr. Reeves', tone: COLORS.ok, done: true },
                  { time: '13:00', label: 'Labs Drawn', detail: 'CBC, BMP, Troponin, BNP · Results pending', tone: COLORS.info, done: true },
                  { time: '13:15', label: 'Imaging', detail: 'CT Head ordered · In progress', tone: COLORS.warn, done: false },
                  { time: '—', label: 'Disposition', detail: 'Pending attending review', tone: COLORS.textMuted, done: false },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', gap: SPACE.md, marginBottom: i < 5 ? SPACE.md : 0, position: 'relative' }}>
                    {/* Dot */}
                    <div style={{
                      position: 'absolute',
                      left: -20,
                      top: 2,
                      width: 12,
                      height: 12,
                      borderRadius: '50%',
                      background: step.done ? step.tone : COLORS.surface,
                      border: `2px solid ${step.tone}`,
                      boxShadow: step.done ? `0 0 6px ${step.tone}40` : 'none',
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: 2 }}>
                        <Mono tone="dim" size="xs">{step.time}</Mono>
                        <span style={{
                          fontFamily: FONTS.sans,
                          fontSize: 13,
                          fontWeight: step.done ? 600 : 500,
                          color: step.done ? COLORS.textPrimary : COLORS.textMuted,
                        }}>
                          {step.label}
                        </span>
                        {!step.done && <StatusPill label="PENDING" tone="warn" size="xs" />}
                      </div>
                      <span style={{
                        fontFamily: FONTS.sans,
                        fontSize: 11,
                        color: COLORS.textSecondary,
                        lineHeight: 1.4,
                      }}>
                        {step.detail}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Care Team */}
          {clinical && (
            <Section
              id="PT.TEAM"
              title="Care Team"
              icon={UserCheck}
              action={
                <TacticalButton variant="ghost" size="sm" icon={<ArrowRightLeft size={12} />} onClick={() => setShowHandoff(true)}>
                  Handoff
                </TacticalButton>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
                {[
                  { role: 'ATTENDING', name: clinical.currentEncounter?.attendingId ?? 'Dr. R. Reeves', dept: 'Emergency Medicine', active: true },
                  { role: 'PRIMARY RN', name: clinical.currentEncounter?.nurseId ?? 'RN J. Kim', dept: 'ED Acute', active: true },
                  { role: 'CHARGE', name: 'RN S. Lee', dept: 'ED', active: true },
                  { role: 'PHARM', name: 'Dr. T. Pham', dept: 'Clinical Pharmacy', active: false },
                  { role: 'CONSULT', name: 'Dr. M. Chen', dept: 'Cardiology', active: false },
                ].map((member) => (
                  <div
                    key={member.role}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: SPACE.sm,
                      padding: `${SPACE.sm}px ${SPACE.md}px`,
                      background: COLORS.bgDeep,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                      <div style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: member.active ? COLORS.ok : COLORS.textMuted,
                        boxShadow: member.active ? `0 0 4px ${COLORS.ok}` : 'none',
                        flexShrink: 0,
                      }} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontFamily: FONTS.sans,
                          fontSize: 13,
                          fontWeight: 500,
                          color: COLORS.textPrimary,
                          lineHeight: 1.25,
                        }}>
                          {member.name}
                        </div>
                        <Mono tone="muted" size="xs">{member.dept}</Mono>
                      </div>
                    </div>
                    <StatusPill label={member.role} tone={member.active ? 'ok' : 'neutral'} size="xs" />
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Intake & Measurements */}
          <Section id="PT.INTAKE" title="Intake & Measurements" icon={Scale}>
            <div
              style={{
                display: 'flex',
                gap: SPACE.sm,
                marginBottom: SPACE.md,
                flexWrap: 'wrap',
              }}
            >
              <Field
                label="Height"
                defaultValue={
                  clinical?.heightCm != null ? String(clinical.heightCm) : '178'
                }
                unit="cm"
                type="number"
              />
              <Field
                label="Weight"
                defaultValue={
                  clinical?.weightKg != null ? String(clinical.weightKg) : '82.5'
                }
                unit="kg"
                type="number"
              />
              <div style={{ flex: 1, minWidth: 120 }}>
                <BracketLabel tone="muted" size="xs">
                  BMI
                </BracketLabel>
                <div
                  style={{
                    marginTop: 4,
                    padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                    background: COLORS.bgDeep,
                    border: `1px solid ${COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: SPACE.sm,
                  }}
                >
                  <span
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 14,
                      fontWeight: 700,
                      color: COLORS.warn,
                    }}
                  >
                    26.0
                  </span>
                  <StatusPill label="Overweight" tone="warn" />
                </div>
              </div>
            </div>

            <div style={{ marginBottom: SPACE.md }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.xs,
                  marginBottom: 6,
                }}
              >
                <Activity size={11} strokeWidth={2} color={COLORS.textMuted} />
                <BracketLabel tone="muted" size="xs">
                  PAIN SCALE · 0–10
                </BracketLabel>
              </div>
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
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    marginBottom: SPACE.sm,
                  }}
                >
                  <Mono tone="ok" size="xs">
                    0
                  </Mono>
                  <div
                    style={{
                      fontFamily: FONTS.mono,
                      fontSize: 32,
                      fontWeight: 700,
                      color: COLORS.textPrimary,
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1,
                    }}
                  >
                    {painScore}
                  </div>
                  <Mono tone="crit" size="xs">
                    10
                  </Mono>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10"
                  value={painScore}
                  onChange={(e) => setPainScore(parseInt(e.target.value, 10))}
                  style={{
                    width: '100%',
                    accentColor: COLORS.accent,
                    cursor: 'pointer',
                  }}
                />
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: SPACE.sm,
              }}
            >
              <Field label="Temp" defaultValue="37.2" unit="°C" type="number" />
              <Field label="Resp Rate" defaultValue="18" unit="bpm" type="number" />
            </div>
          </Section>

          {/* I&O */}
          <Section id="PT.IO" title="I&O · Intake / Output" icon={Droplets}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: SPACE.sm,
                marginBottom: SPACE.sm,
              }}
            >
              <IoBlock
                label="Total Intake"
                value="1250"
                unit="mL"
                sub="PO: 250mL · IV: 1000mL"
                color={COLORS.info}
              />
              <IoBlock
                label="Total Output"
                value="800"
                unit="mL"
                sub="Void: 800mL"
                color={COLORS.warn}
              />
            </div>
            <div style={{ display: 'flex', gap: SPACE.sm }}>
              <TacticalButton
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => showToast('Add Intake dialog opened', 'info')}
                icon={<Plus size={12} strokeWidth={2} />}
              >
                Add Intake
              </TacticalButton>
              <TacticalButton
                variant="secondary"
                size="sm"
                fullWidth
                onClick={() => showToast('Add Output dialog opened', 'info')}
                icon={<Plus size={12} strokeWidth={2} />}
              >
                Add Output
              </TacticalButton>
            </div>
          </Section>

          {/* Clinical Profile */}
          <Section id="PT.CLINICAL" title="Clinical Profile" icon={FileText}>
            <div style={{ marginBottom: SPACE.md }}>
              <BracketLabel tone="muted" size="xs">
                CHIEF COMPLAINT
              </BracketLabel>
              <textarea
                defaultValue={
                  clinical?.currentEncounter?.chiefComplaint ??
                  (patient as LegacyPatientShape)?.notes ??
                  ''
                }
                onFocus={() => setChiefComplaintFocused(true)}
                onBlur={() => setChiefComplaintFocused(false)}
                style={{
                  width: '100%',
                  marginTop: 4,
                  minHeight: 84,
                  padding: SPACE.md,
                  background: COLORS.bgDeep,
                  border: `1px solid ${chiefComplaintFocused ? COLORS.accent : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textPrimary,
                  fontFamily: FONTS.sans,
                  fontSize: 13,
                  lineHeight: 1.5,
                  outline: 'none',
                  resize: 'vertical',
                  boxShadow: chiefComplaintFocused
                    ? `0 0 0 3px ${COLORS.accentGlow}`
                    : 'none',
                  transition: `all ${MOTION.fast}s ease`,
                }}
              />
            </div>

            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: SPACE.xs + 2,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} strokeWidth={2} color={COLORS.crit} />
                  <BracketLabel tone="muted" size="xs">
                    ALLERGIES
                  </BracketLabel>
                </div>
                <button
                  type="button"
                  onClick={() => showToast('Add Allergy dialog opened', 'info')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    background: 'transparent',
                    border: 'none',
                    color: COLORS.textSecondary,
                    cursor: 'pointer',
                    fontFamily: FONTS.mono,
                    fontSize: 10,
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    fontWeight: 500,
                  }}
                >
                  <Plus size={11} strokeWidth={2} /> Add
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {clinical && clinical.allergies.length > 0 ? (
                  clinical.allergies.map((a) => (
                    <AllergyChip
                      key={a.id}
                      label={`${a.substance} · ${a.reaction}`}
                      critical={a.severity === 'high'}
                    />
                  ))
                ) : clinical ? (
                  <AllergyChip label="NKA · No Known Allergies" />
                ) : (
                  <>
                    <AllergyChip label="Penicillin" critical />
                    <AllergyChip label="Latex" />
                  </>
                )}
              </div>
            </div>
          </Section>

          {/* Medications (MAR) — uses FHIR MedicationRequest data */}
          <Section
            id="PT.MAR"
            title="Medications · MAR"
            icon={Pill}
            action={
              <TacticalButton
                variant="ghost"
                size="sm"
                onClick={() => showToast('Barcode Scanner Activated', 'info')}
                icon={<ScanLine size={12} strokeWidth={2} />}
              >
                Scan to Admin
              </TacticalButton>
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
              {(() => {
                const patientId = clinical?.id;
                const meds = patientId ? (MOCK_MEDS[patientId] ?? []) : [];
                if (meds.length === 0) {
                  return (
                    <>
                      <MedRow
                        icon={<CheckCircle2 size={14} color={COLORS.ok} strokeWidth={2} />}
                        title="Ondansetron (Zofran)"
                        sub="4mg IV Push · Given 14:30"
                        status="given"
                      />
                      <MedRow
                        icon={<Syringe size={14} color={COLORS.textSecondary} strokeWidth={2} />}
                        title="Morphine Sulfate"
                        sub="2mg IV Push · Due 16:00"
                        action={
                          <TacticalButton variant="primary" size="sm" onClick={() => showToast('Medication administered', 'success')}>
                            Administer
                          </TacticalButton>
                        }
                      />
                    </>
                  );
                }
                return meds.map((med) => {
                  const isCompleted = med.status === 'completed';
                  const isHighAlert = med.priorityHigh;
                  return (
                    <MedRow
                      key={med.id}
                      icon={
                        isCompleted
                          ? <CheckCircle2 size={14} color={COLORS.ok} strokeWidth={2} />
                          : isHighAlert
                            ? <AlertTriangle size={14} color={COLORS.warn} strokeWidth={2} />
                            : <Syringe size={14} color={COLORS.textSecondary} strokeWidth={2} />
                      }
                      title={med.medication}
                      sub={`${med.dose} ${med.route} · ${med.frequency}${med.indication ? ` · ${med.indication}` : ''}`}
                      status={isCompleted ? 'given' : undefined}
                      action={
                        !isCompleted ? (
                          <TacticalButton
                            variant={isHighAlert ? 'danger' : 'primary'}
                            size="sm"
                            onClick={() => showToast(`${med.medication} administered`, 'success')}
                          >
                            Admin
                          </TacticalButton>
                        ) : undefined
                      }
                    />
                  );
                });
              })()}
            </div>
          </Section>

          {/* ── LAB RESULTS ────────────────────────────────────
              FHIR Observation (category: laboratory) — abnormal
              flagging with critical value callouts. This section
              makes the patient chart feel like a real EHR. */}
          {(() => {
            const patientId = clinical?.id;
            const labs = patientId ? (MOCK_LABS[patientId] ?? []) : [];
            if (labs.length === 0) return null;
            return (
              <Section
                id="PT.LABS"
                title="Lab Results"
                icon={FlaskConical}
                action={<ConfidenceBadge confidence={96} ageMinutes={15} compact />}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {/* Header row */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 60px 50px',
                    gap: SPACE.xs,
                    padding: `${SPACE.xs}px 0`,
                    borderBottom: `1px solid ${COLORS.border}`,
                  }}>
                    <Mono tone="muted" size="xs">TEST</Mono>
                    <Mono tone="muted" size="xs">VALUE</Mono>
                    <Mono tone="muted" size="xs">REF</Mono>
                    <Mono tone="muted" size="xs">FLAG</Mono>
                  </div>
                  {labs.map((lab) => {
                    const isCritical = lab.flag === 'HH' || lab.flag === 'LL';
                    const isAbnormal = lab.flag === 'H' || lab.flag === 'L';
                    const flagColor = isCritical ? COLORS.crit : isAbnormal ? COLORS.warn : COLORS.ok;
                    const flagLabel = lab.flag === 'HH' ? 'CRIT ↑' : lab.flag === 'LL' ? 'CRIT ↓' : lab.flag === 'H' ? 'HIGH' : lab.flag === 'L' ? 'LOW' : lab.flag === 'N' ? 'NL' : '—';
                    const isPending = lab.status === 'preliminary';
                    return (
                      <div
                        key={lab.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 80px 60px 50px',
                          gap: SPACE.xs,
                          padding: `${SPACE.sm}px 0`,
                          borderBottom: `1px solid ${COLORS.border}`,
                          background: isCritical ? `${COLORS.crit}06` : 'transparent',
                          borderLeft: isCritical ? `2px solid ${COLORS.crit}` : '2px solid transparent',
                          paddingLeft: SPACE.xs,
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontFamily: FONTS.sans,
                            fontSize: 12,
                            fontWeight: 500,
                            color: isPending ? COLORS.textMuted : COLORS.textPrimary,
                            lineHeight: 1.2,
                          }}>
                            {lab.name}
                          </div>
                        </div>
                        <div style={{
                          fontFamily: FONTS.mono,
                          fontSize: 12,
                          fontWeight: 600,
                          color: isPending ? COLORS.textMuted : isCritical ? COLORS.crit : isAbnormal ? COLORS.warn : COLORS.textPrimary,
                          letterSpacing: '0.04em',
                        }}>
                          {isPending ? '...' : `${lab.value}`}
                          {lab.unit && !isPending && <span style={{ fontSize: 9, color: COLORS.textMuted, marginLeft: 2 }}>{lab.unit}</span>}
                        </div>
                        <Mono tone="dim" size="xs">
                          {lab.referenceLow !== undefined && lab.referenceHigh !== undefined
                            ? `${lab.referenceLow}-${lab.referenceHigh}`
                            : '—'}
                        </Mono>
                        <span style={{
                          fontFamily: FONTS.mono,
                          fontSize: 9,
                          fontWeight: 600,
                          letterSpacing: '0.1em',
                          color: flagColor,
                        }}>
                          {isPending ? 'PEND' : flagLabel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </Section>
            );
          })()}

          {/* ── CLINICAL NOTES ─────────────────────────────────
              FHIR DocumentReference — SOAP, H&P, nursing notes.
              Each note shows author, time, type, and content. */}
          {(() => {
            const patientId = clinical?.id;
            const notes = patientId ? (MOCK_NOTES[patientId] ?? []) : [];
            if (notes.length === 0) return null;
            return (
              <Section
                id="PT.NOTES"
                title="Clinical Notes"
                icon={StickyNote}
                action={
                  <TacticalButton variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => setShowNoteComposer(true)}>
                    Add Note
                  </TacticalButton>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                  {notes.map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: SPACE.md,
                        background: COLORS.bgDeep,
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        position: 'relative',
                      }}
                    >
                      <CornerBracket position="tl" color={COLORS.info} size={6} thickness={1} inset={0} />
                      <CornerBracket position="br" color={COLORS.info} size={6} thickness={1} inset={0} />
                      {/* Note header */}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: SPACE.sm,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                          <StatusPill
                            label={note.type}
                            tone={note.type === 'H&P' ? 'info' : note.type === 'SOAP' ? 'ok' : 'neutral'}
                            size="xs"
                          />
                          <Mono tone="muted" size="xs">{note.authorId}</Mono>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          {note.signed && <CheckCircle2 size={10} color={COLORS.ok} />}
                          <Mono tone="dim" size="xs">
                            {new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </Mono>
                        </div>
                      </div>
                      {/* Note content — markdown-like rendering */}
                      <div style={{
                        fontFamily: FONTS.sans,
                        fontSize: 12,
                        color: COLORS.textSecondary,
                        lineHeight: 1.5,
                        whiteSpace: 'pre-wrap',
                        maxHeight: 160,
                        overflow: 'hidden',
                        maskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                        WebkitMaskImage: 'linear-gradient(to bottom, black 70%, transparent 100%)',
                      }}>
                        {note.content.replace(/\*\*(.*?)\*\*/g, '$1')}
                      </div>
                      <TacticalButton
                        variant="ghost"
                        size="sm"
                        style={{ marginTop: SPACE.sm }}
                        onClick={() => showToast('Opening full note view', 'info')}
                      >
                        Read Full Note
                      </TacticalButton>
                    </div>
                  ))}
                </div>
              </Section>
            );
          })()}

          {/* ── IMAGING ────────────────────────────────────────
              Imaging orders with status (ordered → in-progress →
              resulted) and result summaries. */}
          {(() => {
            const patientId = clinical?.id;
            const imaging = patientId ? (MOCK_IMAGING[patientId] ?? []) : [];
            if (imaging.length === 0) return null;
            return (
              <Section
                id="PT.IMG"
                title="Imaging"
                icon={ImageIcon}
                action={
                  <TacticalButton variant="ghost" size="sm" icon={<Plus size={12} />} onClick={() => setShowOrderEntry(true)}>
                    Order
                  </TacticalButton>
                }
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                  {imaging.map((img) => {
                    const statusTone = img.status === 'resulted' ? 'ok' : img.status === 'in-progress' ? 'warn' : img.status === 'ordered' ? 'info' : 'neutral';
                    return (
                      <div
                        key={img.id}
                        style={{
                          padding: SPACE.md,
                          background: COLORS.bgDeep,
                          border: `1px solid ${COLORS.border}`,
                          borderLeft: `3px solid ${img.priority === 'stat' ? COLORS.crit : img.priority === 'urgent' ? COLORS.warn : COLORS.border}`,
                          borderRadius: RADIUS.sm,
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: img.resultSummary ? SPACE.xs : 0,
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{
                              fontFamily: FONTS.sans,
                              fontSize: 13,
                              fontWeight: 500,
                              color: COLORS.textPrimary,
                              lineHeight: 1.2,
                            }}>
                              {img.study}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
                              <Mono tone="muted" size="xs">{img.modality}</Mono>
                              <Mono tone="dim" size="xs">·</Mono>
                              <Mono tone="muted" size="xs">{img.orderedBy}</Mono>
                              {img.priority === 'stat' && <StatusPill label="STAT" tone="crit" size="xs" />}
                            </div>
                          </div>
                          <StatusPill
                            label={img.status.toUpperCase().replace('-', ' ')}
                            tone={statusTone}
                            size="xs"
                          />
                        </div>
                        {img.resultSummary && (
                          <div style={{
                            fontFamily: FONTS.sans,
                            fontSize: 11,
                            color: COLORS.textSecondary,
                            lineHeight: 1.4,
                            padding: `${SPACE.xs}px ${SPACE.sm}px`,
                            background: `${COLORS.ok}06`,
                            border: `1px solid ${COLORS.ok}15`,
                            borderRadius: RADIUS.sm,
                            marginTop: SPACE.xs,
                          }}>
                            {img.resultSummary}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Section>
            );
          })()}

          {/* Nursing Orders */}
          <Section id="PT.ORDERS" title="Nursing Orders" icon={ListTodo}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
              {orders.map((order) => {
                const completed = order.status === 'completed';
                const isStat = order.type === 'stat';
                return (
                  <div
                    key={order.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: SPACE.sm,
                      padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                      background: completed ? 'rgba(16,185,129,0.04)' : COLORS.bgDeep,
                      border: `1px solid ${completed ? COLORS.ok : isStat ? COLORS.crit : COLORS.border}`,
                      borderLeft: `3px solid ${completed ? COLORS.ok : isStat ? COLORS.crit : COLORS.border}`,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setOrders((prev) =>
                            prev.map((o) =>
                              o.id === order.id
                                ? {
                                    ...o,
                                    status:
                                      o.status === 'completed' ? 'pending' : 'completed',
                                  }
                                : o,
                            ),
                          );
                          showToast(
                            `Order marked as ${completed ? 'pending' : 'completed'}`,
                            'success',
                          );
                        }}
                        style={{
                          width: 18,
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: completed ? COLORS.ok : COLORS.surface,
                          border: `1px solid ${completed ? COLORS.ok : COLORS.borderStrong}`,
                          borderRadius: RADIUS.sm,
                          cursor: 'pointer',
                          flexShrink: 0,
                          color: '#000',
                          transition: `all ${MOTION.fast}s ease`,
                        }}
                      >
                        {completed && <CheckCircle2 size={11} strokeWidth={2.5} />}
                      </button>
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 13,
                            fontWeight: 500,
                            color: completed ? COLORS.textMuted : COLORS.textPrimary,
                            textDecoration: completed ? 'line-through' : 'none',
                            lineHeight: 1.3,
                          }}
                        >
                          {order.task}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            marginTop: 2,
                          }}
                        >
                          <Clock size={10} strokeWidth={2} color={COLORS.textDim} />
                          <Mono tone="dim" size="xs">
                            Due {order.time}
                          </Mono>
                        </div>
                      </div>
                    </div>
                    {isStat && !completed && (
                      <StatusPill label="STAT" tone="crit" pulse />
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          {/* Admin & Insurance */}
          <Section id="PT.ADMIN" title="Admin & Insurance" icon={CreditCard}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
              <Field
                label="Primary Insurance"
                defaultValue={
                  clinical?.currentEncounter?.payer?.primary ?? 'BlueCross BlueShield'
                }
              />
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: SPACE.sm,
                }}
              >
                <Field
                  label="Member ID"
                  defaultValue={
                    clinical?.currentEncounter?.payer?.memberId ?? 'XYZ123456789'
                  }
                />
                <Field
                  label="Group Number"
                  defaultValue={
                    clinical?.currentEncounter?.payer?.groupId ?? '98765'
                  }
                />
              </div>
              <Divider />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <Mono tone="muted" size="xs">
                    TOGGLE
                  </Mono>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 13,
                      color: COLORS.textPrimary,
                      marginTop: 2,
                    }}
                  >
                    Guarantor same as patient
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsGuarantorSame(!isGuarantorSame)}
                  role="switch"
                  aria-checked={isGuarantorSame}
                  style={{
                    position: 'relative',
                    width: 42,
                    height: 22,
                    background: isGuarantorSame ? COLORS.ok : COLORS.surfaceElev,
                    border: `1px solid ${isGuarantorSame ? COLORS.ok : COLORS.borderStrong}`,
                    borderRadius: 999,
                    cursor: 'pointer',
                    transition: `all ${MOTION.fast}s ease`,
                    padding: 0,
                  }}
                >
                  <motion.div
                    animate={{ x: isGuarantorSame ? 20 : 2 }}
                    transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                    style={{
                      position: 'absolute',
                      top: 2,
                      width: 16,
                      height: 16,
                      background: isGuarantorSame ? '#000' : COLORS.textPrimary,
                      borderRadius: '50%',
                    }}
                  />
                </button>
              </div>
            </div>
          </Section>
        </div>
      </main>

      <style>
        {`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}
      </style>

      {/* Clinical workflow overlays — launched from chart action buttons */}
      <NoteComposer
        open={showNoteComposer}
        onClose={() => setShowNoteComposer(false)}
        showToast={(msg) => showToast(msg, 'success')}
        patientId={clinical?.id}
        onAddNote={onAddNote}
      />
      <OrderEntry
        open={showOrderEntry}
        onClose={() => setShowOrderEntry(false)}
        showToast={(msg) => showToast(msg, 'success')}
        patientId={clinical?.id}
      />
      <HandoffComposer
        open={showHandoff}
        onClose={() => setShowHandoff(false)}
        showToast={(msg) => showToast(msg, 'success')}
      />
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// IoBlock — intake/output summary cell
// ─────────────────────────────────────────────────────────────────────────
const IoBlock: React.FC<{
  label: string;
  value: string;
  unit: string;
  sub: string;
  color: string;
}> = ({ label, value, unit, sub, color }) => (
  <div
    style={{
      position: 'relative',
      padding: SPACE.md,
      background: COLORS.bgDeep,
      border: `1px solid ${color}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: RADIUS.sm,
    }}
  >
    <Mono tone="muted" size="xs" style={{ color }}>
      {label}
    </Mono>
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 4,
        marginTop: 4,
      }}
    >
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 24,
          fontWeight: 700,
          color,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontFamily: FONTS.mono,
          fontSize: 11,
          color,
          opacity: 0.6,
        }}
      >
        {unit}
      </span>
    </div>
    <Mono tone="dim" size="xs" style={{ marginTop: 4 }}>
      {sub}
    </Mono>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// AllergyChip — critical (rose) or neutral chip
// ─────────────────────────────────────────────────────────────────────────
const AllergyChip: React.FC<{ label: string; critical?: boolean }> = ({
  label,
  critical,
}) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '5px 10px',
      background: critical ? 'rgba(225,29,72,0.08)' : COLORS.bgDeep,
      border: `1px solid ${critical ? COLORS.accent : COLORS.border}`,
      borderRadius: RADIUS.sm,
      fontFamily: FONTS.sans,
      fontSize: 12,
      fontWeight: 600,
      color: critical ? COLORS.accent : COLORS.textSecondary,
      boxShadow: critical ? `0 0 12px ${COLORS.accentGlow}` : 'none',
    }}
  >
    {label}
    {critical && (
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: COLORS.accent,
          animation: 'pulse-dot 1.4s ease-in-out infinite',
        }}
      />
    )}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────
// MedRow — single medication line item
// ─────────────────────────────────────────────────────────────────────────
const MedRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  sub: string;
  status?: 'given' | 'due';
  action?: React.ReactNode;
}> = ({ icon, title, sub, status, action }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACE.sm,
      padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
      background: status === 'given' ? 'rgba(16,185,129,0.04)' : COLORS.bgDeep,
      border: `1px solid ${status === 'given' ? COLORS.ok : COLORS.border}`,
      borderLeft: `3px solid ${status === 'given' ? COLORS.ok : COLORS.borderStrong}`,
      borderRadius: RADIUS.sm,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, minWidth: 0 }}>
      <div
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: COLORS.surface,
          border: `1px solid ${COLORS.borderStrong}`,
          borderRadius: RADIUS.sm,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 13,
            fontWeight: 600,
            color: COLORS.textPrimary,
            lineHeight: 1.25,
          }}
        >
          {title}
        </div>
        <Mono tone="muted" size="xs">
          {sub}
        </Mono>
      </div>
    </div>
    {action}
  </div>
);
