import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldAlert,
  UserCheck,
  Clock,
  CheckSquare,
  ArrowRight,
  X,
  Check,
  Loader2,
} from 'lucide-react';
import { Playbook } from '../types';
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
  TacticalButton,
  CornerBracket,
} from './design';

interface PlaybookActivationProps {
  onClose: () => void;
  onConfirm: () => void;
}

const mockPlaybook: Playbook = {
  id: 'PB-SURGE-L2',
  name: 'Level 2 Surge Protocol',
  description:
    'Rapid decompression of ED via hallway boarding and fast-track expansion.',
  triggerCondition: 'NEDOCS > 100 for 60 mins OR > 5 ICU Holds',
  approverRole: 'Medical Director / Nursing Super',
  steps: [
    {
      id: '1',
      description: 'Notify House Supervisor of Capacity Constraint',
      role: 'Charge Nurse',
      status: 'pending',
    },
    {
      id: '2',
      description: 'Suspend Elective Admissions',
      role: 'Medical Director',
      status: 'pending',
    },
    {
      id: '3',
      description: 'Activate Fast-Track Area B',
      role: 'Operations Manager',
      status: 'pending',
    },
    {
      id: '4',
      description: 'Broadcast "Code Purple" to staff',
      role: 'Communications',
      status: 'pending',
    },
  ],
  estimatedImpact: '-15% Saturation in 60m',
};

/**
 * PlaybookActivation — tactical high-stakes confirmation dialog for
 * authorizing a surge protocol. Requires checking every action and
 * providing a digital signature before the Confirm Activation button
 * becomes enabled.
 */
