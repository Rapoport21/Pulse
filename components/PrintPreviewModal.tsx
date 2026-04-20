import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Printer, FileText, AlertTriangle } from 'lucide-react';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION, cssTransition,
  Mono,
  BracketLabel,
  TacticalButton,
  CornerBracket,
} from './design';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  title: string;
  content: React.ReactNode;
}

/**
 * PrintPreviewModal — tactical chrome wrapping a white-paper print preview.
 * The inner preview area stays white so it accurately reflects print output;
 * everything else is tactical (bracket labels, mono meta, sharp corners).
 */
export const PrintPreviewModal: React.FC<PrintPreviewModalProps> = ({
  isOpen,
  onClose,
  onPrint,
  title,
  content,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: MOTION.fast, ease: MOTION.ease }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: SPACE.md,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: MOTION.base, ease: MOTION.ease }}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'relative',
              width: '100%',
              maxWidth: 820,
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              background: COLORS.surface,
              border: `1px solid ${COLORS.borderStrong}`,
              borderRadius: RADIUS.sm,
              boxShadow: '0 40px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(225,29,72,0.08)',
              overflow: 'hidden',
            }}
          >
            {/* Corner brackets on the outer shell */}
            <CornerBracket position="tl" color={COLORS.borderStrong} size={8} thickness={1} inset={-1} />
            <CornerBracket position="br" color={COLORS.borderStrong} size={8} thickness={1} inset={-1} />

            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: SPACE.md,
                padding: `${SPACE.md}px ${SPACE.lg}px`,
                borderBottom: `1px solid ${COLORS.border}`,
                background: COLORS.surfaceElev,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, minWidth: 0 }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
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
                  <FileText size={14} strokeWidth={2} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <BracketLabel tone="secondary" size="xs">
                    PRINT · PREVIEW
                  </BracketLabel>
                  <div
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: 14,
                      fontWeight: 600,
                      color: COLORS.textPrimary,
                      letterSpacing: '-0.003em',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      marginTop: 2,
                    }}
                  >
                    {title}
                  </div>
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
                  transition: cssTransition(),
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
                <X size={14} strokeWidth={2} />
              </button>
            </div>

            {/* White paper preview area — stays white so it matches real print output */}
            <div
              className="print-content"
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: `${SPACE['2xl']}px`,
                background: '#FFFFFF',
                color: '#000000',
              }}
            >
              <div style={{ maxWidth: 640, margin: '0 auto' }}>
                <div
                  style={{
                    borderBottom: '2px solid #000000',
                    paddingBottom: 16,
                    marginBottom: 24,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                    gap: 16,
                  }}
                >
                  <div>
                    <h1
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 28,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '-0.01em',
                        margin: 0,
                        color: '#000000',
                      }}
                    >
                      {title}
                    </h1>
                    <p
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 12,
                        color: '#4B5563',
                        margin: '4px 0 0',
                      }}
                    >
                      Generated: {new Date().toLocaleString()}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div
                      style={{
                        fontFamily: FONTS.sans,
                        fontSize: 18,
                        fontWeight: 700,
                        color: '#000000',
                      }}
                    >
                      PULSE OPS
                    </div>
                    <div
                      style={{
                        fontFamily: FONTS.mono,
                        fontSize: 10,
                        color: '#6B7280',
                        letterSpacing: '0.08em',
                      }}
                    >
                      CONFIDENTIAL
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: FONTS.sans,
                    fontSize: 14,
                    color: '#000000',
                    lineHeight: 1.6,
                  }}
                >
                  {content}
                </div>
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
                flexShrink: 0,
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.sm,
                  color: COLORS.warn,
                }}
              >
                <AlertTriangle size={12} strokeWidth={2} />
                <Mono tone="warn" size="xs">
                  Verify printer online · paper loaded
                </Mono>
              </div>
              <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
                <TacticalButton variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </TacticalButton>
                <TacticalButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    onPrint();
                    onClose();
                  }}
                  icon={<Printer size={13} strokeWidth={2} />}
                >
                  Confirm Print
                </TacticalButton>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
