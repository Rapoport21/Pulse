/**
 * AdmitFlow — fullscreen overlay wizard that walks through admitting a
 * patient in three steps:
 *
 *   1. Patient Identification — confirm patient identity + chief complaint
 *   2. Bed Assignment — select from available beds across all units
 *   3. Confirmation — encounter creation summary
 *
 * The flow surfaces available beds from the bed board mock data and
 * generates an admission summary card at the end with the tactical
 * HUD aesthetic (corner brackets, scanning line, monospace labels).
 *
 * Props:
 *   open       — controls overlay visibility
 *   onClose    — dismiss the overlay
 *   showToast  — fire a toast notification to the parent shell
 */

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Bed,
  CheckCircle2,
  ClipboardList,
  Clock,
  Filter,
  Plus,
  User,
  X,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  TYPE,
  Z,
  SHADOW,
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
  CornerBracket,
  TacticalButton,
  ConfidenceBadge,
  HudStrip,
  ScanningLine,
  Divider,
} from '../design';
import { HOSPITAL_UNITS, type BedUnit, type Bed as BedType } from '../../data/bedMock';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

// ── Admission queue entry — shared with App.tsx ─────────────────────
export type AdmissionSource = 'ED' | 'OR' | 'Transfer' | 'Direct';
export type AdmissionStatus = 'pending' | 'placing' | 'in_transit' | 'admitted';

export interface AdmissionAllergyInput {
  substance: string;
  reaction: string;
  severity: 'mild' | 'moderate' | 'severe' | 'life-threatening';
}

export interface AdmissionProblemInput {
  display: string;
  icd10: string;
  status: 'active' | 'resolved' | 'inactive';
}

export interface AdmissionDemographics {
  dob?: string;
  sex?: 'M' | 'F' | 'X' | 'U';
  insurance?: string;
  emergencyContact?: string;
  isolation?: string;
  codeStatus?: string;
  preferredLanguage?: string;
  needsInterpreter?: boolean;
  weightKg?: number;
  heightCm?: number;
  arrivalMode?: string;
  // Vitals on admission
  vitals?: {
    hr?: number; systolic?: number; diastolic?: number;
    rr?: number; spo2?: number; temp?: number;
    painScore?: number; gcs?: number;
  };
  // Clinical lists
  allergies?: AdmissionAllergyInput[];
  problems?: AdmissionProblemInput[];
  specialReqs?: string;
  priority?: string;
}

export interface AdmissionEntry {
  id: string;
  name: string;
  mrn: string;
  source: AdmissionSource;
  acuity: number;
  complaint: string;
  requestedUnit: string;
  status: AdmissionStatus;
  waitMin: number;
  attending: string;
  requestedAt: string;
  assignedBed?: string;
  assignedUnit?: string;
  /** Tracks whether a bed was assigned at admission time */
  bedAssignmentStatus?: 'assigned' | 'admitted-unassigned';
  /** Extra demographics captured from the new-admission form */
  demographics?: AdmissionDemographics;
}

export const INITIAL_ADMISSION_QUEUE: AdmissionEntry[] = [
  { id: 'ADM-001', name: 'Robert Thompson', mrn: 'MRN-9923', source: 'ED', acuity: 2, complaint: 'Chest pain, elevated troponin', requestedUnit: 'ICU', status: 'pending', waitMin: 45, attending: 'Dr. Rivera', requestedAt: '08:15' },
  { id: 'ADM-002', name: 'Linda Park', mrn: 'MRN-4412', source: 'OR', acuity: 3, complaint: 'Post-craniotomy monitoring', requestedUnit: 'Stepdown', status: 'placing', waitMin: 22, attending: 'Dr. Kim', requestedAt: '08:38' },
  { id: 'ADM-003', name: 'Marcus Williams', mrn: 'MRN-6617', source: 'Transfer', acuity: 2, complaint: 'STEMI, needs cath lab post-PCI', requestedUnit: 'ICU', status: 'in_transit', waitMin: 68, attending: 'Dr. Chen', requestedAt: '07:52' },
  { id: 'ADM-004', name: 'Sarah Mitchell', mrn: 'MRN-3301', source: 'ED', acuity: 3, complaint: 'Pneumonia, O2 requirement', requestedUnit: 'Med-Surg', status: 'pending', waitMin: 30, attending: 'Dr. Foster', requestedAt: '08:30' },
  { id: 'ADM-005', name: 'James Ortiz', mrn: 'MRN-8854', source: 'Direct', acuity: 4, complaint: 'Elective hip replacement', requestedUnit: 'Med-Surg', status: 'admitted', waitMin: 0, attending: 'Dr. Adams', requestedAt: '07:00', assignedBed: '204', assignedUnit: '2-WEST' },
  { id: 'ADM-006', name: 'Patricia Chen', mrn: 'MRN-5529', source: 'ED', acuity: 2, complaint: 'GI bleed, hemodynamically unstable', requestedUnit: 'ICU', status: 'pending', waitMin: 55, attending: 'Dr. Patel', requestedAt: '08:05' },
  { id: 'ADM-007', name: 'David Brown', mrn: 'MRN-7746', source: 'Transfer', acuity: 3, complaint: 'Stroke, tPA administered at OSH', requestedUnit: 'Stepdown', status: 'in_transit', waitMin: 40, attending: 'Dr. Nguyen', requestedAt: '08:20' },
];

export interface AdmitFlowProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  /** When true, renders as inline desktop layout instead of mobile overlay. */
  embedded?: boolean;
  /** Mutable bed units from App — used for bed picker */
  bedUnits?: BedUnit[];
  /** Mutable admission queue from App */
  admissionQueue?: AdmissionEntry[];
  /** Callback to assign a bed to a queue entry */
  onAssignBed?: (admissionId: string, bedId: string) => void;
  /** Callback to submit a new admission (demographics included). `bedId` optional — if present, patient is placed immediately. */
  onSubmitAdmission?: (entry: Omit<AdmissionEntry, 'id' | 'status' | 'waitMin' | 'requestedAt'>, bedId?: string) => void;
  /** Navigate to patient tab */
  onNavigateToPatient?: (patientId: string) => void;
}

type Step = 'identity' | 'bed' | 'confirm';

const STEP_ORDER: Step[] = ['identity', 'bed', 'confirm'];

const STEP_LABELS: Record<Step, string> = {
  identity: 'Patient ID',
  bed: 'Bed Assignment',
  confirm: 'Confirm Admission',
};

// ─────────────────────────────────────────────────────────────────────────
// Mock patient for admission
// ─────────────────────────────────────────────────────────────────────────

const MOCK_PATIENT = {
  name: 'Maria Gonzalez',
  age: 58,
  sex: 'F' as const,
  mrn: 'MRN-7712',
  chiefComplaint: 'Chest pain radiating to jaw',
  arrivalMode: 'EMS' as const,
  esi: 2 as const,
  timestamp: new Date().toISOString(),
};

// ─────────────────────────────────────────────────────────────────────────
// Bed state color helper
// ─────────────────────────────────────────────────────────────────────────

