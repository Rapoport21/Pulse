import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Copy, Check, BrainCircuit, RefreshCw, Send } from 'lucide-react';
import { UserProfile } from '../types';
import { ROLE_INSIGHTS } from '../data/userProfiles';
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
  SectionTitle,
  TacticalCard,
  TacticalButton,
  ScanningLine,
} from './design';

interface BriefMeProps {
  isSurgeActive: boolean;
  currentUser: UserProfile;
  showToast?: (message: string, type?: 'success' | 'info' | 'error') => void;
}

type SbarSection = 'S' | 'B' | 'A' | 'R';

const SECTION_NAMES: Record<SbarSection, string> = {
  S: 'Situation',
  B: 'Background',
  A: 'Assessment',
  R: 'Recommendation',
};

/**
 * BriefMe — AI-synthesized SBAR operational handoff.
 * Refactored to the tactical design system: mono labels, tactical card
 * container, scanning-line loading state, bracket-labeled SBAR sections.
 */
export const BriefMe: React.FC<BriefMeProps> = ({
  isSurgeActive,
  currentUser,
  showToast,
}) => {
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [briefingGenerated, setBriefingGenerated] = useState(false);

  const insights = ROLE_INSIGHTS[currentUser.role];

  // Simulate AI generation time
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 1500);
    return () => clearTimeout(timer);
  }, [isSurgeActive, currentUser]);

  const handleCopy = () => {
    setCopied(true);
    if (showToast) showToast('Briefing copied to clipboard', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateBriefing = () => {
    setLoading(true);
    if (showToast) showToast('Generating Executive Briefing...', 'info');
    setTimeout(() => {
      setLoading(false);
      setBriefingGenerated(true);
      if (showToast) showToast('Executive Briefing generated successfully', 'success');
      setTimeout(() => setBriefingGenerated(false), 3000);
    }, 1500);
  };

  const situationLine = isSurgeActive
    ? `Surge Protocol Level 2 is ACTIVE. ${insights.situation}`
    : insights.situation;

  const sections: Array<{ key: SbarSection; body: string }> = [
    { key: 'S', body: situationLine },
    { key: 'B', body: insights.background },
    { key: 'A', body: insights.assessment },
    { key: 'R', body: insights.recommendation },
  ];

  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: SPACE['2xl'],
        background: COLORS.bg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <div style={{ width: '100%', maxWidth: 820 }}>
        {/* Header */}
        <SectionTitle
          id="BRIEF.SBAR"
          label="Operational Handoff"
          divider={false}
          meta={
            <BracketLabel tone="info" size="xs">
              SYNTH · SBAR
            </BracketLabel>
          }
          style={{ marginBottom: SPACE.sm }}
        />
        <Mono tone="muted" size="xs" style={{ display: 'block', marginBottom: SPACE['2xl'] }}>
          {`// Condensed summary for ${currentUser.role} · real-time telemetry snapshot`}
        </Mono>

        {/* Brief card */}
        <TacticalCard
          padding="none"
          style={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          {/* Card header bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${SPACE.md}px ${SPACE.lg}px`,
              borderBottom: `1px solid ${COLORS.border}`,
              background: COLORS.surfaceElev,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.md }}>
              <Mono tone="muted" size="xs">
                NODE ER-01
              </Mono>
              <span style={{ color: COLORS.textDim }}>│</span>
              <Mono tone="muted" size="xs">
                {currentUser.name}
              </Mono>
              <span style={{ color: COLORS.textDim }}>│</span>
              <Mono tone="muted" size="xs">
                {new Date().toISOString().slice(0, 16).replace('T', ' ')}Z
              </Mono>
            </div>
            <StatusPill
              label={isSurgeActive ? 'Surge L2 · Active' : 'Routine'}
              tone={isSurgeActive ? 'crit' : 'ok'}
              pulse={isSurgeActive}
            />
          </div>

          {/* Body */}
          <div
            style={{
              position: 'relative',
              minHeight: 320,
              padding: SPACE['2xl'],
              fontFamily: FONTS.mono,
              fontSize: 16,
              lineHeight: 1.65,
              color: COLORS.textSecondary,
            }}
          >
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: MOTION.fast }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: SPACE.base,
                  }}
                >
                  <RefreshCw
                    size={28}
                    color={COLORS.info}
                    strokeWidth={2}
                    style={{ animation: 'spin 1.4s linear infinite' }}
                  />
                  <Mono
                    tone="secondary"
                    size="sm"
                    style={{ animation: 'pulse-dot 1.6s ease-in-out infinite' }}
                  >
                    Synthesizing metrics for {currentUser.name}…
                  </Mono>
                </motion.div>
              ) : (
                <motion.div
                  key="content"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: MOTION.base, ease: MOTION.ease }}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: SPACE.lg,
                  }}
                >
                  {sections.map((s, i) => (
                    <motion.div
                      key={s.key}
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        delay: i * 0.08,
                        duration: MOTION.base,
                        ease: MOTION.ease,
                      }}
                      style={{
                        display: 'flex',
                        gap: SPACE.base,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          position: 'relative',
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: COLORS.surface,
                          border: `1px solid ${COLORS.borderStrong}`,
                          borderRadius: RADIUS.sm,
                          color: COLORS.info,
                          fontFamily: FONTS.mono,
                          fontWeight: 600,
                          fontSize: 15,
                          flexShrink: 0,
                          marginTop: 1,
                        }}
                      >
                        {s.key}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <Mono tone="info" size="xs">
                          {SECTION_NAMES[s.key]}
                        </Mono>
                        <p
                          style={{
                            margin: '6px 0 0',
                            fontFamily: FONTS.sans,
                            fontSize: 17,
                            color: COLORS.textPrimary,
                            lineHeight: 1.55,
                            letterSpacing: '-0.003em',
                            whiteSpace: 'pre-line',
                          }}
                        >
                          {s.body}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: `${SPACE.md}px ${SPACE.lg}px`,
              borderTop: `1px solid ${COLORS.border}`,
              background: COLORS.bgDeep,
              gap: SPACE.md,
              flexWrap: 'wrap',
            }}
          >
            <Mono tone="dim" size="xs">
              Generated from real-time telemetry
            </Mono>
            <div style={{ display: 'flex', gap: SPACE.sm, flexWrap: 'wrap' }}>
              {currentUser.role === 'Floor Manager' && (
                <TacticalButton
                  variant={briefingGenerated ? 'primary' : 'primary'}
                  size="sm"
                  onClick={handleGenerateBriefing}
                  disabled={loading}
                  icon={
                    briefingGenerated ? (
                      <Check size={16} strokeWidth={2} />
                    ) : (
                      <BrainCircuit size={16} strokeWidth={1.75} />
                    )
                  }
                  style={
                    briefingGenerated
                      ? { borderColor: COLORS.ok, color: COLORS.ok }
                      : undefined
                  }
                >
                  {briefingGenerated
                    ? 'Sent to C-Suite'
                    : 'Generate Executive Briefing'}
                </TacticalButton>
              )}
              <TacticalButton
                variant="secondary"
                size="sm"
                onClick={handleCopy}
                disabled={loading}
                icon={
                  copied ? (
                    <Check size={16} strokeWidth={2} />
                  ) : (
                    <Copy size={16} strokeWidth={2} />
                  )
                }
                style={
                  copied
                    ? { borderColor: COLORS.ok, color: COLORS.ok }
                    : undefined
                }
              >
                {copied ? 'Copied' : 'Copy Summary'}
              </TacticalButton>
            </div>
          </div>
        </TacticalCard>
      </div>

      <style>
        {`@keyframes spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }`}
      </style>
    </div>
  );
};
