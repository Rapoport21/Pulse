/**
 * NoteComposer — fullscreen overlay wizard for clinical documentation.
 *
 * Supports note types: SOAP, H&P, Progress Note, Nursing Assessment,
 * Procedure Note. Each type has section templates with placeholders.
 *
 * Flow:
 *   1. Select note type + compose sections
 *   2. Preview & sign the note
 *
 * Props:
 *   open       — controls overlay visibility
 *   onClose    — dismiss the overlay
 *   showToast  — fire a toast notification to the parent shell
 *   patientId  — optional, defaults to mock patient
 */

import React, { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  FileText,
  Lock,
  Stethoscope,
  ClipboardList,
  Activity,
  Syringe,
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
  Mono,
  BracketLabel,
  StatusPill,
  TacticalCard,
  TacticalButton,
  HudStrip,
  ScanningLine,
  Divider,
} from '../design';

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

export interface NoteComposerProps {
  open: boolean;
  onClose: () => void;
  showToast: (msg: string) => void;
  patientId?: string;
  /** Cross-device note callback — syncs note to all connected devices */
  onAddNote?: (note: Omit<import('../../types').ClinicalNote, 'id' | 'createdAt'>) => void;
}

type Step = 'compose' | 'preview';
const STEP_ORDER: Step[] = ['compose', 'preview'];
const STEP_LABELS: Record<Step, string> = {
  compose: 'Compose',
  preview: 'Preview & Sign',
};

type NoteType = 'soap' | 'hp' | 'progress' | 'nursing' | 'procedure';

interface NoteTypeOption {
  id: NoteType;
  label: string;
  icon: React.ReactNode;
  sections: SectionDef[];
}