function bedStateColor(state: BedType['state']): string {
  switch (state) {
    case 'ready':
      return COLORS.ok;
    case 'occupied':
      return COLORS.info;
    case 'dirty':
      return COLORS.warn;
    case 'not_staffed':
      return COLORS.warn;
    case 'blocked':
      return COLORS.crit;
    case 'reserved':
      return '#A855F7'; // purple
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const AdmitFlow: React.FC<AdmitFlowProps> = ({ open, onClose, showToast, embedded, bedUnits: externalBedUnits, admissionQueue: externalQueue, onAssignBed, onSubmitAdmission, onNavigateToPatient }) => {
  const [step, setStep] = useState<Step>('identity');
  const [selectedBed, setSelectedBed] = useState<BedType | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<BedUnit | null>(null);
  const [admitted, setAdmitted] = useState(false);

  const stepIndex = STEP_ORDER.indexOf(step);

  // Gather available beds from all non-surge units
  const availableBeds = useMemo(() => {
    const results: { bed: BedType; unit: BedUnit }[] = [];
    for (const unit of HOSPITAL_UNITS) {
      if (unit.surgeOnly) continue;
      for (const bed of unit.beds) {
        if (bed.state === 'ready') {
          results.push({ bed, unit });
        }
      }
    }
    return results;
  }, []);

  const reset = () => {
    setStep('identity');
    setSelectedBed(null);
    setSelectedUnit(null);
    setAdmitted(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const goNext = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx < STEP_ORDER.length - 1) setStep(STEP_ORDER[idx + 1]);
  };

  const goBack = () => {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  };

  const handleAdmit = () => {
    setAdmitted(true);
    if (selectedBed && selectedUnit) {
      showToast(`Admitted ${MOCK_PATIENT.name} to ${selectedBed.label} (${selectedUnit.shortName})`);
    } else {
      showToast(`Admitted ${MOCK_PATIENT.name} — BED UNASSIGNED`);
    }
  };

  // ── Can proceed? ──────────────────────────────────────────────────────
  const canProceed =
    step === 'identity'
      ? true
      : step === 'bed'
      ? true
      : !admitted;

  // ── Render helpers ────────────────────────────────────────────────────

  const renderStepIndicator = () => (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, padding: `${SPACE.md}px ${SPACE.base}px` }}>
      {STEP_ORDER.map((s, i) => {
        const isCurrent = s === step;
        const isDone = i < stepIndex;
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <div style={{ flex: 1, height: 1, background: isDone ? COLORS.accent : COLORS.border }} />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: RADIUS.full,
                  background: isDone ? COLORS.accent : isCurrent ? COLORS.accentDim : COLORS.surface,
                  border: `1.5px solid ${isDone || isCurrent ? COLORS.accent : COLORS.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontFamily: FONTS.mono,
                  fontWeight: 600,
                  color: isDone ? COLORS.textPrimary : isCurrent ? COLORS.accent : COLORS.textMuted,
                }}
              >
                {isDone ? '\u2713' : i + 1}
              </div>
              <Mono tone={isCurrent ? 'accent' : isDone ? 'primary' : 'muted'} size="xs">
                {STEP_LABELS[s]}
              </Mono>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );

  // ── Step 1: Patient identification ────────────────────────────────────
  const renderIdentity = () => (
    <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
      <TacticalCard accentBar padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.md }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: RADIUS.full,
              background: COLORS.accentDim,
              border: `1.5px solid ${COLORS.accent}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={20} color={COLORS.accent} />
          </div>
          <div>
            <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.h3.size, fontWeight: TYPE.h3.weight, color: COLORS.textPrimary }}>
              {MOCK_PATIENT.name}
            </div>
            <Mono tone="secondary" size="sm">
              {MOCK_PATIENT.age}{MOCK_PATIENT.sex} &middot; {MOCK_PATIENT.mrn}
            </Mono>
          </div>
        </div>

        <Divider style={{ margin: `${SPACE.sm}px 0` }} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, marginTop: SPACE.md }}>
          <InfoRow label="Chief Complaint" value={MOCK_PATIENT.chiefComplaint} />
          <InfoRow label="Arrival Mode" value={MOCK_PATIENT.arrivalMode} />
          <InfoRow
            label="ESI Level"
            value={`ESI ${MOCK_PATIENT.esi}`}
            valueColor={COLORS.crit}
          />
          <InfoRow
            label="Timestamp"
            value={new Date(MOCK_PATIENT.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          />
        </div>
      </TacticalCard>

      <TacticalCard padding="md">
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
          <ClipboardList size={15} color={COLORS.textMuted} />
          <Mono tone="muted" size="xs">Pre-Admission Checklist</Mono>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          <CheckItem checked label="Identity verified (wristband + verbal)" />
          <CheckItem checked label="Allergies confirmed (NKA)" />
          <CheckItem checked label="ESI triage completed" />
          <CheckItem checked label="EMS handoff received" />
        </div>
      </TacticalCard>
    </div>
  );

  // ── Step 2: Bed assignment ────────────────────────────────────────────
  const renderBedAssignment = () => {
    // Group available beds by unit
    const grouped = new Map<string, { unit: BedUnit; beds: BedType[] }>();
    for (const { bed, unit } of availableBeds) {
      if (!grouped.has(unit.id)) grouped.set(unit.id, { unit, beds: [] });
      grouped.get(unit.id)!.beds.push(bed);
    }

    return (
      <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
        <TacticalButton
          variant="secondary"
          fullWidth
          onClick={() => {
            setSelectedBed(null);
            setSelectedUnit(null);
            goNext();
          }}
        >
          Skip &mdash; Assign Bed Later
        </TacticalButton>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Mono tone="secondary" size="sm">
            Available Beds
          </Mono>
          <StatusPill label={`${availableBeds.length} READY`} tone="ok" pulse />
        </div>

        {Array.from(grouped.entries()).map(([unitId, { unit, beds }]) => (
          <div key={unitId}>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
              <BracketLabel tone="secondary" size="xs">{unit.shortName}</BracketLabel>
              {unit.floor && <Mono tone="dim" size="xs">Floor {unit.floor}</Mono>}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.sm }}>
              {beds.map((bed) => {
                const isSelected = selectedBed?.id === bed.id;
                return (
                  <motion.button
                    key={bed.id}
                    onClick={() => {
                      setSelectedBed(bed);
                      setSelectedUnit(unit);
                    }}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      position: 'relative',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 4,
                      padding: `${SPACE.md}px ${SPACE.base}px`,
                      minWidth: 72,
                      background: isSelected ? COLORS.accentDim : COLORS.surface,
                      border: `1.5px solid ${isSelected ? COLORS.accent : COLORS.border}`,
                      borderRadius: RADIUS.sm,
                      cursor: 'pointer',
                      transition: `all ${MOTION.fast}s ease`,
                      outline: 'none',
                    }}
                  >
                    {isSelected && (
                      <>
                        <CornerBracket position="tl" size={8} />
                        <CornerBracket position="tr" size={8} />
                        <CornerBracket position="bl" size={8} />
                        <CornerBracket position="br" size={8} />
                      </>
                    )}
                    <Bed size={17} color={isSelected ? COLORS.accent : COLORS.ok} />
                    <Mono tone={isSelected ? 'accent' : 'primary'} size="sm">{bed.label}</Mono>
                    {bed.assignedNurse && (
                      <Mono tone="muted" size="xs">{bed.assignedNurse}</Mono>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </div>
        ))}

        {selectedBed && selectedUnit && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.fast, ease: MOTION.ease }}
          >
            <TacticalCard highlight padding="md">
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                <CheckCircle2 size={15} color={COLORS.ok} />
                <Mono tone="ok" size="sm">Selected Bed</Mono>
              </div>
              <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.h3.size, fontWeight: TYPE.h3.weight, color: COLORS.textPrimary }}>
                {selectedBed.label} &mdash; {selectedUnit.name}
              </div>
              {selectedBed.assignedNurse && (
                <Mono tone="secondary" size="sm" style={{ marginTop: 4 }}>
                  Nurse: {selectedBed.assignedNurse}
                </Mono>
              )}
            </TacticalCard>
          </motion.div>
        )}
      </div>
    );
  };

  // ── Step 3: Confirmation ──────────────────────────────────────────────
  const renderConfirmation = () => {
    if (admitted) {
      return (
        <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
          >
            <TacticalCard highlight accentBar padding="lg">
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                <ScanningLine duration={6} />
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, marginBottom: SPACE.base }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: RADIUS.full,
                      background: COLORS.okDim,
                      border: `1.5px solid ${COLORS.ok}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle2 size={20} color={COLORS.ok} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.h3.size, fontWeight: TYPE.h3.weight, color: COLORS.ok }}>
                      Patient Admitted
                    </div>
                    <Mono tone="secondary" size="xs">
                      Encounter created &middot; {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Mono>
                  </div>
                </div>

                <Divider style={{ margin: `${SPACE.sm}px 0` }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, marginTop: SPACE.md }}>
                  <InfoRow label="Patient" value={`${MOCK_PATIENT.name}, ${MOCK_PATIENT.age}${MOCK_PATIENT.sex}`} />
                  <InfoRow label="MRN" value={MOCK_PATIENT.mrn} />
                  <InfoRow label="Chief Complaint" value={MOCK_PATIENT.chiefComplaint} />
                  <InfoRow label="ESI" value={`Level ${MOCK_PATIENT.esi}`} valueColor={COLORS.crit} />
                  <InfoRow
                    label="Bed"
                    value={selectedBed && selectedUnit ? `${selectedBed.label} — ${selectedUnit.name}` : 'UNASSIGNED — Holding Area'}
                    valueColor={!selectedBed ? COLORS.warn : undefined}
                  />
                  {selectedBed?.assignedNurse && (
                    <InfoRow label="Assigned Nurse" value={selectedBed.assignedNurse} />
                  )}
                  <InfoRow label="Encounter Class" value="EMERGENCY" />
                  <InfoRow label="Arrival Mode" value={MOCK_PATIENT.arrivalMode} />
                </div>

                {!selectedBed && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.sm,
                      marginTop: SPACE.md,
                      padding: `${SPACE.md}px ${SPACE.base}px`,
                      background: `${COLORS.warn}14`,
                      border: `1px solid ${COLORS.warn}40`,
                      borderRadius: RADIUS.sm,
                    }}
                  >
                    <AlertTriangle size={15} color={COLORS.warn} style={{ flexShrink: 0 }} />
                    <Mono tone="warn" size="xs">No bed assigned — patient in holding area</Mono>
                  </div>
                )}
              </div>
            </TacticalCard>
          </motion.div>

          <TacticalButton variant="secondary" fullWidth onClick={handleClose}>
            Close
          </TacticalButton>
        </div>
      );
    }

    return (
      <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
        <TacticalCard padding="md">
          <BracketLabel tone="accent" size="sm" style={{ marginBottom: SPACE.md, display: 'block' }}>
            Admission Summary
          </BracketLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            <InfoRow label="Patient" value={`${MOCK_PATIENT.name}, ${MOCK_PATIENT.age}${MOCK_PATIENT.sex}`} />
            <InfoRow label="MRN" value={MOCK_PATIENT.mrn} />
            <InfoRow label="Chief Complaint" value={MOCK_PATIENT.chiefComplaint} />
            <InfoRow label="ESI" value={`Level ${MOCK_PATIENT.esi}`} valueColor={COLORS.crit} />
            <InfoRow
              label="Bed"
              value={selectedBed && selectedUnit ? `${selectedBed.label} — ${selectedUnit.name}` : 'UNASSIGNED — Holding Area'}
              valueColor={!selectedBed ? COLORS.warn : undefined}
            />
            {selectedBed?.assignedNurse && (
              <InfoRow label="Assigned Nurse" value={selectedBed.assignedNurse} />
            )}
            <InfoRow label="Encounter Class" value="EMERGENCY" />
            <InfoRow label="Arrival Mode" value={MOCK_PATIENT.arrivalMode} />
          </div>

          {!selectedBed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                marginTop: SPACE.md,
                padding: `${SPACE.md}px ${SPACE.base}px`,
                background: `${COLORS.warn}14`,
                border: `1px solid ${COLORS.warn}40`,
                borderRadius: RADIUS.sm,
              }}
            >
              <AlertTriangle size={15} color={COLORS.warn} style={{ flexShrink: 0 }} />
              <Mono tone="warn" size="xs">No bed assigned — patient in holding area</Mono>
            </div>
          )}
        </TacticalCard>

        <div style={{ padding: `0 ${SPACE.xs}px` }}>
          <Mono tone="muted" size="xs">
            {selectedBed
              ? `This will create a new encounter and mark bed ${selectedBed.label} as occupied.`
              : 'This will create a new encounter. No bed will be assigned — patient will be in the holding area.'}
          </Mono>
        </div>

        <TacticalButton variant="primary" fullWidth onClick={handleAdmit}>
          Confirm Admission
        </TacticalButton>
      </div>
    );
  };

  // ── Desktop form state ─────────────────────────────────────────────────
  const [formData, setFormData] = useState({
    // Demographics
    firstName: '', lastName: '', dob: '', sex: '', mrn: '', insurance: '', emergencyContact: '',
    preferredLanguage: 'en', needsInterpreter: false, weightKg: '', heightCm: '',
    // Clinical
    complaint: '', attending: '', esi: 3, isolation: 'NONE',
    codeStatus: 'FULL', arrivalMode: 'ems',
    // Vitals
    hr: '', systolic: '', diastolic: '', rr: '', spo2: '', temp: '', painScore: '', gcs: '15',
    // Allergies (up to 3 slots)
    allergies: [
      { substance: '', reaction: '', severity: 'mild' as 'mild' | 'moderate' | 'severe' | 'life-threatening' },
      { substance: '', reaction: '', severity: 'mild' as 'mild' | 'moderate' | 'severe' | 'life-threatening' },
      { substance: '', reaction: '', severity: 'mild' as 'mild' | 'moderate' | 'severe' | 'life-threatening' },
    ],
    // Problems (up to 3 slots)
    problems: [
      { display: '', icd10: '', status: 'active' as 'active' | 'resolved' | 'inactive' },
      { display: '', icd10: '', status: 'active' as 'active' | 'resolved' | 'inactive' },
      { display: '', icd10: '', status: 'active' as 'active' | 'resolved' | 'inactive' },
    ],
    // Bed request
    requestedUnit: '', specialReqs: '', priority: 'routine',
  });
  const [queueFilter, setQueueFilter] = useState<'all' | 'pending' | 'placing' | 'in_transit' | 'admitted'>('all');
  // Bed picker state for "Assign Bed" action
  const [assigningAdmissionId, setAssigningAdmissionId] = useState<string | null>(null);
  // Patient info dropdown
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);

  // ── Main render ───────────────────────────────────────────────────────

  // ── Embedded mode: desktop admissions command center ──
  if (embedded) {
    const ADMISSION_QUEUE = externalQueue ?? INITIAL_ADMISSION_QUEUE;
    const bedData = externalBedUnits ?? HOSPITAL_UNITS;

    type QueueStatus = AdmissionStatus;
    type QueueSource = AdmissionSource;

    const sourceColor: Record<QueueSource, string> = {
      ED: COLORS.crit,
      OR: COLORS.info,
      Transfer: '#A855F7',
      Direct: COLORS.ok,
    };

    const statusDotColor: Record<QueueStatus, string> = {
      pending: COLORS.warn,
      placing: COLORS.info,
      in_transit: '#A855F7',
      admitted: COLORS.ok,
    };

    const statusLabel: Record<QueueStatus, string> = {
      pending: 'PENDING BED',
      placing: 'PLACING',
      in_transit: 'IN TRANSIT',
      admitted: 'ADMITTED',
    };

    const acuityColor = (a: number) =>
      a <= 2 ? COLORS.crit : a === 3 ? COLORS.warn : COLORS.ok;

    const filteredQueue = queueFilter === 'all'
      ? ADMISSION_QUEUE
      : ADMISSION_QUEUE.filter(q => q.status === queueFilter);

    const countByStatus = (s: QueueStatus) => ADMISSION_QUEUE.filter(q => q.status === s).length;
    const pendingCount = countByStatus('pending');
    const placingCount = countByStatus('placing') + countByStatus('in_transit');
    const admittedCount = countByStatus('admitted');

    const FILTER_TABS: { key: typeof queueFilter; label: string }[] = [
      { key: 'all', label: 'All' },
      { key: 'pending', label: 'Pending' },
      { key: 'placing', label: 'Placing' },
      { key: 'in_transit', label: 'In Transit' },
      { key: 'admitted', label: 'Admitted' },
    ];

    const inputStyle: React.CSSProperties = {
      width: '100%',
      height: 36,
      padding: `0 ${SPACE.md}px`,
      fontFamily: FONTS.sans,
      fontSize: TYPE.bodySm.size,
      color: COLORS.textPrimary,
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      outline: 'none',
      transition: `border-color ${MOTION.fast}s ease`,
    };

    const selectStyle: React.CSSProperties = {
      ...inputStyle,
      appearance: 'none' as const,
      WebkitAppearance: 'none' as const,
      backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23525252' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
      backgroundRepeat: 'no-repeat',
      backgroundPosition: `right ${SPACE.md}px center`,
      paddingRight: SPACE['2xl'],
    };

    const labelStyle: React.CSSProperties = {
      fontFamily: FONTS.mono,
      fontSize: TYPE.monoXs.size,
      fontWeight: TYPE.monoXs.weight,
      letterSpacing: TYPE.monoXs.tracking,
      textTransform: 'uppercase',
      color: COLORS.textMuted,
      marginBottom: SPACE.xs,
    };

    return (
      <div
        style={{
          position: 'relative',
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.bg,
          overflow: 'hidden',
          fontFamily: FONTS.sans,
          color: COLORS.textPrimary,
        }}
      >
        {/* ── Header strip ──────────────────────────────────────────── */}
        <HudStrip side="top">
          <BracketLabel tone="accent" size="sm">Admissions Command Center</BracketLabel>
          <div style={{ flex: 1 }} />
          <StatusPill label={`${ADMISSION_QUEUE.length} ACTIVE`} tone="info" pulse />
        </HudStrip>

        {/* ── Summary bar ───────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACE['2xl'],
            padding: `${SPACE.md}px ${SPACE.lg}px`,
            background: COLORS.surface,
            borderBottom: `1px solid ${COLORS.border}`,
            flexShrink: 0,
          }}
        >
          <SummaryStatDesktop label="Pending" value={pendingCount} color={COLORS.warn} />
          <div style={{ width: 1, height: 32, background: COLORS.border }} />
          <SummaryStatDesktop label="In Progress" value={placingCount} color={COLORS.info} />
          <div style={{ width: 1, height: 32, background: COLORS.border }} />
          <SummaryStatDesktop label="Admitted Today" value={admittedCount} color={COLORS.ok} />
        </div>

        {/* ── Two-column body ───────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {/* ── LEFT: Admissions queue (60%) ──────────────────────── */}
          <div
            style={{
              flex: '0 0 60%',
              display: 'flex',
              flexDirection: 'column',
              borderRight: `1px solid ${COLORS.border}`,
              overflow: 'hidden',
            }}
          >
            {/* Pipeline filter tabs */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.xs,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                flexShrink: 0,
              }}
            >
              <Filter size={13} color={COLORS.textMuted} />
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setQueueFilter(tab.key)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 28,
                    padding: `0 ${SPACE.md}px`,
                    fontFamily: FONTS.mono,
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: queueFilter === tab.key ? COLORS.textPrimary : COLORS.textMuted,
                    background: queueFilter === tab.key ? COLORS.accentDim : 'transparent',
                    border: `1px solid ${queueFilter === tab.key ? COLORS.accent : COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    cursor: 'pointer',
                    transition: `all ${MOTION.fast}s ease`,
                    outline: 'none',
                  }}
                >
                  {tab.key !== 'all' && (
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: RADIUS.full,
                        background: statusDotColor[tab.key as QueueStatus] ?? COLORS.textMuted,
                      }}
                    />
                  )}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Queue entries */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: SPACE.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.md,
              }}
            >
              {filteredQueue.map(entry => (
                <TacticalCard
                  key={entry.id}
                  interactive
                  padding="md"
                  style={{
                    borderLeft: `3px solid ${acuityColor(entry.acuity)}`,
                  }}
                >
                  {/* Top row: name + source + acuity */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: FONTS.sans,
                        fontSize: TYPE.h4.size,
                        fontWeight: TYPE.h4.weight,
                        color: COLORS.textPrimary,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {entry.name}
                      </div>
                      <Mono tone="muted" size="xs">{entry.mrn}</Mono>
                    </div>
                    {/* Source badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        height: 20,
                        padding: `0 ${SPACE.sm}px`,
                        fontFamily: FONTS.mono,
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: sourceColor[entry.source],
                        background: `${sourceColor[entry.source]}18`,
                        border: `1px solid ${sourceColor[entry.source]}30`,
                        borderRadius: RADIUS.full,
                      }}
                    >
                      {entry.source}
                    </span>
                    {/* Acuity badge */}
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 24,
                        height: 24,
                        fontFamily: FONTS.mono,
                        fontSize: 12,
                        fontWeight: 700,
                        color: acuityColor(entry.acuity),
                        background: `${acuityColor(entry.acuity)}18`,
                        border: `1px solid ${acuityColor(entry.acuity)}30`,
                        borderRadius: RADIUS.sm,
                      }}
                    >
                      {entry.acuity}
                    </span>
                  </div>

                  {/* Chief complaint */}
                  <div style={{
                    fontFamily: FONTS.sans,
                    fontSize: TYPE.bodySm.size,
                    color: COLORS.textSecondary,
                    marginBottom: SPACE.md,
                  }}>
                    {entry.complaint}
                  </div>

                  {/* ── Prominent ASSIGN BED CTA — full width, centered ── */}
                  {entry.status !== 'admitted' && (
                    <motion.button
                      type="button"
                      whileHover={{ scale: assigningAdmissionId === entry.id ? 1 : 1.005 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        setAssigningAdmissionId(assigningAdmissionId === entry.id ? null : entry.id);
                        setExpandedEntryId(null);
                      }}
                      style={{
                        position: 'relative',
                        width: '100%',
                        minHeight: 48,
                        marginBottom: SPACE.md,
                        padding: `${SPACE.sm}px ${SPACE.md}px`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: SPACE.sm,
                        background: assigningAdmissionId === entry.id
                          ? COLORS.accentDim
                          : `linear-gradient(180deg, ${COLORS.accent} 0%, ${COLORS.accentDeep} 100%)`,
                        border: `1px solid ${COLORS.accent}`,
                        borderRadius: RADIUS.sm,
                        color: assigningAdmissionId === entry.id ? COLORS.accent : COLORS.textPrimary,
                        fontFamily: FONTS.mono,
                        fontSize: 13,
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        boxShadow: assigningAdmissionId === entry.id
                          ? undefined
                          : `0 0 14px ${COLORS.accent}44`,
                        transition: `background ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease, color ${MOTION.fast}s ease`,
                      }}
                    >
                      <CornerBracket position="tl" color={COLORS.accent} size={8} thickness={1.5} />
                      <CornerBracket position="tr" color={COLORS.accent} size={8} thickness={1.5} />
                      <CornerBracket position="bl" color={COLORS.accent} size={8} thickness={1.5} />
                      <CornerBracket position="br" color={COLORS.accent} size={8} thickness={1.5} />
                      <Bed size={15} />
                      {assigningAdmissionId === entry.id ? 'Close Bed Picker' : 'Assign Bed'}
                    </motion.button>
                  )}

                  {/* Status + meta row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, flexWrap: 'wrap' }}>
                    {/* Status pill with dot */}
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontFamily: FONTS.mono,
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: statusDotColor[entry.status],
                    }}>
                      <span style={{
                        width: 6,
                        height: 6,
                        borderRadius: RADIUS.full,
                        background: statusDotColor[entry.status],
                        boxShadow: `0 0 6px ${statusDotColor[entry.status]}`,
                      }} />
                      {statusLabel[entry.status]}
                    </span>

                    <Mono tone="muted" size="xs">Req: {entry.requestedUnit}</Mono>
                    <Mono tone="muted" size="xs">Att: {entry.attending}</Mono>

                    {entry.waitMin > 0 && (
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        fontFamily: FONTS.mono,
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: '0.1em',
                        color: entry.waitMin > 60 ? COLORS.crit : entry.waitMin > 30 ? COLORS.warn : COLORS.textMuted,
                      }}>
                        <Clock size={11} />
                        {entry.waitMin}m
                      </span>
                    )}

                    <div style={{ flex: 1 }} />

                    {/* Secondary action buttons */}
                    {entry.status !== 'admitted' ? (
                      <TacticalButton variant="ghost" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); setExpandedEntryId(expandedEntryId === entry.id ? null : entry.id); setAssigningAdmissionId(null); }}>
                        Info
                      </TacticalButton>
                    ) : (
                      <div style={{ display: 'flex', gap: SPACE.sm, alignItems: 'center' }}>
                        <Mono tone="ok" size="xs">{entry.assignedBed} ({entry.assignedUnit})</Mono>
                        {onNavigateToPatient && (
                          <TacticalButton variant="ghost" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onNavigateToPatient(entry.mrn); }}>
                            Open Chart
                          </TacticalButton>
                        )}
                      </div>
                    )}
                  </div>

                  {/* ── Expanded patient info dropdown ── */}
                  <AnimatePresence>
                    {expandedEntryId === entry.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: MOTION.fast }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                          gap: `${SPACE.sm}px ${SPACE.base}px`,
                          padding: `${SPACE.md}px 0 ${SPACE.sm}px`,
                          marginTop: SPACE.sm,
                          borderTop: `1px solid ${COLORS.border}`,
                        }}>
                          <div><Mono tone="muted" size="xs">Source</Mono><div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary, marginTop: 2 }}>{entry.source}</div></div>
                          <div><Mono tone="muted" size="xs">Requested</Mono><div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary, marginTop: 2 }}>{entry.requestedUnit}</div></div>
                          <div><Mono tone="muted" size="xs">Attending</Mono><div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary, marginTop: 2 }}>{entry.attending}</div></div>
                          <div><Mono tone="muted" size="xs">ESI Level</Mono><div style={{ fontFamily: FONTS.mono, fontSize: 13, color: acuityColor(entry.acuity), marginTop: 2 }}>ESI {entry.acuity}</div></div>
                          <div><Mono tone="muted" size="xs">Wait Time</Mono><div style={{ fontFamily: FONTS.mono, fontSize: 13, color: entry.waitMin > 60 ? COLORS.crit : COLORS.textPrimary, marginTop: 2 }}>{entry.waitMin}m</div></div>
                          <div><Mono tone="muted" size="xs">Requested At</Mono><div style={{ fontFamily: FONTS.mono, fontSize: 13, color: COLORS.textPrimary, marginTop: 2 }}>{entry.requestedAt}</div></div>
                        </div>
                        {onNavigateToPatient && (
                          <TacticalButton variant="ghost" size="sm" onClick={() => onNavigateToPatient(entry.mrn)}>
                            Open Full Chart
                          </TacticalButton>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── Bed picker dropdown ── */}
                  <AnimatePresence>
                    {assigningAdmissionId === entry.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: MOTION.fast }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{
                          padding: `${SPACE.md}px 0 ${SPACE.sm}px`,
                          marginTop: SPACE.sm,
                          borderTop: `1px solid ${COLORS.accent}40`,
                        }}>
                          <Mono tone="accent" size="xs" style={{ marginBottom: SPACE.sm, display: 'block' }}>
                            Select Available Bed
                          </Mono>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm, maxHeight: 200, overflowY: 'auto' }}>
                            {bedData.filter(u => !u.surgeOnly).map(unit => {
                              const readyBeds = unit.beds.filter(b => b.state === 'ready');
                              if (readyBeds.length === 0) return null;
                              return (
                                <div key={unit.id}>
                                  <Mono tone="muted" size="xs" style={{ marginBottom: 4, display: 'block' }}>{unit.shortName}</Mono>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.xs }}>
                                    {readyBeds.map(bed => (
                                      <button
                                        key={bed.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (onAssignBed) {
                                            onAssignBed(entry.id, bed.id);
                                            setAssigningAdmissionId(null);
                                          }
                                        }}
                                        style={{
                                          padding: `4px ${SPACE.md}px`,
                                          fontFamily: FONTS.mono,
                                          fontSize: 12,
                                          fontWeight: 600,
                                          color: COLORS.ok,
                                          background: 'rgba(16,185,129,0.08)',
                                          border: `1px solid ${COLORS.ok}40`,
                                          borderRadius: RADIUS.sm,
                                          cursor: 'pointer',
                                          transition: `all ${MOTION.fast}s ease`,
                                        }}
                                        onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(16,185,129,0.2)'; }}
                                        onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(16,185,129,0.08)'; }}
                                      >
                                        {bed.label}{bed.assignedNurse ? ` (${bed.assignedNurse})` : ''}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </TacticalCard>
              ))}

              {filteredQueue.length === 0 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: SPACE['3xl'],
                }}>
                  <Mono tone="muted" size="sm">No admissions matching filter</Mono>
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: New admission form (40%) ──────────────────── */}
          <div
            style={{
              flex: '0 0 40%',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Form header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                flexShrink: 0,
              }}
            >
              <Plus size={15} color={COLORS.accent} />
              <BracketLabel tone="accent" size="xs">New Admission Request</BracketLabel>
            </div>

            {/* Form body */}
            <div
              style={{
                flex: 1,
                overflow: 'auto',
                padding: SPACE.lg,
                display: 'flex',
                flexDirection: 'column',
                gap: SPACE.lg,
              }}
            >
              {/* ═══ Section 1: Patient Demographics ═══ */}
              <div>
                <Mono tone="accent" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
                  1 &mdash; Patient Demographics
                </Mono>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                  <div style={{ display: 'flex', gap: SPACE.md }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>First Name *</div>
                      <input type="text" placeholder="Given name" value={formData.firstName} onChange={e => setFormData(p => ({ ...p, firstName: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Last Name *</div>
                      <input type="text" placeholder="Family name" value={formData.lastName} onChange={e => setFormData(p => ({ ...p, lastName: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 0, minWidth: 120 }}>
                      <div style={labelStyle}>MRN</div>
                      <input type="text" placeholder="MRN-0000" value={formData.mrn} onChange={e => setFormData(p => ({ ...p, mrn: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: SPACE.md }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Date of Birth</div>
                      <input type="text" placeholder="MM/DD/YYYY" value={formData.dob} onChange={e => setFormData(p => ({ ...p, dob: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 0, minWidth: 80 }}>
                      <div style={labelStyle}>Sex</div>
                      <select value={formData.sex} onChange={e => setFormData(p => ({ ...p, sex: e.target.value }))} style={selectStyle}>
                        <option value="">--</option>
                        <option value="M">M</option>
                        <option value="F">F</option>
                        <option value="X">X</option>
                      </select>
                    </div>
                    <div style={{ flex: 0, minWidth: 80 }}>
                      <div style={labelStyle}>Weight (kg)</div>
                      <input type="number" placeholder="kg" value={formData.weightKg} onChange={e => setFormData(p => ({ ...p, weightKg: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 0, minWidth: 80 }}>
                      <div style={labelStyle}>Height (cm)</div>
                      <input type="number" placeholder="cm" value={formData.heightCm} onChange={e => setFormData(p => ({ ...p, heightCm: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: SPACE.md }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Insurance / Payer</div>
                      <input type="text" placeholder="Payer name" value={formData.insurance} onChange={e => setFormData(p => ({ ...p, insurance: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Emergency Contact</div>
                      <input type="text" placeholder="Name / Phone" value={formData.emergencyContact} onChange={e => setFormData(p => ({ ...p, emergencyContact: e.target.value }))} style={inputStyle} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: SPACE.md }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Language</div>
                      <select value={formData.preferredLanguage} onChange={e => setFormData(p => ({ ...p, preferredLanguage: e.target.value }))} style={selectStyle}>
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="zh">Chinese</option>
                        <option value="ar">Arabic</option>
                        <option value="vi">Vietnamese</option>
                        <option value="ko">Korean</option>
                        <option value="tl">Tagalog</option>
                        <option value="ru">Russian</option>
                        <option value="fr">French</option>
                        <option value="pt">Portuguese</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    <div style={{ flex: 0, display: 'flex', alignItems: 'flex-end', gap: SPACE.sm, paddingBottom: 6 }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: FONTS.mono, fontSize: 11, letterSpacing: '0.08em', color: COLORS.textSecondary }}>
                        <input type="checkbox" checked={formData.needsInterpreter} onChange={e => setFormData(p => ({ ...p, needsInterpreter: e.target.checked }))} style={{ accentColor: COLORS.accent }} />
                        INTERPRETER
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <Divider />

              {/* ═══ Section 2: Clinical Info ═══ */}
              <div>
                <Mono tone="accent" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
                  2 &mdash; Clinical Info
                </Mono>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                  <div>
                    <div style={labelStyle}>Chief Complaint *</div>
                    <input type="text" placeholder="Reason for admission" value={formData.complaint} onChange={e => setFormData(p => ({ ...p, complaint: e.target.value }))} style={inputStyle} />
                  </div>
                  <div style={{ display: 'flex', gap: SPACE.md }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Attending</div>
                      <input type="text" placeholder="Dr. ..." value={formData.attending} onChange={e => setFormData(p => ({ ...p, attending: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ flex: 0, minWidth: 80 }}>
                      <div style={labelStyle}>ESI</div>
                      <select value={formData.esi} onChange={e => setFormData(p => ({ ...p, esi: Number(e.target.value) }))} style={selectStyle}>
                        {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>ESI {n}</option>)}
                      </select>
                    </div>
                    <div style={{ flex: 0, minWidth: 90 }}>
                      <div style={labelStyle}>Arrival</div>
                      <select value={formData.arrivalMode} onChange={e => setFormData(p => ({ ...p, arrivalMode: e.target.value }))} style={selectStyle}>
                        <option value="ems">EMS</option>
                        <option value="walk-in">Walk-in</option>
                        <option value="transfer">Transfer</option>
                        <option value="ambulatory">Private</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: SPACE.md }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Isolation</div>
                      <select value={formData.isolation} onChange={e => setFormData(p => ({ ...p, isolation: e.target.value }))} style={selectStyle}>
                        <option value="NONE">None</option>
                        <option value="CONTACT">Contact</option>
                        <option value="DROPLET">Droplet</option>
                        <option value="AIRBORNE">Airborne</option>
                        <option value="PROTECTIVE">Protective</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Code Status</div>
                      <select value={formData.codeStatus} onChange={e => setFormData(p => ({ ...p, codeStatus: e.target.value }))} style={selectStyle}>
                        <option value="FULL">Full Code</option>
                        <option value="DNR">DNR</option>
                        <option value="DNI">DNI</option>
                        <option value="DNR/DNI">DNR/DNI</option>
                        <option value="COMFORT">Comfort Only</option>
                        <option value="LIMITED">Limited</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <Divider />

              {/* ═══ Section 3: Admission Vitals ═══ */}
              <div>
                <Mono tone="accent" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
                  3 &mdash; Admission Vitals
                </Mono>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: SPACE.md }}>
                  <div>
                    <div style={labelStyle}>HR (bpm)</div>
                    <input type="number" placeholder="--" value={formData.hr} onChange={e => setFormData(p => ({ ...p, hr: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>SBP (mmHg)</div>
                    <input type="number" placeholder="--" value={formData.systolic} onChange={e => setFormData(p => ({ ...p, systolic: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>DBP (mmHg)</div>
                    <input type="number" placeholder="--" value={formData.diastolic} onChange={e => setFormData(p => ({ ...p, diastolic: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>RR (/min)</div>
                    <input type="number" placeholder="--" value={formData.rr} onChange={e => setFormData(p => ({ ...p, rr: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>SpO2 (%)</div>
                    <input type="number" placeholder="--" value={formData.spo2} onChange={e => setFormData(p => ({ ...p, spo2: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Temp (&deg;C)</div>
                    <input type="number" step="0.1" placeholder="--" value={formData.temp} onChange={e => setFormData(p => ({ ...p, temp: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Pain (0-10)</div>
                    <input type="number" min="0" max="10" placeholder="--" value={formData.painScore} onChange={e => setFormData(p => ({ ...p, painScore: e.target.value }))} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>GCS (3-15)</div>
                    <input type="number" min="3" max="15" placeholder="15" value={formData.gcs} onChange={e => setFormData(p => ({ ...p, gcs: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>

              <Divider />

              {/* ═══ Section 4: Allergies ═══ */}
              <div>
                <Mono tone="accent" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
                  4 &mdash; Allergies
                </Mono>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                  {formData.allergies.map((allergy, i) => (
                    <div key={i} style={{ display: 'flex', gap: SPACE.sm, alignItems: 'flex-end' }}>
                      <div style={{ flex: 2 }}>
                        {i === 0 && <div style={labelStyle}>Substance</div>}
                        <input
                          type="text"
                          placeholder={i === 0 ? 'e.g. Penicillin' : 'Substance...'}
                          value={allergy.substance}
                          onChange={e => {
                            const updated = [...formData.allergies];
                            updated[i] = { ...updated[i], substance: e.target.value };
                            setFormData(p => ({ ...p, allergies: updated }));
                          }}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ flex: 2 }}>
                        {i === 0 && <div style={labelStyle}>Reaction</div>}
                        <input
                          type="text"
                          placeholder={i === 0 ? 'e.g. Anaphylaxis' : 'Reaction...'}
                          value={allergy.reaction}
                          onChange={e => {
                            const updated = [...formData.allergies];
                            updated[i] = { ...updated[i], reaction: e.target.value };
                            setFormData(p => ({ ...p, allergies: updated }));
                          }}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        {i === 0 && <div style={labelStyle}>Severity</div>}
                        <select
                          value={allergy.severity}
                          onChange={e => {
                            const updated = [...formData.allergies];
                            updated[i] = { ...updated[i], severity: e.target.value as typeof allergy.severity };
                            setFormData(p => ({ ...p, allergies: updated }));
                          }}
                          style={selectStyle}
                        >
                          <option value="mild">Mild</option>
                          <option value="moderate">Moderate</option>
                          <option value="severe">Severe</option>
                          <option value="life-threatening">Life-threatening</option>
                        </select>
                      </div>
                    </div>
                  ))}
                  <Mono tone="dim" size="xs">Leave blank for NKA (no known allergies)</Mono>
                </div>
              </div>

              <Divider />

              {/* ═══ Section 5: Problems / Diagnoses ═══ */}
              <div>
                <Mono tone="accent" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
                  5 &mdash; Problems / Diagnoses
                </Mono>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
                  {formData.problems.map((problem, i) => (
                    <div key={i} style={{ display: 'flex', gap: SPACE.sm, alignItems: 'flex-end' }}>
                      <div style={{ flex: 3 }}>
                        {i === 0 && <div style={labelStyle}>Diagnosis</div>}
                        <input
                          type="text"
                          placeholder={i === 0 ? 'e.g. Type 2 diabetes mellitus' : 'Diagnosis...'}
                          value={problem.display}
                          onChange={e => {
                            const updated = [...formData.problems];
                            updated[i] = { ...updated[i], display: e.target.value };
                            setFormData(p => ({ ...p, problems: updated }));
                          }}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        {i === 0 && <div style={labelStyle}>ICD-10</div>}
                        <input
                          type="text"
                          placeholder="Code"
                          value={problem.icd10}
                          onChange={e => {
                            const updated = [...formData.problems];
                            updated[i] = { ...updated[i], icd10: e.target.value };
                            setFormData(p => ({ ...p, problems: updated }));
                          }}
                          style={inputStyle}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        {i === 0 && <div style={labelStyle}>Status</div>}
                        <select
                          value={problem.status}
                          onChange={e => {
                            const updated = [...formData.problems];
                            updated[i] = { ...updated[i], status: e.target.value as typeof problem.status };
                            setFormData(p => ({ ...p, problems: updated }));
                          }}
                          style={selectStyle}
                        >
                          <option value="active">Active</option>
                          <option value="resolved">Resolved</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Divider />

              {/* ═══ Section 6: Bed Request ═══ */}
              <div>
                <Mono tone="accent" size="xs" style={{ marginBottom: SPACE.md, display: 'block' }}>
                  6 &mdash; Bed Request
                </Mono>
                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
                  <div style={{ display: 'flex', gap: SPACE.md }}>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Requested Unit</div>
                      <select value={formData.requestedUnit} onChange={e => setFormData(p => ({ ...p, requestedUnit: e.target.value }))} style={selectStyle}>
                        <option value="">Select unit...</option>
                        <option value="ICU">ICU</option>
                        <option value="Stepdown">Stepdown</option>
                        <option value="Med-Surg">Med-Surg</option>
                        <option value="Telemetry">Telemetry</option>
                        <option value="Peds">Pediatrics</option>
                        <option value="L&D">Labor & Delivery</option>
                      </select>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={labelStyle}>Priority</div>
                      <select value={formData.priority} onChange={e => setFormData(p => ({ ...p, priority: e.target.value }))} style={selectStyle}>
                        <option value="routine">Routine</option>
                        <option value="urgent">Urgent</option>
                        <option value="emergent">Emergent</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>Special Requirements</div>
                    <input type="text" placeholder="e.g. negative pressure, bariatric bed, telemetry monitor" value={formData.specialReqs} onChange={e => setFormData(p => ({ ...p, specialReqs: e.target.value }))} style={inputStyle} />
                  </div>
                </div>
              </div>

              {/* ═══ Submit ═══ */}
              <div style={{ paddingTop: SPACE.sm, paddingBottom: SPACE.lg }}>
                <TacticalButton
                  variant="primary"
                  fullWidth
                  onClick={() => {
                    if (onSubmitAdmission && formData.firstName && formData.lastName && formData.complaint) {
                      const fullName = `${formData.firstName} ${formData.lastName}`;
                      const filledAllergies = formData.allergies.filter(a => a.substance.trim());
                      const filledProblems = formData.problems.filter(p => p.display.trim());
                      onSubmitAdmission({
                        name: fullName,
                        mrn: formData.mrn || `MRN-${Math.floor(1000 + Math.random() * 9000)}`,
                        source: (formData.arrivalMode === 'transfer' ? 'Transfer' : formData.arrivalMode === 'ems' ? 'ED' : 'Direct') as AdmissionSource,
                        acuity: formData.esi,
                        complaint: formData.complaint,
                        requestedUnit: formData.requestedUnit || 'Med-Surg',
                        attending: formData.attending || 'TBD',
                        demographics: {
                          dob: formData.dob || undefined,
                          sex: (formData.sex || 'U') as 'M' | 'F' | 'X' | 'U',
                          insurance: formData.insurance || undefined,
                          emergencyContact: formData.emergencyContact || undefined,
                          isolation: formData.isolation !== 'NONE' ? formData.isolation : undefined,
                          codeStatus: formData.codeStatus !== 'FULL' ? formData.codeStatus : undefined,
                          preferredLanguage: formData.preferredLanguage !== 'en' ? formData.preferredLanguage : undefined,
                          needsInterpreter: formData.needsInterpreter || undefined,
                          weightKg: formData.weightKg ? Number(formData.weightKg) : undefined,
                          heightCm: formData.heightCm ? Number(formData.heightCm) : undefined,
                          arrivalMode: formData.arrivalMode,
                          vitals: (formData.hr || formData.systolic || formData.spo2) ? {
                            hr: formData.hr ? Number(formData.hr) : undefined,
                            systolic: formData.systolic ? Number(formData.systolic) : undefined,
                            diastolic: formData.diastolic ? Number(formData.diastolic) : undefined,
                            rr: formData.rr ? Number(formData.rr) : undefined,
                            spo2: formData.spo2 ? Number(formData.spo2) : undefined,
                            temp: formData.temp ? Number(formData.temp) : undefined,
                            painScore: formData.painScore ? Number(formData.painScore) : undefined,
                            gcs: formData.gcs ? Number(formData.gcs) : undefined,
                          } : undefined,
                          allergies: filledAllergies.length > 0 ? filledAllergies : undefined,
                          problems: filledProblems.length > 0 ? filledProblems : undefined,
                          specialReqs: formData.specialReqs || undefined,
                          priority: formData.priority !== 'routine' ? formData.priority : undefined,
                        },
                      });
                      // Reset form
                      setFormData({
                        firstName: '', lastName: '', dob: '', sex: '', mrn: '', insurance: '', emergencyContact: '',
                        preferredLanguage: 'en', needsInterpreter: false, weightKg: '', heightCm: '',
                        complaint: '', attending: '', esi: 3, isolation: 'NONE',
                        codeStatus: 'FULL', arrivalMode: 'ems',
                        hr: '', systolic: '', diastolic: '', rr: '', spo2: '', temp: '', painScore: '', gcs: '15',
                        allergies: [
                          { substance: '', reaction: '', severity: 'mild' },
                          { substance: '', reaction: '', severity: 'mild' },
                          { substance: '', reaction: '', severity: 'mild' },
                        ],
                        problems: [
                          { display: '', icd10: '', status: 'active' },
                          { display: '', icd10: '', status: 'active' },
                          { display: '', icd10: '', status: 'active' },
                        ],
                        requestedUnit: '', specialReqs: '', priority: 'routine',
                      });
                    } else {
                      showToast('Please fill in first name, last name, and chief complaint');
                    }
                  }}
                  icon={<Plus size={15} />}
                >
                  Submit Admission Request
                </TacticalButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="admit-flow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: Z.modal,
            background: COLORS.bg,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONTS.sans,
            color: COLORS.textPrimary,
            overflow: 'hidden',
          }}
        >
          {/* ── Header strip ──────────────────────────────────────────── */}
          <HudStrip side="top" fixed>
            <button
              onClick={handleClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                background: 'transparent',
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                color: COLORS.textSecondary,
                cursor: 'pointer',
              }}
            >
              <X size={15} />
            </button>
            <BracketLabel tone="accent" size="sm">Admit Patient</BracketLabel>
            <div style={{ flex: 1 }} />
            <StatusPill label="ESI 2" tone="crit" />
          </HudStrip>

          {/* ── Body ──────────────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              paddingTop: 56,
              paddingBottom: 72,
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {renderStepIndicator()}

            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: MOTION.fast, ease: MOTION.ease }}
              >
                {step === 'identity' && renderIdentity()}
                {step === 'bed' && renderBedAssignment()}
                {step === 'confirm' && renderConfirmation()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Footer navigation ─────────────────────────────────────── */}
          {!admitted && (
            <div
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
                padding: `${SPACE.md}px ${SPACE.base}px`,
                paddingBottom: `max(${SPACE.md}px, env(safe-area-inset-bottom))`,
                background: `linear-gradient(180deg, ${COLORS.bg}00 0%, ${COLORS.bg} 20%)`,
                borderTop: `1px solid ${COLORS.border}`,
                zIndex: Z.modal + 1,
              }}
            >
              {stepIndex > 0 && (
                <TacticalButton variant="ghost" onClick={goBack} icon={<ArrowLeft size={15} />}>
                  Back
                </TacticalButton>
              )}
              <div style={{ flex: 1 }} />
              {step !== 'confirm' && (
                <TacticalButton
                  variant="primary"
                  onClick={goNext}
                  disabled={!canProceed}
                  icon={<ArrowRight size={15} />}
                >
                  {step === 'bed' ? 'Review' : 'Next'}
                </TacticalButton>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

AdmitFlow.displayName = 'AdmitFlow';

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

const SummaryStatDesktop: React.FC<{ label: string; value: number; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
    <span
      style={{
        fontFamily: FONTS.sans,
        fontSize: 35,
        fontWeight: 700,
        letterSpacing: '-0.03em',
        lineHeight: 1,
        color,
      }}
    >
      {value}
    </span>
    <Mono tone="muted" size="xs">{label}</Mono>
  </div>
);

const InfoRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label,
  value,
  valueColor,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Mono tone="muted" size="xs">{label}</Mono>
    <span
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.bodySm.size,
        fontWeight: 500,
        color: valueColor ?? COLORS.textPrimary,
      }}
    >
      {value}
    </span>
  </div>
);

const CheckItem: React.FC<{ checked: boolean; label: string }> = ({ checked, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: RADIUS.sm,
        background: checked ? COLORS.okDim : COLORS.surface,
        border: `1.5px solid ${checked ? COLORS.ok : COLORS.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 11,
        color: COLORS.ok,
      }}
    >
      {checked && '\u2713'}
    </div>
    <span
      style={{
        fontFamily: FONTS.sans,
        fontSize: TYPE.bodySm.size,
        color: checked ? COLORS.textPrimary : COLORS.textMuted,
      }}
    >
      {label}
    </span>
  </div>
);
