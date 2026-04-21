/**
 * DischargeFlow — fullscreen overlay wizard that walks through discharging
 * a patient in three steps:
 *
 *   1. Readiness Checklist — verify discharge prerequisites are met
 *   2. Disposition — select where the patient is going
 *   3. Confirmation — discharge summary with timestamp
 *
 * Mock scenario: discharging Robert Fox (P003), the laceration repair
 * patient from Fast Track, with a simple "discharge to home" disposition.
 *
 * Props:
 *   open       — controls overlay visibility
 *   onClose    — dismiss the overlay
 *   showToast  — fire a toast notification to the parent shell
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Home,
  Building2,
  Ambulance,
  AlertTriangle,
  X,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION, cssTransition,
  TYPE,
  Z,
  SHADOW,
  MOBILE_NAV_OVERLAY_INSET_BOTTOM,
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

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface DischargeFlowProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  /** Synced patient list — allows selecting which patient to discharge */
  patients?: import('../../types').Patient[];
  /** Cross-device discharge callback — frees bed, updates queue & encounter */
  onDischargePatient?: (patientId: string) => void;
}

type Step = 'checklist' | 'disposition' | 'confirm';

const STEP_ORDER: Step[] = ['checklist', 'disposition', 'confirm'];

const STEP_LABELS: Record<Step, string> = {
  checklist: 'Readiness',
  disposition: 'Disposition',
  confirm: 'Confirm D/C',
};

type Disposition = 'home' | 'snf' | 'transfer' | 'ama';

interface DispositionOption {
  id: Disposition;
  label: string;
  description: string;
  icon: React.ReactNode;
  tone: 'ok' | 'info' | 'warn' | 'crit';
}