interface SectionDef {
  key: string;
  label: string;
  tone: 'info' | 'ok' | 'warn' | 'accent';
  placeholder: string;
  aiDraft: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Note type definitions
// ─────────────────────────────────────────────────────────────────────────

const NOTE_TYPES: NoteTypeOption[] = [
  {
    id: 'soap',
    label: 'SOAP Note',
    icon: <FileText size={16} />,
    sections: [
      {
        key: 'S',
        label: 'Subjective',
        tone: 'info',
        placeholder: 'Chief complaint, HPI, ROS, allergies, medications...',
        aiDraft:
          'Pt is a 62 y/o M presenting with acute onset substernal chest pain radiating to left arm, began 2h PTA. Denies SOB, diaphoresis, nausea. PMH: HTN, HLD. Meds: lisinopril 10mg daily, atorvastatin 40mg daily. NKDA.',
      },
      {
        key: 'O',
        label: 'Objective',
        tone: 'ok',
        placeholder: 'Vitals, physical exam findings, labs, imaging...',
        aiDraft:
          'VS: BP 148/92, HR 88, RR 18, SpO2 98% RA, T 98.4F. Alert, oriented x4, mild distress. HEENT: unremarkable. CV: RRR, no m/r/g. Lungs: CTAB. Abd: soft, NT/ND. Ext: no edema. Troponin 0.04, BMP wnl. ECG: NSR, no ST changes.',
      },
      {
        key: 'A',
        label: 'Assessment',
        tone: 'warn',
        placeholder: 'Diagnosis, differential diagnosis, clinical reasoning...',
        aiDraft:
          '1. Acute chest pain — likely musculoskeletal vs atypical angina\n2. Hypertension — suboptimally controlled\n3. Hyperlipidemia — on statin therapy',
      },
      {
        key: 'P',
        label: 'Plan',
        tone: 'accent',
        placeholder: 'Treatment plan, orders, medications, follow-up...',
        aiDraft:
          '1. Serial troponins q6h x3, telemetry monitoring\n2. ASA 325mg PO x1, heparin drip per protocol\n3. Cardiology consult for stress test\n4. Continue home medications\n5. NPO pending further workup\n6. Reassess in 6h with repeat troponin',
      },
    ],
  },
  {
    id: 'hp',
    label: 'H&P',
    icon: <Stethoscope size={16} />,
    sections: [
      {
        key: 'HPI',
        label: 'History of Present Illness',
        tone: 'info',
        placeholder: 'Onset, location, duration, character, aggravating/alleviating factors, radiation, timing, severity...',
        aiDraft: 'Pt is a 62 y/o M who presents to the ED with 2h history of substernal chest pain radiating to the left arm.',
      },
      {
        key: 'PMH',
        label: 'Past Medical / Surgical Hx',
        tone: 'ok',
        placeholder: 'Past medical history, surgical history, medications, allergies, social/family history...',
        aiDraft: 'PMH: HTN, HLD. PSH: Appendectomy (2004). Meds: lisinopril 10mg daily, atorvastatin 40mg daily. Allergies: NKDA. SH: Non-smoker, social EtOH. FH: Father — MI at 58.',
      },
      {
        key: 'PE',
        label: 'Physical Exam',
        tone: 'warn',
        placeholder: 'General appearance, HEENT, cardiovascular, respiratory, abdomen, extremities, neuro...',
        aiDraft: 'Gen: Alert, NAD. HEENT: NCAT, PERRL. CV: RRR, no m/r/g. Lungs: CTAB bilat. Abd: Soft, NT/ND, +BS. Ext: No edema, 2+ pulses. Neuro: CN II-XII intact, 5/5 strength throughout.',
      },
      {
        key: 'AP',
        label: 'Assessment & Plan',
        tone: 'accent',
        placeholder: 'Working diagnosis, differential, treatment plan...',
        aiDraft: 'Assessment: Chest pain, rule out ACS.\nPlan: Serial troponins, telemetry, cardiology consult, stress test if biomarkers negative.',
      },
    ],
  },
  {
    id: 'progress',
    label: 'Progress Note',
    icon: <ClipboardList size={16} />,
    sections: [
      {
        key: 'INT',
        label: 'Interval History',
        tone: 'info',
        placeholder: 'Events since last note, overnight course, patient-reported changes...',
        aiDraft: 'Pt reports improved pain overnight (7/10 to 3/10). Tolerated PO diet. Ambulated with PT without difficulty. No new complaints.',
      },
      {
        key: 'EXAM',
        label: 'Exam & Data',
        tone: 'ok',
        placeholder: 'Focused exam, new labs/imaging, vitals trend...',
        aiDraft: 'VS stable, afebrile. Lungs: CTAB. CV: RRR. Wound: clean, dry, intact. WBC trending down 12.1 -> 8.4. Cr stable 1.1.',
      },
      {
        key: 'PLAN',
        label: 'Plan Update',
        tone: 'accent',
        placeholder: 'Changes to plan, new orders, discharge planning...',
        aiDraft: 'Continue current antibiotics (day 3/7). Advance diet. PT/OT to evaluate for DC readiness. Target discharge tomorrow if afebrile x24h.',
      },
    ],
  },
  {
    id: 'nursing',
    label: 'Nursing Assessment',
    icon: <Activity size={16} />,
    sections: [
      {
        key: 'ASSESS',
        label: 'Nursing Assessment',
        tone: 'info',
        placeholder: 'Patient assessment, pain level, mental status, skin integrity, fall risk...',
        aiDraft: 'Pt alert and oriented x4. Pain 4/10 at surgical site, controlled with scheduled meds. Skin intact, no pressure areas. Braden score 18. Fall risk: low (Morse 25).',
      },
      {
        key: 'CARE',
        label: 'Care Delivered',
        tone: 'ok',
        placeholder: 'Medications administered, treatments, patient education, procedures...',
        aiDraft: 'Morphine 4mg IV given at 0800 for pain. Wound dressing changed per protocol — site clean, no drainage. Foley catheter care performed. I&O documented.',
      },
      {
        key: 'RESPONSE',
        label: 'Patient Response',
        tone: 'warn',
        placeholder: 'Response to interventions, changes in condition, safety concerns...',
        aiDraft: 'Pain improved to 2/10 after morphine. Pt tolerated dressing change well. Ambulated 50ft in hallway with steady gait. No safety concerns identified.',
      },
    ],
  },
  {
    id: 'procedure',
    label: 'Procedure Note',
    icon: <Syringe size={16} />,
    sections: [
      {
        key: 'IND',
        label: 'Indication & Consent',
        tone: 'info',
        placeholder: 'Indication for procedure, consent obtained, timeout performed...',
        aiDraft: 'Indication: Right pleural effusion with dyspnea. Informed consent obtained. Timeout performed with two patient identifiers verified.',
      },
      {
        key: 'PROC',
        label: 'Procedure Details',
        tone: 'ok',
        placeholder: 'Technique, anesthesia, findings, specimens, complications...',
        aiDraft: 'Procedure: Ultrasound-guided thoracentesis, right. Site prepped and draped in sterile fashion. 1% lidocaine local anesthesia. 18g needle inserted under US guidance at 8th ICS, posterior axillary line. 1200mL straw-colored fluid removed. No complications.',
      },
      {
        key: 'POST',
        label: 'Post-Procedure',
        tone: 'accent',
        placeholder: 'Post-procedure orders, labs sent, follow-up imaging, patient tolerance...',
        aiDraft: 'Pt tolerated procedure well, no immediate complications. Fluid sent for cell count, chemistry, culture, cytology. Post-procedure CXR ordered. Pt to remain on bed rest x2h.',
      },
    ],
  },
];

const MOCK_COSIGNERS = [
  'Dr. A. Chen — Attending, Emergency Medicine',
  'Dr. S. Patel — Attending, Internal Medicine',
  'Dr. R. Kim — Attending, Surgery',
  'Dr. L. Johnson — Attending, Cardiology',
];

const MOCK_PATIENT = { name: 'Robert Fox', mrn: 'MRN-4491', id: 'P003' };

// ─────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────

export const NoteComposer: React.FC<NoteComposerProps> = ({
  open,
  onClose,
  showToast,
  patientId,
  onAddNote,
}) => {
  const [step, setStep] = useState<Step>('compose');
  const [noteType, setNoteType] = useState<NoteType>('soap');
  const [sections, setSections] = useState<Record<string, string>>({});
  const [aiVisible, setAiVisible] = useState<Record<string, boolean>>({});
  const [signed, setSigned] = useState(false);
  const [cosigner, setCosigner] = useState<string | null>(null);

  const createdAt = useMemo(() => new Date(), []);
  const stepIndex = STEP_ORDER.indexOf(step);
  const currentType = NOTE_TYPES.find((n) => n.id === noteType)!;

  const wordCount = useCallback(
    (key: string) => {
      const text = sections[key] ?? '';
      return text.trim() ? text.trim().split(/\s+/).length : 0;
    },
    [sections],
  );

  const totalWords = currentType.sections.reduce((sum, s) => sum + wordCount(s.key), 0);
  const hasContent = totalWords > 0;

  const reset = () => {
    setStep('compose');
    setNoteType('soap');
    setSections({});
    setAiVisible({});
    setSigned(false);
    setCosigner(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSign = () => {
    setSigned(true);
    // Publish note to cross-device sync layer
    if (onAddNote) {
      const noteTypeMap: Record<string, 'SOAP' | 'H&P' | 'PROGRESS' | 'NURSING' | 'CONSULT'> = {
        soap: 'SOAP', hp: 'H&P', progress: 'PROGRESS', nursing: 'NURSING', procedure: 'PROGRESS',
      };
      const noteContent = Object.values(sections).filter(Boolean).join('\n\n');
      onAddNote({
        patientId: patientId ?? MOCK_PATIENT.id,
        type: noteTypeMap[noteType] ?? 'PROGRESS',
        authorId: 'current-user',
        content: noteContent,
        signed: true,
        signedAt: new Date().toISOString(),
      });
    }
    showToast(`${currentType.label} signed and locked for ${MOCK_PATIENT.name}`);
  };

  const acceptAiDraft = (key: string, draft: string) => {
    setSections((prev) => ({ ...prev, [key]: draft }));
    setAiVisible((prev) => ({ ...prev, [key]: false }));
  };

  // ── Render helpers ────────────────────────────────────────────────────

  const renderStepIndicator = () => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.sm,
        padding: `${SPACE.md}px ${SPACE.base}px`,
      }}
    >
      {STEP_ORDER.map((s, i) => {
        const isCurrent = s === step;
        const isDone = i < stepIndex;
        return (
          <React.Fragment key={s}>
            {i > 0 && (
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: isDone ? COLORS.accent : COLORS.border,
                }}
              />
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: RADIUS.full,
                  background: isDone
                    ? COLORS.accent
                    : isCurrent
                      ? COLORS.accentDim
                      : COLORS.surface,
                  border: `1.5px solid ${isDone || isCurrent ? COLORS.accent : COLORS.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontFamily: FONTS.mono,
                  fontWeight: 600,
                  color: isDone
                    ? COLORS.textPrimary
                    : isCurrent
                      ? COLORS.accent
                      : COLORS.textMuted,
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

  // ── Step 1: Compose ───────────────────────────────────────────────────

  const renderCompose = () => (
    <div
      style={{
        padding: SPACE.base,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACE.base,
      }}
    >
      {/* Note type selector */}
      <div>
        <Mono tone="secondary" size="sm" style={{ marginBottom: SPACE.sm, display: 'block' }}>
          Note Type
        </Mono>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: SPACE.sm }}>
          {NOTE_TYPES.map((nt) => {
            const active = noteType === nt.id;
            return (
              <motion.button
                key={nt.id}
                className="tap-target"
                onClick={() => {
                  setNoteType(nt.id);
                  setSections({});
                  setAiVisible({});
                }}
                whileTap={{ scale: 0.96 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: `${SPACE.sm}px ${SPACE.md}px`,
                  background: active ? COLORS.accentDim : COLORS.surface,
                  border: `1.5px solid ${active ? COLORS.accent : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  cursor: 'pointer',
                  color: active ? COLORS.accent : COLORS.textSecondary,
                  fontFamily: FONTS.mono,
                  fontSize: TYPE.bodySm.size,
                  fontWeight: 500,
                  outline: 'none',
                  transition: cssTransition(),
                }}
              >
                {nt.icon}
                {nt.label}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Meta bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: SPACE.sm,
        }}
      >
        <Mono tone="muted" size="xs">
          Author: Dr. A. Chen &middot; {createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Mono>
        <Mono tone={totalWords > 0 ? 'secondary' : 'muted'} size="xs">
          {totalWords} words
        </Mono>
      </div>

      <Divider />

      {/* Section editors */}
      {currentType.sections.map((sec) => {
        const showAi = aiVisible[sec.key] ?? false;
        return (
          <div key={sec.key}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: SPACE.sm,
              }}
            >
              <BracketLabel tone={sec.tone} size="sm">
                {sec.key} — {sec.label}
              </BracketLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                <Mono tone="muted" size="xs">
                  {wordCount(sec.key)}w
                </Mono>
                <motion.button
                  className="tap-target"
                  onClick={() =>
                    setAiVisible((prev) => ({ ...prev, [sec.key]: !prev[sec.key] }))
                  }
                  whileTap={{ scale: 0.97 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: `3px ${SPACE.sm}px`,
                    background: showAi ? COLORS.infoDim : COLORS.surface,
                    border: `1px solid ${showAi ? COLORS.info : COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    cursor: 'pointer',
                    color: showAi ? COLORS.info : COLORS.textMuted,
                    fontFamily: FONTS.mono,
                    fontSize: 11,
                    outline: 'none',
                    transition: cssTransition(),
                  }}
                >
                  <BrainCircuit size={12} />
                  AI
                </motion.button>
              </div>
            </div>

            {/* AI draft suggestion */}
            <AnimatePresence>
              {showAi && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: MOTION.fast }}
                  style={{ overflow: 'hidden' }}
                >
                  <div
                    style={{
                      padding: SPACE.md,
                      background: COLORS.infoDim,
                      border: `1px solid ${COLORS.info}30`,
                      borderRadius: RADIUS.sm,
                      marginBottom: SPACE.sm,
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
                      <BrainCircuit size={12} color={COLORS.info} />
                      <Mono tone="info" size="xs">
                        AI-Generated Draft
                      </Mono>
                    </div>
                    <div
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: TYPE.bodySm.size,
                        color: COLORS.textSecondary,
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                        marginBottom: SPACE.md,
                      }}
                    >
                      {sec.aiDraft}
                    </div>
                    <div style={{ display: 'flex', gap: SPACE.sm }}>
                      <TacticalButton
                        variant="primary"
                        onClick={() => acceptAiDraft(sec.key, sec.aiDraft)}
                      >
                        Accept Draft
                      </TacticalButton>
                      <TacticalButton
                        variant="ghost"
                        onClick={() =>
                          setAiVisible((prev) => ({ ...prev, [sec.key]: false }))
                        }
                      >
                        Dismiss
                      </TacticalButton>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Textarea */}
            <textarea
              value={sections[sec.key] ?? ''}
              onChange={(e) =>
                setSections((prev) => ({ ...prev, [sec.key]: e.target.value }))
              }
              placeholder={sec.placeholder}
              rows={4}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: SPACE.md,
                fontFamily: FONTS.mono,
                fontSize: TYPE.bodySm.size,
                color: COLORS.textPrimary,
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: RADIUS.sm,
                resize: 'vertical',
                outline: 'none',
                lineHeight: 1.6,
                transition: `border-color ${MOTION.fast}s ease`,
              }}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = COLORS.borderStrong;
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = COLORS.border;
              }}
            />
          </div>
        );
      })}
    </div>
  );

  // ── Step 2: Preview & Sign ────────────────────────────────────────────

  const renderPreview = () => {
    if (signed) {
      return (
        <div
          style={{
            padding: SPACE.base,
            display: 'flex',
            flexDirection: 'column',
            gap: SPACE.base,
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
          >
            <TacticalCard highlight accentBar padding="lg">
              <div style={{ position: 'relative', overflow: 'hidden' }}>
                <ScanningLine duration={6} />
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: SPACE.md,
                    marginBottom: SPACE.base,
                  }}
                >
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
                    <Lock size={18} color={COLORS.ok} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: TYPE.h3.size,
                        fontWeight: TYPE.h3.weight,
                        color: COLORS.ok,
                      }}
                    >
                      Note Signed & Locked
                    </div>
                    <Mono tone="secondary" size="xs">
                      {currentType.label} &middot;{' '}
                      {new Date().toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </Mono>
                  </div>
                </div>
                <Divider style={{ margin: `${SPACE.sm}px 0` }} />
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.md,
                    marginTop: SPACE.md,
                  }}
                >
                  <InfoRow label="Patient" value={MOCK_PATIENT.name} />
                  <InfoRow label="MRN" value={MOCK_PATIENT.mrn} />
                  <InfoRow label="Note Type" value={currentType.label} />
                  <InfoRow label="Author" value="Dr. A. Chen" />
                  {cosigner && <InfoRow label="Cosigner" value={cosigner.split(' — ')[0]} />}
                  <InfoRow label="Word Count" value={`${totalWords}`} />
                  <InfoRow label="Status" value="SIGNED" valueColor={COLORS.ok} />
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
      <div
        style={{
          padding: SPACE.base,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.base,
        }}
      >
        {/* Formatted note preview */}
        <TacticalCard padding="md">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: SPACE.md,
            }}
          >
            <BracketLabel tone="muted" size="sm">
              {currentType.label}
            </BracketLabel>
            <Mono tone="muted" size="xs">
              {createdAt.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}{' '}
              {createdAt.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Mono>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: SPACE.md,
            }}
          >
            <Mono tone="secondary" size="xs">
              Patient: {MOCK_PATIENT.name} &middot; {MOCK_PATIENT.mrn}
            </Mono>
            <StatusPill label={patientId ?? MOCK_PATIENT.id} tone="info" />
          </div>

          <Divider style={{ margin: `${SPACE.sm}px 0 ${SPACE.md}px` }} />

          {currentType.sections.map((sec) => {
            const text = sections[sec.key] ?? '';
            return (
              <div key={sec.key} style={{ marginBottom: SPACE.base }}>
                <BracketLabel tone={sec.tone} size="xs">
                  {sec.key} — {sec.label}
                </BracketLabel>
                <div
                  style={{
                    fontFamily: FONTS.mono,
                    fontSize: TYPE.bodySm.size,
                    color: text ? COLORS.textSecondary : COLORS.textMuted,
                    lineHeight: 1.6,
                    marginTop: SPACE.sm,
                    whiteSpace: 'pre-wrap',
                    fontStyle: text ? 'normal' : 'italic',
                  }}
                >
                  {text || '(empty)'}
                </div>
              </div>
            );
          })}

          <Divider style={{ margin: `${SPACE.sm}px 0` }} />
          <Mono tone="muted" size="xs">
            Author: Dr. A. Chen &middot; {totalWords} words
          </Mono>
        </TacticalCard>

        {/* Cosigner selection */}
        <div>
          <Mono tone="secondary" size="sm" style={{ marginBottom: SPACE.sm, display: 'block' }}>
            Cosigner (optional)
          </Mono>
          <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
            {MOCK_COSIGNERS.map((cs) => {
              const active = cosigner === cs;
              return (
                <motion.button
                  key={cs}
                  onClick={() => setCosigner(active ? null : cs)}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: SPACE.md,
                    background: active ? COLORS.accentDim : COLORS.surface,
                    border: `1px solid ${active ? COLORS.accent : COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    cursor: 'pointer',
                    outline: 'none',
                    transition: cssTransition(),
                    width: '100%',
                  }}
                >
                  <Mono tone={active ? 'accent' : 'secondary'} size="xs">
                    {cs}
                  </Mono>
                  {active && <CheckCircle2 size={14} color={COLORS.accent} />}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Sign button */}
        <TacticalButton variant="primary" fullWidth onClick={handleSign} icon={<Lock size={14} />}>
          Sign & Lock Note
        </TacticalButton>

        <Mono tone="muted" size="xs" style={{ textAlign: 'center' }}>
          Signing locks this note to your credentials and timestamps it in the medical record.
        </Mono>
      </div>
    );
  };

  // ── Main render ───────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="note-composer"
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
            paddingTop: 'env(safe-area-inset-top)',
          }}
        >
          {/* Header strip */}
          <HudStrip side="top" fixed>
            <button
              className="tap-target"
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
            <BracketLabel tone="muted" size="sm">
              Clinical Note
            </BracketLabel>
            <div style={{ flex: 1 }} />
            <StatusPill label={patientId ?? MOCK_PATIENT.id} tone="info" />
          </HudStrip>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              paddingTop: 56,
              paddingBottom: 'max(env(safe-area-inset-bottom), 72px)',
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
                {step === 'compose' && renderCompose()}
                {step === 'preview' && renderPreview()}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer navigation */}
          {!signed && (
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
                <TacticalButton
                  variant="ghost"
                  onClick={() => setStep('compose')}
                  icon={<ArrowLeft size={14} />}
                >
                  Back
                </TacticalButton>
              )}
              <div style={{ flex: 1 }} />
              {step === 'compose' && (
                <TacticalButton
                  variant="primary"
                  onClick={() => setStep('preview')}
                  disabled={!hasContent}
                  icon={<ArrowRight size={14} />}
                >
                  Preview
                </TacticalButton>
              )}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

NoteComposer.displayName = 'NoteComposer';

// ─────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────

const InfoRow: React.FC<{ label: string; value: string; valueColor?: string }> = ({
  label,
  value,
  valueColor,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <Mono tone="muted" size="xs">
      {label}
    </Mono>
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
