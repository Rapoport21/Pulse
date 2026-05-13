import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ClipboardList,
  CheckCircle,
  AlertOctagon,
  X,
  LogOut,
  LogIn,
} from 'lucide-react';
import {
  COLORS,
  FONTS,
  TYPE,
  SPACE,
  RADIUS,
  MOTION, cssTransition,
  Mono,
  BracketLabel,
  SectionTitle,
  TacticalButton,
  CornerBracket,
  StatusPill,
} from './design';
import { Z } from './design/tokens';

interface ShiftHandoffModalProps {
  type: 'in' | 'out';
  role: string;
  onComplete: (notes?: string) => void;
  onCancel?: () => void;
  loginCount?: number;
}

/**
 * ShiftHandoffModal — tactical briefing ('in') or handoff ('out') dialog.
 * Shows critical updates + inherited actions for in-briefing, or a note
 * capture textarea for end-of-shift handoff.
 */
export const ShiftHandoffModal: React.FC<ShiftHandoffModalProps> = ({
  type,
  role,
  onComplete,
  onCancel,
  loginCount = 1,
}) => {
  const [note, setNote] = useState('');
  const [noteFocused, setNoteFocused] = useState(false);

  const isIn = type === 'in';
  const displayRole = role.replace(/_/g, ' ');

  const HeaderIcon = isIn ? ClipboardList : LogOut;
  const surgeStable = loginCount > 1;

  // Array-back the briefing payload so the section headers can show
  // accurate counts and the body scales cleanly to N items. Body
  // already has `overflowY: auto` and the footer is a flex sibling,
  // so a 50+ item briefing scrolls inside the modal without pushing
  // the Acknowledge button off-screen (Matt Taylor 2026-05-12).
  type CriticalUpdate = { tone: 'ok' | 'crit'; message: string };
  const criticalUpdates: CriticalUpdate[] = surgeStable
    ? [
        {
          tone: 'ok',
          message:
            'Surge protocol successfully de-escalated. Capacity is stable. Monitor fast-track throughput.',
        },
      ]
    : [
        {
          tone: 'crit',
          message:
            'ER is currently holding 4 admitted patients. ICU capacity is at 95%. Expedite step-down transfers.',
        },
      ];

  const inheritedActions: string[] = [
    'Review 3 pending discharge summaries.',
    'Follow up on Blood Bank inventory.',
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: MOTION.fast, ease: MOTION.ease }}
        onClick={onCancel}
        style={{
          // Login briefing / shift handoff is a hard pre-app gate.
          // It is the first thing the user sees after auth (or last
          // thing before logout) and must FULLY take over the screen,
          // including the bottom HUD nav. Per Nick on 2026-04-18:
          // "navbar is still visible during log in pop up. should
          // not be." The general app rule (overlays clear the nav)
          // does not apply to this dialog — there is nothing
          // actionable in the navbar until the user dismisses this.
          position: 'fixed',
          inset: 0,
          zIndex: Z.toast,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: SPACE.md,
          background: 'rgba(0, 0, 0, 0.86)',
          backdropFilter: 'blur(6px)',
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
            maxWidth: 560,
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            background: COLORS.surface,
            border: `1px solid ${COLORS.borderStrong}`,
            borderRadius: RADIUS.sm,
            boxShadow:
              '0 40px 80px rgba(0,0,0,0.55), 0 0 0 1px rgba(225,29,72,0.08)',
            overflow: 'hidden',
          }}
        >
          <CornerBracket position="tl" color={COLORS.borderStrong} size={8} thickness={1} inset={-1} />
          <CornerBracket position="br" color={COLORS.borderStrong} size={8} thickness={1} inset={-1} />

          {/* Header */}
          <div
            style={{
              padding: `${SPACE.lg}px ${SPACE.lg}px ${SPACE.md}px`,
              borderBottom: `1px solid ${COLORS.border}`,
              background: COLORS.surfaceElev,
              position: 'relative',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: SPACE.md,
                marginBottom: SPACE.sm,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md, minWidth: 0 }}>
                <div
                  style={{
                    position: 'relative',
                    width: 36,
                    height: 36,
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
                  <HeaderIcon size={16} strokeWidth={2} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <BracketLabel tone="secondary" size="xs">
                    {isIn ? 'HANDOFF · IN' : 'HANDOFF · OUT'}
                  </BracketLabel>
                  <h2
                    style={{
                      fontFamily: FONTS.sans,
                      fontSize: TYPE.h3.size,
                      fontWeight: TYPE.h3.weight,
                      letterSpacing: TYPE.h3.tracking,
                      lineHeight: 1.2,
                      color: COLORS.textPrimary,
                      margin: '4px 0 0',
                    }}
                  >
                    {isIn ? 'Shift Briefing' : 'End of Shift Handoff'}
                  </h2>
                </div>
              </div>

              {onCancel && (
                <button
                  type="button"
                  onClick={onCancel}
                  aria-label="Close"
                  style={{
                    width: 28,
                    height: 28,
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
              )}
            </div>

            {/* Meta row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.md,
                flexWrap: 'wrap',
              }}
            >
              <Mono tone="muted" size="xs">
                ROLE
              </Mono>
              <Mono tone="primary" size="xs" style={{ textTransform: 'uppercase' }}>
                {displayRole}
              </Mono>
              <span style={{ color: COLORS.textDim }}>│</span>
              <Mono tone="muted" size="xs">
                {new Date().toISOString().slice(0, 16).replace('T', ' ')}Z
              </Mono>
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
            {isIn ? (
              <>
                {/* Critical updates */}
                <div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: SPACE.sm,
                    }}
                  >
                    <BracketLabel tone="muted" size="xs">
                      CRITICAL UPDATES · {criticalUpdates.length}
                    </BracketLabel>
                    <StatusPill
                      label={surgeStable ? 'Stable' : 'Action Required'}
                      tone={surgeStable ? 'ok' : 'crit'}
                      pulse={!surgeStable}
                    />
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACE.xs,
                    }}
                  >
                    {criticalUpdates.map((update, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'relative',
                          display: 'flex',
                          gap: SPACE.sm,
                          padding: `${SPACE.base}px ${SPACE.md}px`,
                          background: COLORS.bgDeep,
                          border: `1px solid ${update.tone === 'ok' ? COLORS.ok : COLORS.crit}`,
                          borderLeft: `3px solid ${update.tone === 'ok' ? COLORS.ok : COLORS.crit}`,
                          borderRadius: RADIUS.sm,
                        }}
                      >
                        {update.tone === 'ok' ? (
                          <CheckCircle
                            size={16}
                            strokeWidth={2}
                            color={COLORS.ok}
                            style={{ flexShrink: 0, marginTop: 1 }}
                          />
                        ) : (
                          <AlertOctagon
                            size={16}
                            strokeWidth={2}
                            color={COLORS.crit}
                            style={{ flexShrink: 0, marginTop: 1 }}
                          />
                        )}
                        <p
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 13,
                            color: COLORS.textPrimary,
                            lineHeight: 1.5,
                            margin: 0,
                          }}
                        >
                          {update.message}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inherited actions */}
                <div>
                  <BracketLabel tone="muted" size="xs">
                    INHERITED ACTIONS · {inheritedActions.length}
                  </BracketLabel>
                  <div
                    style={{
                      marginTop: SPACE.sm,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: SPACE.xs,
                    }}
                  >
                    {inheritedActions.map((action, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          gap: SPACE.sm,
                          alignItems: 'flex-start',
                          padding: `${SPACE.sm}px ${SPACE.md}px`,
                          background: COLORS.bgDeep,
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.sm,
                        }}
                      >
                        <Mono
                          tone="secondary"
                          size="xs"
                          style={{ flexShrink: 0, marginTop: 1, minWidth: 18 }}
                        >
                          {String(i + 1).padStart(2, '0')}
                        </Mono>
                        <span
                          style={{
                            fontFamily: FONTS.sans,
                            fontSize: 13,
                            color: COLORS.textPrimary,
                            lineHeight: 1.45,
                          }}
                        >
                          {action}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div>
                <BracketLabel tone="muted" size="xs">
                  HANDOFF NOTES
                </BracketLabel>
                <Mono
                  tone="dim"
                  size="xs"
                  style={{ display: 'block', margin: `${SPACE.xs}px 0 ${SPACE.sm}px` }}
                >
                  {`// Leave a note for the incoming ${displayRole}`}
                </Mono>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onFocus={() => setNoteFocused(true)}
                  onBlur={() => setNoteFocused(false)}
                  placeholder="e.g., Follow up with Dr. Smith regarding Bed 4…"
                  style={{
                    width: '100%',
                    minHeight: 128,
                    padding: SPACE.md,
                    background: COLORS.bgDeep,
                    border: `1px solid ${noteFocused ? COLORS.accent : COLORS.border}`,
                    borderRadius: RADIUS.sm,
                    color: COLORS.textPrimary,
                    fontFamily: FONTS.sans,
                    fontSize: 13,
                    lineHeight: 1.5,
                    resize: 'vertical',
                    outline: 'none',
                    transition: `border-color ${MOTION.fast}s ease`,
                    boxShadow: noteFocused ? `0 0 0 3px ${COLORS.accentGlow}` : 'none',
                  }}
                />
              </div>
            )}
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
            <Mono tone="dim" size="xs">
              {isIn ? 'Acknowledge to start shift' : 'Submit to end shift'}
            </Mono>
            <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
              {onCancel && (
                <TacticalButton variant="ghost" size="sm" onClick={onCancel}>
                  Cancel
                </TacticalButton>
              )}
              <TacticalButton
                variant="primary"
                size="sm"
                onClick={() => onComplete(isIn ? undefined : note)}
                icon={
                  isIn ? (
                    <LogIn size={13} strokeWidth={2} />
                  ) : (
                    <LogOut size={13} strokeWidth={2} />
                  )
                }
              >
                {isIn ? 'Acknowledge & Start' : 'Submit & Logout'}
              </TacticalButton>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
