import React from 'react';
import { motion } from 'motion/react';
import { X, UserPlus, QrCode } from 'lucide-react';
import {
  COLORS,
  FONTS,
  SPACE,
  RADIUS,
  MOTION,
  Z,
  Mono,
  BracketLabel,
  CornerBracket,
  TacticalButton,
} from './design';
import { triggerHaptic } from '../lib/haptics';

/**
 * EmptyBraceletSheet — prompt shown after scanning an unassigned
 * bracelet (SCAD participatory demo).
 *
 * The operator scans a physical wristband, the QR decodes to
 * `pulse://bracelet/<n>`, the scan router checks the shared pool
 * state, and if the slot is empty (not yet linked to any patient)
 * this sheet slides up offering two choices:
 *
 *   · Admit a new patient with this bracelet pre-selected.
 *   · Cancel and go back.
 *
 * Design: bottom-sheet with a dark backdrop, bracket-framed card,
 * oversized bracelet number as the hero element so the operator
 * sees the exact slot they're about to wire up.
 */

export interface EmptyBraceletSheetProps {
  /** Two-digit bracelet number from the QR scan (null when closed). */
  number: string | null;
  /** Confirm → open the admit flow with this bracelet pre-selected. */
  onAdmit: (number: string) => void;
  /** Dismiss the sheet without acting. */
  onCancel: () => void;
}

export const EmptyBraceletSheet: React.FC<EmptyBraceletSheetProps> = ({
  number,
  onAdmit,
  onCancel,
}) => {
  if (!number) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: MOTION.base, ease: MOTION.ease }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: Z.modal + 5,
        background: 'rgba(0,0,0,0.72)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`Bracelet ${number} is empty`}
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ duration: MOTION.base, ease: MOTION.ease }}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          background: COLORS.surface,
          border: `1px solid ${COLORS.borderStrong}`,
          borderBottom: 'none',
          borderRadius: `${RADIUS.lg}px ${RADIUS.lg}px 0 0`,
          padding: SPACE.xl,
          paddingBottom: `calc(${SPACE.xl}px + env(safe-area-inset-bottom, 0px))`,
          display: 'flex',
          flexDirection: 'column',
          gap: SPACE.lg,
        }}
      >
        <CornerBracket position="tl" color={COLORS.info} size={12} />
        <CornerBracket position="tr" color={COLORS.info} size={12} />

        {/* Header row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
            <QrCode size={14} strokeWidth={1.75} color={COLORS.info} />
            <BracketLabel tone="primary">BRACELET SCANNED</BracketLabel>
          </div>
          <button
            type="button"
            onClick={() => {
              triggerHaptic('light');
              onCancel();
            }}
            aria-label="Cancel"
            style={{
              minHeight: 36,
              minWidth: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              color: COLORS.textSecondary,
              cursor: 'pointer',
            }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Hero — the number */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: SPACE.xs,
            padding: `${SPACE.lg}px 0`,
            borderTop: `1px solid ${COLORS.border}`,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <Mono tone="muted" size="xs">
            SLOT
          </Mono>
          <div
            style={{
              fontFamily: FONTS.mono,
              fontSize: 88,
              lineHeight: 1,
              fontWeight: 700,
              color: COLORS.textPrimary,
              letterSpacing: '-0.02em',
            }}
          >
            #{number}
          </div>
          <Mono tone="secondary" size="sm">
            EMPTY — NO PATIENT LINKED
          </Mono>
        </div>

        {/* Copy */}
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 14,
            color: COLORS.textSecondary,
            lineHeight: 1.45,
            letterSpacing: '-0.005em',
          }}
        >
          This bracelet isn't tied to anyone yet. Admit a new patient
          and this number will be linked to their chart — every future
          scan of this bracelet will open that patient.
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: SPACE.sm }}>
          <TacticalButton
            variant="secondary"
            size="md"
            onClick={onCancel}
            style={{ flex: 1 }}
          >
            CANCEL
          </TacticalButton>
          <TacticalButton
            variant="primary"
            size="md"
            icon={<UserPlus size={14} strokeWidth={2} />}
            onClick={() => {
              triggerHaptic('medium');
              onAdmit(number);
            }}
            style={{ flex: 2 }}
          >
            ADMIT WITH #{number}
          </TacticalButton>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EmptyBraceletSheet;