export const PlaybookActivation: React.FC<PlaybookActivationProps> = ({
  onClose,
  onConfirm,
}) => {
  const [checkedSteps, setCheckedSteps] = useState<number[]>([]);
  const [approverName, setApproverName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [reviewSeconds, setReviewSeconds] = useState(0);

  // Live review timer — signals due-diligence
  useEffect(() => {
    const id = setInterval(() => setReviewSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const toggleStep = (index: number) => {
    setCheckedSteps((prev) =>
      prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index],
    );
  };

  const handleActivate = () => {
    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      onConfirm();
    }, 1500);
  };

  const allChecked = checkedSteps.length === mockPlaybook.steps.length;
  const canActivate = allChecked && approverName.length > 2 && !isSubmitting;

  const mm = String(Math.floor(reviewSeconds / 60)).padStart(2, '0');
  const ss = String(reviewSeconds % 60).padStart(2, '0');

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: MOTION.fast, ease: MOTION.ease }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: SPACE.md,
          background: 'rgba(0, 0, 0, 0.88)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: MOTION.base, ease: MOTION.ease }}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'relative',
            width: '100%',
            maxWidth: 720,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            background: COLORS.surface,
            border: `1px solid ${COLORS.accent}`,
            borderRadius: RADIUS.sm,
            boxShadow:
              '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(225,29,72,0.18), 0 0 60px rgba(225,29,72,0.15)',
            overflow: 'hidden',
          }}
        >
          {/* Accent side rail */}
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: 0,
              width: 3,
              background: `linear-gradient(180deg, ${COLORS.accent}, ${COLORS.accentDeep})`,
              pointerEvents: 'none',
            }}
          />

          <CornerBracket position="tl" color={COLORS.accent} size={13} thickness={1} inset={-1} />
          <CornerBracket position="tr" color={COLORS.accent} size={13} thickness={1} inset={-1} />
          <CornerBracket position="bl" color={COLORS.accent} size={13} thickness={1} inset={-1} />
          <CornerBracket position="br" color={COLORS.accent} size={13} thickness={1} inset={-1} />

          {/* Header */}
          <div
            style={{
              padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE.md}px`,
              borderBottom: `1px solid ${COLORS.border}`,
              background: `linear-gradient(180deg, rgba(225,29,72,0.08), ${COLORS.surfaceElev})`,
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: SPACE.md,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.md,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    position: 'relative',
                    width: 44,
                    height: 44,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: `linear-gradient(135deg, ${COLORS.surfaceElev}, ${COLORS.surface})`,
                    border: `1px solid ${COLORS.accent}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.accent,
                    flexShrink: 0,
                    boxShadow: `0 0 16px ${COLORS.accentGlow}`,
                  }}
                >
                  <ShieldAlert size={25} strokeWidth={2} />
                  <CornerBracket position="tl" color={COLORS.accent} size={5} thickness={1} inset={-1} />
                  <CornerBracket position="br" color={COLORS.accent} size={5} thickness={1} inset={-1} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: SPACE.sm,
                      marginBottom: 4,
                    }}
                  >
                    <BracketLabel tone="accent" size="xs">
                      ACTIVATE · PROTOCOL
                    </BracketLabel>
                    <StatusPill label="Auth Required" tone="crit" pulse />
                  </div>
                  <h2
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: TYPE.h2.size,
                      fontWeight: TYPE.h2.weight,
                      letterSpacing: TYPE.h2.tracking,
                      lineHeight: 1.15,
                      color: COLORS.textPrimary,
                      margin: '2px 0 4px',
                    }}
                  >
                    {mockPlaybook.name}
                  </h2>
                  <Mono tone="muted" size="xs">
                    {mockPlaybook.id} · {mockPlaybook.description}
                  </Mono>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 30,
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textMuted,
                  cursor: 'pointer',
                  transition: `all ${MOTION.fast}s ease`,
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = COLORS.borderStrong;
                  e.currentTarget.style.color = COLORS.textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = COLORS.border;
                  e.currentTarget.style.color = COLORS.textMuted;
                }}
              >
                <X size={17} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: SPACE.lg,
              display: 'flex',
              flexDirection: 'column',
              gap: SPACE.lg,
            }}
          >
            {/* Meta grid — trigger + approver */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                gap: SPACE.md,
              }}
            >
              <MetaBlock label="Trigger Condition" mono>
                {mockPlaybook.triggerCondition}
              </MetaBlock>
              <MetaBlock label="Required Approver" icon={<UserCheck size={16} color={COLORS.info} />}>
                {mockPlaybook.approverRole}
              </MetaBlock>
            </div>

            {/* Checklist */}
            <div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: SPACE.sm,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
                  <CheckSquare size={17} color={COLORS.textSecondary} strokeWidth={2} />
                  <BracketLabel tone="muted" size="xs">
                    IMMEDIATE ACTIONS REQUIRED
                  </BracketLabel>
                </div>
                <Mono
                  tone={allChecked ? 'ok' : 'muted'}
                  size="xs"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {String(checkedSteps.length).padStart(2, '0')} /{' '}
                  {String(mockPlaybook.steps.length).padStart(2, '0')} CONFIRMED
                </Mono>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.xs }}>
                {mockPlaybook.steps.map((step, idx) => {
                  const checked = checkedSteps.includes(idx);
                  return (
                    <label
                      key={step.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: SPACE.md,
                        padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                        background: checked ? 'rgba(16, 185, 129, 0.06)' : COLORS.bgDeep,
                        border: `1px solid ${checked ? COLORS.ok : COLORS.border}`,
                        borderLeft: `3px solid ${checked ? COLORS.ok : COLORS.border}`,
                        borderRadius: RADIUS.sm,
                        cursor: 'pointer',
                        transition: `all ${MOTION.fast}s ease`,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleStep(idx)}
                        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
                      />
                      {/* Custom checkbox */}
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: checked ? COLORS.ok : COLORS.surface,
                          border: `1px solid ${checked ? COLORS.ok : COLORS.borderStrong}`,
                          borderRadius: RADIUS.sm,
                          color: '#000',
                          flexShrink: 0,
                          transition: `all ${MOTION.fast}s ease`,
                        }}
                      >
                        {checked && <Check size={15} strokeWidth={3} />}
                      </div>
                      <Mono
                        tone="muted"
                        size="xs"
                        style={{ flexShrink: 0, minWidth: 22 }}
                      >
                        {String(idx + 1).padStart(2, '0')}
                      </Mono>
                      <span
                        style={{
                          flex: 1,
                          fontFamily: FONTS.sans,
                          fontSize: 16,
                          color: checked ? COLORS.textPrimary : COLORS.textSecondary,
                          lineHeight: 1.45,
                        }}
                      >
                        {step.description}
                      </span>
                      <Mono tone="dim" size="xs" style={{ flexShrink: 0 }}>
                        {step.role}
                      </Mono>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Digital signature */}
            <div>
              <BracketLabel tone="muted" size="xs">
                AUTHORIZED BY · DIGITAL SIGNATURE
              </BracketLabel>
              <Mono
                tone="dim"
                size="xs"
                style={{ display: 'block', margin: `${SPACE.xs}px 0 ${SPACE.sm}px` }}
              >
                {`// Full name and credentials`}
              </Mono>
              <input
                type="text"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                onFocus={() => setNameFocused(true)}
                onBlur={() => setNameFocused(false)}
                placeholder="e.g., Dr. Evelyn Reed, MD · Chief Medical Officer"
                style={{
                  width: '100%',
                  padding: `${SPACE.sm + 2}px ${SPACE.md}px`,
                  background: COLORS.bgDeep,
                  border: `1px solid ${nameFocused ? COLORS.accent : COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  color: COLORS.textPrimary,
                  fontFamily: FONTS.sans,
                  fontSize: 16,
                  outline: 'none',
                  transition: `border-color ${MOTION.fast}s ease, box-shadow ${MOTION.fast}s ease`,
                  boxShadow: nameFocused ? `0 0 0 3px ${COLORS.accentGlow}` : 'none',
                }}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: SPACE.md,
              padding: `${SPACE.md}px ${SPACE.lg}px`,
              borderTop: `1px solid ${COLORS.border}`,
              background: COLORS.bgDeep,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
              <Clock size={15} color={COLORS.textMuted} strokeWidth={2} />
              <Mono tone="muted" size="xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                Review Time · {mm}:{ss}
              </Mono>
            </div>
            <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
              <TacticalButton variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </TacticalButton>
              <TacticalButton
                variant="primary"
                size="md"
                disabled={!canActivate}
                onClick={handleActivate}
                icon={
                  isSubmitting ? (
                    <Loader2
                      size={17}
                      strokeWidth={2}
                      style={{ animation: 'spin 1.2s linear infinite' }}
                    />
                  ) : (
                    <ArrowRight size={17} strokeWidth={2} />
                  )
                }
              >
                {isSubmitting ? 'Initializing…' : 'Confirm Activation'}
              </TacticalButton>
            </div>
          </div>

          <style>
            {`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}
          </style>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────
// MetaBlock — a framed key/value meta cell
// ─────────────────────────────────────────────────────────────────────────
const MetaBlock: React.FC<{
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  icon?: React.ReactNode;
}> = ({ label, children, mono, icon }) => (
  <div
    style={{
      position: 'relative',
      padding: `${SPACE.md}px`,
      background: COLORS.bgDeep,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
    }}
  >
    <CornerBracket position="tl" color={COLORS.borderStrong} size={4} thickness={1} />
    <CornerBracket position="br" color={COLORS.borderStrong} size={4} thickness={1} />
    <BracketLabel tone="muted" size="xs">
      {label}
    </BracketLabel>
    <div
      style={{
        marginTop: 6,
        display: 'flex',
        alignItems: 'center',
        gap: SPACE.sm,
        fontFamily: mono ? FONTS.mono : FONTS.sans,
        fontSize: mono ? 12 : 13,
        color: COLORS.textPrimary,
        letterSpacing: mono ? '0.02em' : undefined,
        lineHeight: 1.45,
      }}
    >
      {icon}
      <span>{children}</span>
    </div>
  </div>
);