const DISPOSITIONS: DispositionOption[] = [
  {
    id: 'home',
    label: 'Home',
    description: 'Patient is safe to discharge home with or without home health services.',
    icon: <Home size={18} />,
    tone: 'ok',
  },
  {
    id: 'snf',
    label: 'Skilled Nursing Facility',
    description: 'Patient requires skilled nursing care beyond what can be provided at home.',
    icon: <Building2 size={18} />,
    tone: 'info',
  },
  {
    id: 'transfer',
    label: 'Transfer to Another Facility',
    description: 'Patient requires services not available at this facility.',
    icon: <Ambulance size={18} />,
    tone: 'warn',
  },
  {
    id: 'ama',
    label: 'Against Medical Advice',
    description: 'Patient is leaving against medical advice. AMA form and documentation required.',
    icon: <AlertTriangle size={18} />,
    tone: 'crit',
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Checklist items
// ─────────────────────────────────────────────────────────────────────────

interface ChecklistItem {
  id: string;
  label: string;
  detail: string;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'meds',
    label: 'Medications Reconciled',
    detail: 'Discharge prescriptions reviewed and transmitted to pharmacy.',
  },
  {
    id: 'followup',
    label: 'Follow-up Scheduled',
    detail: 'Patient has a follow-up appointment within recommended timeframe.',
  },
  {
    id: 'education',
    label: 'Patient Education Completed',
    detail: 'Wound care instructions, return precautions, and activity restrictions reviewed.',
  },
  {
    id: 'transport',
    label: 'Transport Arranged',
    detail: 'Patient has confirmed transportation from the facility.',
  },
  {
    id: 'belongings',
    label: 'Belongings Returned',
    detail: 'Personal belongings inventory checked and returned to patient.',
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Mock patient for discharge
// ─────────────────────────────────────────────────────────────────────────

const MOCK_PATIENT = {
  name: 'Robert Fox',
  id: 'P003',
  age: 34,
  sex: 'M' as const,
  mrn: 'MRN-4491',
  chiefComplaint: 'Laceration, right forearm',
  bed: 'FT-1',
  unit: 'ED — Fast Track',
  unitShort: 'FAST TRK',
  esi: 4 as const,
  admittedAt: '14:30',
  attendingPhysician: 'Dr. A. Chen',
  assignedNurse: 'A. Torres',
  procedures: 'Laceration repair (6 sutures, 4-0 nylon)',
};

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const DischargeFlow: React.FC<DischargeFlowProps> = ({ open, onClose, showToast, patients, onDischargePatient }) => {
  const [step, setStep] = useState<Step>('checklist');
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set());
  const [selectedDisposition, setSelectedDisposition] = useState<Disposition | null>(null);
  const [discharged, setDischarged] = useState(false);

  const stepIndex = STEP_ORDER.indexOf(step);

  const allChecked = CHECKLIST_ITEMS.every((item) => checkedItems.has(item.id));

  const reset = () => {
    setStep('checklist');
    setCheckedItems(new Set());
    setSelectedDisposition(null);
    setDischarged(false);
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

  const toggleCheck = (id: string) => {
    setCheckedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDischarge = () => {
    setDischarged(true);
    const dispLabel = DISPOSITIONS.find((d) => d.id === selectedDisposition)?.label ?? selectedDisposition;
    // Fire cross-device discharge if available (updates bed, queue, patient encounter)
    if (onDischargePatient) {
      // Use first admitted patient from synced list, or fall back to mock
      const target = patients?.find(p => p.currentEncounter?.status === 'in-progress');
      if (target) onDischargePatient(target.id);
    }
    showToast(`Discharged ${MOCK_PATIENT.name} — ${dispLabel}`);
  };

  // ── Can proceed? ──────────────────────────────────────────────────────
  const canProceed =
    step === 'checklist'
      ? allChecked
      : step === 'disposition'
      ? selectedDisposition !== null
      : !discharged;

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

  // ── Step 1: Readiness checklist ───────────────────────────────────────
  const renderChecklist = () => (
    <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
      {/* Patient context card */}
      <TacticalCard accentBar padding="md">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACE.sm }}>
          <div>
            <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.h3.size, fontWeight: TYPE.h3.weight, color: COLORS.textPrimary }}>
              {MOCK_PATIENT.name}
            </div>
            <Mono tone="secondary" size="sm">
              {MOCK_PATIENT.age}{MOCK_PATIENT.sex} &middot; {MOCK_PATIENT.mrn} &middot; {MOCK_PATIENT.bed}
            </Mono>
          </div>
          <StatusPill label={`ESI ${MOCK_PATIENT.esi}`} tone="info" />
        </div>
        <Divider style={{ margin: `${SPACE.xs}px 0` }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs, marginTop: SPACE.sm }}>
          <InfoRow label="Chief Complaint" value={MOCK_PATIENT.chiefComplaint} />
          <InfoRow label="Procedures" value={MOCK_PATIENT.procedures} />
        </div>
      </TacticalCard>

      {/* Checklist */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.md }}>
          <ClipboardCheck size={14} color={COLORS.textMuted} />
          <Mono tone="secondary" size="sm">Discharge Readiness</Mono>
          <div style={{ flex: 1 }} />
          <Mono tone={allChecked ? 'ok' : 'warn'} size="xs">
            {checkedItems.size}/{CHECKLIST_ITEMS.length}
          </Mono>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
          {CHECKLIST_ITEMS.map((item) => {
            const checked = checkedItems.has(item.id);
            return (
              <motion.button
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                whileTap={{ scale: 0.98 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: SPACE.md,
                  padding: SPACE.md,
                  background: checked ? `${COLORS.ok}08` : COLORS.surface,
                  border: `1px solid ${checked ? `${COLORS.ok}30` : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: cssTransition(),
                  outline: 'none',
                  width: '100%',
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: RADIUS.sm,
                    background: checked ? COLORS.okDim : COLORS.surface,
                    border: `1.5px solid ${checked ? COLORS.ok : COLORS.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 1,
                    transition: cssTransition(),
                  }}
                >
                  {checked && (
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: MOTION.fast, ease: MOTION.ease }}
                      style={{ fontSize: 12, color: COLORS.ok, lineHeight: 1 }}
                    >
                      {'\u2713'}
                    </motion.span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: TYPE.body.size,
                      fontWeight: 500,
                      color: checked ? COLORS.textPrimary : COLORS.textSecondary,
                      marginBottom: 2,
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: TYPE.bodySm.size,
                      color: COLORS.textMuted,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.detail}
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {!allChecked && (
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, padding: `0 ${SPACE.xs}px` }}>
          <AlertTriangle size={12} color={COLORS.warn} />
          <Mono tone="warn" size="xs">
            All items must be verified before proceeding
          </Mono>
        </div>
      )}
    </div>
  );

  // ── Step 2: Disposition selection ─────────────────────────────────────
  const renderDisposition = () => (
    <div style={{ padding: SPACE.base, display: 'flex', flexDirection: 'column', gap: SPACE.base }}>
      <Mono tone="secondary" size="sm">Select Disposition</Mono>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
        {DISPOSITIONS.map((dispo) => {
          const isSelected = selectedDisposition === dispo.id;
          const toneColor =
            dispo.tone === 'ok' ? COLORS.ok
            : dispo.tone === 'info' ? COLORS.info
            : dispo.tone === 'warn' ? COLORS.warn
            : COLORS.crit;

          return (
            <motion.button
              key={dispo.id}
              onClick={() => setSelectedDisposition(dispo.id)}
              whileTap={{ scale: 0.98 }}
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'flex-start',
                gap: SPACE.md,
                padding: SPACE.base,
                background: isSelected ? `${toneColor}0A` : COLORS.surface,
                border: `1.5px solid ${isSelected ? toneColor : COLORS.border}`,
                borderRadius: RADIUS.sm,
                cursor: 'pointer',
                textAlign: 'left',
                transition: cssTransition(),
                outline: 'none',
                width: '100%',
                overflow: 'hidden',
              }}
            >
              {isSelected && (
                <>
                  <CornerBracket position="tl" color={toneColor} size={8} />
                  <CornerBracket position="tr" color={toneColor} size={8} />
                  <CornerBracket position="bl" color={toneColor} size={8} />
                  <CornerBracket position="br" color={toneColor} size={8} />
                </>
              )}

              {/* Accent bar when selected */}
              {isSelected && (
                <motion.span
                  aria-hidden
                  initial={{ width: 0 }}
                  animate={{ width: 3 }}
                  transition={{ duration: MOTION.base, ease: MOTION.ease }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    background: toneColor,
                    boxShadow: `0 0 14px ${toneColor}80`,
                    pointerEvents: 'none',
                  }}
                />
              )}

              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: RADIUS.sm,
                  background: isSelected ? `${toneColor}15` : COLORS.surfaceElev,
                  border: `1px solid ${isSelected ? `${toneColor}40` : COLORS.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: isSelected ? toneColor : COLORS.textMuted,
                  transition: cssTransition(),
                }}
              >
                {dispo.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: TYPE.body.size,
                    fontWeight: 600,
                    color: isSelected ? COLORS.textPrimary : COLORS.textSecondary,
                    marginBottom: 4,
                  }}
                >
                  {dispo.label}
                </div>
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: TYPE.bodySm.size,
                    color: COLORS.textMuted,
                    lineHeight: 1.4,
                  }}
                >
                  {dispo.description}
                </div>
              </div>
              {isSelected && (
                <div style={{ flexShrink: 0, alignSelf: 'center' }}>
                  <CheckCircle2 size={18} color={toneColor} />
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {selectedDisposition === 'ama' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.fast }}
        >
          <TacticalCard padding="md" highlight>
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
              <AlertTriangle size={14} color={COLORS.crit} />
              <Mono tone="crit" size="sm">AMA Documentation Required</Mono>
            </div>
            <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textSecondary, marginTop: SPACE.sm, lineHeight: 1.5 }}>
              Patient has been informed of the risks of leaving against medical advice.
              AMA form must be signed and scanned before discharge can be finalized.
            </div>
          </TacticalCard>
        </motion.div>
      )}
    </div>
  );

  // ── Step 3: Confirmation ──────────────────────────────────────────────
  const renderConfirmation = () => {
    const dispositionInfo = DISPOSITIONS.find((d) => d.id === selectedDisposition);
    const toneColor =
      dispositionInfo?.tone === 'ok' ? COLORS.ok
      : dispositionInfo?.tone === 'info' ? COLORS.info
      : dispositionInfo?.tone === 'warn' ? COLORS.warn
      : COLORS.crit;

    if (discharged) {
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
                      background: `${toneColor}18`,
                      border: `1.5px solid ${toneColor}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <CheckCircle2 size={18} color={toneColor} />
                  </div>
                  <div>
                    <div style={{ fontFamily: FONTS.sans, fontSize: TYPE.h3.size, fontWeight: TYPE.h3.weight, color: toneColor }}>
                      Patient Discharged
                    </div>
                    <Mono tone="secondary" size="xs">
                      Encounter closed &middot; {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </Mono>
                  </div>
                </div>

                <Divider style={{ margin: `${SPACE.sm}px 0` }} />

                <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md, marginTop: SPACE.md }}>
                  <InfoRow label="Patient" value={`${MOCK_PATIENT.name}, ${MOCK_PATIENT.age}${MOCK_PATIENT.sex}`} />
                  <InfoRow label="MRN" value={MOCK_PATIENT.mrn} />
                  <InfoRow label="Bed Freed" value={`${MOCK_PATIENT.bed} — ${MOCK_PATIENT.unit}`} />
                  <InfoRow label="Disposition" value={dispositionInfo?.label ?? ''} valueColor={toneColor} />
                  <InfoRow label="Chief Complaint" value={MOCK_PATIENT.chiefComplaint} />
                  <InfoRow label="Procedures" value={MOCK_PATIENT.procedures} />
                  <InfoRow label="Attending" value={MOCK_PATIENT.attendingPhysician} />
                  <InfoRow label="Admitted" value={MOCK_PATIENT.admittedAt} />
                  <InfoRow
                    label="Discharged"
                    value={new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  />
                </div>
              </div>
            </TacticalCard>
          </motion.div>

          <TacticalCard padding="md">
            <Mono tone="muted" size="xs" style={{ marginBottom: SPACE.sm, display: 'block' }}>
              Post-Discharge Actions
            </Mono>
            <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
              <PostAction label={`Bed ${MOCK_PATIENT.bed} marked DIRTY — EVS notified`} tone="warn" />
              <PostAction label="Discharge summary sent to PCP" tone="ok" />
              <PostAction label="Follow-up appointment confirmed" tone="ok" />
              <PostAction label="Prescription transmitted to pharmacy" tone="ok" />
            </div>
          </TacticalCard>

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
            Discharge Summary
          </BracketLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.md }}>
            <InfoRow label="Patient" value={`${MOCK_PATIENT.name}, ${MOCK_PATIENT.age}${MOCK_PATIENT.sex}`} />
            <InfoRow label="MRN" value={MOCK_PATIENT.mrn} />
            <InfoRow label="Bed" value={`${MOCK_PATIENT.bed} — ${MOCK_PATIENT.unit}`} />
            <InfoRow label="Chief Complaint" value={MOCK_PATIENT.chiefComplaint} />
            <InfoRow label="Procedures" value={MOCK_PATIENT.procedures} />
            <InfoRow label="Disposition" value={dispositionInfo?.label ?? ''} valueColor={toneColor} />
            <InfoRow label="Attending" value={MOCK_PATIENT.attendingPhysician} />
            <InfoRow label="Checklist" value={`${checkedItems.size}/${CHECKLIST_ITEMS.length} verified`} valueColor={COLORS.ok} />
          </div>
        </TacticalCard>

        <div style={{ padding: `0 ${SPACE.xs}px` }}>
          <Mono tone="muted" size="xs">
            This will close the encounter, mark bed {MOCK_PATIENT.bed} as dirty, and notify EVS for turnover.
          </Mono>
        </div>

        <TacticalButton
          variant={selectedDisposition === 'ama' ? 'danger' : 'primary'}
          fullWidth
          onClick={handleDischarge}
        >
          {selectedDisposition === 'ama' ? 'Confirm AMA Discharge' : 'Confirm Discharge'}
        </TacticalButton>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="discharge-flow"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            // Stop above MobileView's bottom HUD nav so app tabs stay visible.
            bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM,
            zIndex: Z.modal,
            background: COLORS.bg,
            display: 'flex',
            flexDirection: 'column',
            fontFamily: FONTS.sans,
            color: COLORS.textPrimary,
            overflow: 'hidden',
            borderTop: `1px solid ${COLORS.borderStrong}`,
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
            <BracketLabel tone="accent" size="sm">Discharge Patient</BracketLabel>
            <div style={{ flex: 1 }} />
            <StatusPill label={MOCK_PATIENT.id} tone="info" />
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
                {step === 'checklist' && renderChecklist()}
                {step === 'disposition' && renderDisposition()}
                {step === 'confirm' && renderConfirmation()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* ── Footer navigation ─────────────────────────────────────── */}
          {!discharged && (
            <div
              style={{
                position: 'fixed',
                // Sit above MobileView's bottom HUD nav so app tabs stay visible.
                bottom: MOBILE_NAV_OVERLAY_INSET_BOTTOM,
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
                  {step === 'disposition' ? 'Review' : 'Next'}
                </TacticalButton>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

DischargeFlow.displayName = 'DischargeFlow';

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

const PostAction: React.FC<{ label: string; tone: 'ok' | 'warn' | 'info' }> = ({ label, tone }) => {
  const color = tone === 'ok' ? COLORS.ok : tone === 'warn' ? COLORS.warn : COLORS.info;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: RADIUS.full,
          background: color,
          boxShadow: `0 0 4px ${color}`,
          flexShrink: 0,
        }}
      />
      <span style={{ fontFamily: FONTS.sans, fontSize: TYPE.bodySm.size, color: COLORS.textSecondary }}>
        {label}
      </span>
    </div>
  );
};
