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
  ArrowLeft,
  ArrowRight,
  Bed,
  CheckCircle2,
  ClipboardList,
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

export interface AdmitFlowProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
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

export const AdmitFlow: React.FC<AdmitFlowProps> = ({ open, onClose, showToast }) => {
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
    showToast(`Admitted ${MOCK_PATIENT.name} to ${selectedBed?.label} (${selectedUnit?.shortName})`);
  };

  // ── Can proceed? ──────────────────────────────────────────────────────
  const canProceed =
    step === 'identity'
      ? true
      : step === 'bed'
      ? selectedBed !== null
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
                  fontSize: 10,
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
            <User size={18} color={COLORS.accent} />
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
          <ClipboardList size={14} color={COLORS.textMuted} />
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
                    <Bed size={16} color={isSelected ? COLORS.accent : COLORS.ok} />
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
                <CheckCircle2 size={14} color={COLORS.ok} />
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
                    <CheckCircle2 size={18} color={COLORS.ok} />
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
                  <InfoRow label="Bed" value={`${selectedBed?.label} — ${selectedUnit?.name}`} />
                  {selectedBed?.assignedNurse && (
                    <InfoRow label="Assigned Nurse" value={selectedBed.assignedNurse} />
                  )}
                  <InfoRow label="Encounter Class" value="EMERGENCY" />
                  <InfoRow label="Arrival Mode" value={MOCK_PATIENT.arrivalMode} />
                </div>
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
            <InfoRow label="Bed" value={`${selectedBed?.label} — ${selectedUnit?.name}`} />
            {selectedBed?.assignedNurse && (
              <InfoRow label="Assigned Nurse" value={selectedBed.assignedNurse} />
            )}
            <InfoRow label="Encounter Class" value="EMERGENCY" />
            <InfoRow label="Arrival Mode" value={MOCK_PATIENT.arrivalMode} />
          </div>
        </TacticalCard>

        <div style={{ padding: `0 ${SPACE.xs}px` }}>
          <Mono tone="muted" size="xs">
            This will create a new encounter and mark bed {selectedBed?.label} as occupied.
          </Mono>
        </div>

        <TacticalButton variant="primary" fullWidth onClick={handleAdmit}>
          Confirm Admission
        </TacticalButton>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────

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
              <X size={14} />
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
                <TacticalButton variant="ghost" onClick={goBack} icon={<ArrowLeft size={14} />}>
                  Back
                </TacticalButton>
              )}
              <div style={{ flex: 1 }} />
              {step !== 'confirm' && (
                <TacticalButton
                  variant="primary"
                  onClick={goNext}
                  disabled={!canProceed}
                  icon={<ArrowRight size={14} />}
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
        fontSize: 10,
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
