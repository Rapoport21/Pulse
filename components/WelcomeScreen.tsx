/**
 * WelcomeScreen — the pre-login explainer.
 *
 * Lives between the cinematic boot and the login form. Single
 * vertical scroll. On-brand tactical HUD (Geist + near-black + rose
 * accent) but with marketing-page spacing — generous whitespace,
 * dramatic type scale, ambient motion. Five sections:
 *
 *   1. HERO       big [PULSE] wordmark + tagline + scroll hint
 *   2. THE GAP    the problem · 6 disconnected systems condense into 1
 *   3. PILLARS    SEE / DO / GO — each with a live mini-demo loop
 *   4. ROLES      Manager · Charge Nurse · ER Personnel · Trauma
 *   5. CTA        Enter PULSE button
 *
 * Session-only: every fresh page load starts here. Clicking the
 * Enter button flips session state and the LoginScreen mounts. The
 * surface is intentionally not localStorage-persisted: it IS the
 * landing surface, not a one-shot onboarding flow.
 *
 * Mobile-aware: ≤640px goes single column, scaled type, condensed
 * paddings. Respects prefers-reduced-motion globally.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, useInView, useReducedMotion } from 'motion/react';
import {
  ArrowRight, Activity, ListChecks, Smartphone,
  Shield, Stethoscope, HeartPulse, Crown,
  ChevronDown,
} from 'lucide-react';
import {
  COLORS, FONTS, SPACE, RADIUS, MOTION,
  Mono, BracketLabel, CornerBracket, ScanningLine,
} from './design';

// ════════════════════════════════════════════════════════════════
// Component
// ════════════════════════════════════════════════════════════════

interface WelcomeScreenProps {
  onEnter: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onEnter }) => {
  const reduceMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={scrollRef}
      style={{
        position: 'fixed',
        inset: 0,
        background: COLORS.bg,
        color: COLORS.textPrimary,
        fontFamily: FONTS.sans,
        overflowY: 'auto',
        overflowX: 'hidden',
        scrollBehavior: reduceMotion ? 'auto' : 'smooth',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <HeroSection onScrollHint={() => {
        const next = document.getElementById('welcome-gap');
        next?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
      }} />

      <GapSection reduceMotion={!!reduceMotion} />

      <PillarsSection reduceMotion={!!reduceMotion} />

      <RolesSection />

      <CtaSection onEnter={onEnter} />
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// Shared visual primitives
// ════════════════════════════════════════════════════════════════

// Reveal helper — wraps content with a scroll-triggered fade-up
const Reveal: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 0 }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-10% 0px' });
  const reduce = useReducedMotion();
  return (
    <motion.div
      ref={ref}
      initial={reduce ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : undefined}
      transition={{ duration: 0.8, ease: MOTION.easeSmooth, delay }}
    >
      {children}
    </motion.div>
  );
};

// Section frame — consistent padding + max-width
const Section: React.FC<{
  id?: string;
  children: React.ReactNode;
  topPad?: boolean;
  minH?: string;
}> = ({ id, children, topPad = true, minH }) => (
  <section
    id={id}
    style={{
      padding: `${topPad ? 'clamp(72px, 12vh, 144px)' : '0'} clamp(20px, 5vw, 56px)`,
      minHeight: minH,
      position: 'relative',
    }}
  >
    <div
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        position: 'relative',
      }}
    >
      {children}
    </div>
  </section>
);

// ════════════════════════════════════════════════════════════════
// 1. HERO
// ════════════════════════════════════════════════════════════════

const HeroSection: React.FC<{ onScrollHint: () => void }> = ({ onScrollHint }) => {
  const reduce = useReducedMotion();
  return (
    <Section topPad={false} minH="100lvh">
      <div
        style={{
          // box-sizing: border-box ensures padding stays INSIDE the
          // 100lvh box (instead of stacking on top of it). Without
          // this the absolutely-positioned scroll hint slid below
          // the visible viewport on iPhone.
          boxSizing: 'border-box',
          minHeight: '100lvh',
          display: 'flex',
          flexDirection: 'column',
          // space-between distributes: pre-headline at top, content
          // block centered (via flex:1 spacer), scroll hint at bottom.
          // Guarantees the scroll hint is always in the visible area
          // when the page is at the top.
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          paddingTop: 'clamp(72px, 11vh, 132px)',
          paddingBottom: 'calc(max(env(safe-area-inset-bottom), 20px) + 24px)',
          position: 'relative',
          gap: 'clamp(20px, 4vh, 48px)',
        }}
      >
        {/* Ambient scanline */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: '50%',
            height: 1,
            background: COLORS.border,
            pointerEvents: 'none',
            opacity: 0.6,
          }}
        />
        <ScanningLine color={COLORS.accent} duration={18} />

        {/* TOP — pre-headline */}
        <motion.div
          initial={reduce ? undefined : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: MOTION.easeSmooth, delay: 0.1 }}
          style={{ position: 'relative', zIndex: 1 }}
        >
          <Mono tone="dim" size="xs" style={{ letterSpacing: '0.22em' }}>
            // 2026 · OPERATIONAL INTELLIGENCE · HOSPITAL OPERATIONS
          </Mono>
        </motion.div>

        {/* MIDDLE — wordmark + tagline + sub. flex:1 makes it absorb
            any spare vertical space, keeping itself optically
            centered and pushing the scroll hint to the bottom. */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'flex-start',
            gap: 'clamp(20px, 3vh, 32px)',
            width: '100%',
            position: 'relative',
            zIndex: 1,
            minHeight: 0,
          }}
        >
          {/* Bracketed wordmark */}
          <motion.div
            initial={reduce ? undefined : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.0, ease: MOTION.easeSmooth, delay: 0.25 }}
            style={{
              position: 'relative',
              padding: '8px 22px',
              border: `1px solid ${COLORS.accent}`,
              background: `${COLORS.accent}0a`,
            }}
          >
            <CornerBracket position="tl" color={COLORS.accent} size={10} thickness={2} />
            <CornerBracket position="tr" color={COLORS.accent} size={10} thickness={2} />
            <CornerBracket position="bl" color={COLORS.accent} size={10} thickness={2} />
            <CornerBracket position="br" color={COLORS.accent} size={10} thickness={2} />
            <span
              style={{
                fontFamily: FONTS.mono,
                fontSize: 'clamp(56px, 11vw, 120px)',
                fontWeight: 700,
                letterSpacing: '-0.04em',
                color: COLORS.textPrimary,
                lineHeight: 0.95,
                display: 'inline-block',
              }}
            >
              PULSE
            </span>
          </motion.div>

          {/* Tagline */}
          <motion.h1
            initial={reduce ? undefined : { opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: MOTION.easeSmooth, delay: 0.45 }}
            style={{
              fontFamily: FONTS.sans,
              fontSize: 'clamp(30px, 5vw, 64px)',
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.04,
              color: COLORS.textPrimary,
              margin: 0,
              maxWidth: 880,
            }}
          >
            See risk clearly. Act together.
          </motion.h1>

          {/* Sub-explainer */}
          <motion.p
            initial={reduce ? undefined : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: MOTION.easeSmooth, delay: 0.6 }}
            style={{
              fontFamily: FONTS.sans,
              fontSize: 'clamp(14px, 1.4vw, 18px)',
              color: COLORS.textSecondary,
              margin: 0,
              maxWidth: 640,
              lineHeight: 1.55,
              letterSpacing: '-0.005em',
            }}
          >
            PULSE is the operational intelligence layer for the whole
            hospital. One view of every system, every patient, every
            shift. Built by clinicians, for clinicians.
          </motion.p>
        </div>

        {/* BOTTOM — scroll hint. In-flow (not absolute) so it always
            sits at the visible bottom of the viewport on first
            paint. Rose-tinted + label so it's unambiguous. */}
        <motion.button
          type="button"
          onClick={onScrollHint}
          aria-label="Scroll to learn more"
          initial={reduce ? undefined : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6, ease: MOTION.easeSmooth }}
          style={{
            alignSelf: 'center',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            fontFamily: FONTS.mono,
            fontSize: 11,
            letterSpacing: '0.18em',
            color: COLORS.accent,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <span style={{ fontWeight: 600 }}>SCROLL TO LEARN MORE</span>
          <motion.span
            aria-hidden
            animate={reduce ? undefined : { y: [0, 5, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              // Fixed square box + flex centering keeps the chevron
              // dead-centered. The -1px translateY corrects for the
              // chevron's bottom-weighted visual mass (the V points
              // down, so optical centering wants the icon a hair higher
              // than geometric centering).
              width: 26,
              height: 26,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: `1px solid ${COLORS.accent}`,
              borderRadius: RADIUS.full,
              background: `${COLORS.accent}14`,
            }}
          >
            <ChevronDown
              size={14}
              strokeWidth={2.25}
              color={COLORS.accent}
              style={{ transform: 'translateY(-1px)' }}
            />
          </motion.span>
        </motion.button>
      </div>
    </Section>
  );
};

// ════════════════════════════════════════════════════════════════
// 2. THE GAP
// ════════════════════════════════════════════════════════════════

const GapSection: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => (
  <Section id="welcome-gap">
    <Reveal>
      <Mono tone="accent" size="xs" style={{ letterSpacing: '0.22em' }}>
        // THE GAP
      </Mono>
    </Reveal>
    <Reveal delay={0.1}>
      <h2
        style={{
          fontFamily: FONTS.sans,
          fontSize: 'clamp(28px, 4vw, 52px)',
          fontWeight: 600,
          letterSpacing: '-0.025em',
          lineHeight: 1.08,
          color: COLORS.textPrimary,
          margin: '20px 0 24px',
          maxWidth: 880,
        }}
      >
        Hospital teams run inside a dozen disconnected systems.
      </h2>
    </Reveal>
    <Reveal delay={0.2}>
      <p
        style={{
          fontFamily: FONTS.sans,
          fontSize: 'clamp(14px, 1.2vw, 16px)',
          color: COLORS.textSecondary,
          margin: '0 0 56px',
          maxWidth: 680,
          lineHeight: 1.6,
        }}
      >
        EHR, lab, pharmacy, paging, bed board, EVS, vitals monitor.
        Each with its own ping. Critical signal gets lost in the noise.
        Handoffs get interrupted. Decisions get delayed.
      </p>
    </Reveal>

    <Reveal delay={0.3}>
      <SystemsCondenseDiagram reduceMotion={reduceMotion} />
    </Reveal>
  </Section>
);

const FRAGMENTED_SYSTEMS = ['EHR', 'LAB', 'PHARM', 'PAGE', 'EVS', 'VITALS'];

const SystemsCondenseDiagram: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: '-15% 0px' });

  return (
    <div
      ref={ref}
      style={{
        padding: '40px clamp(16px, 3vw, 36px)',
        background: COLORS.surface,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <CornerBracket position="tl" color={COLORS.border} size={6} thickness={1} />
      <CornerBracket position="tr" color={COLORS.border} size={6} thickness={1} />
      <CornerBracket position="bl" color={COLORS.border} size={6} thickness={1} />
      <CornerBracket position="br" color={COLORS.border} size={6} thickness={1} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: SPACE.lg,
          flexWrap: 'wrap',
          rowGap: SPACE.xl,
        }}
      >
        {/* Fragmented pills */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: SPACE.sm,
            maxWidth: 460,
          }}
        >
          {FRAGMENTED_SYSTEMS.map((s, i) => (
            <motion.span
              key={s}
              initial={reduceMotion ? undefined : { opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : undefined}
              transition={{
                duration: 0.6,
                ease: MOTION.easeSmooth,
                delay: 0.05 * i,
              }}
              style={{
                padding: '8px 14px',
                background: COLORS.bgDeep,
                border: `1px solid ${COLORS.borderStrong}`,
                borderRadius: RADIUS.full,
                fontFamily: FONTS.mono,
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.textSecondary,
                letterSpacing: '0.12em',
              }}
            >
              {s}
            </motion.span>
          ))}
        </div>

        {/* Arrow */}
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, x: -10 }}
          animate={inView ? { opacity: 1, x: 0 } : undefined}
          transition={{ duration: 0.7, ease: MOTION.easeSmooth, delay: 0.55 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              width: 48,
              height: 1,
              background: `linear-gradient(90deg, transparent, ${COLORS.accent})`,
            }}
          />
          <ArrowRight size={18} strokeWidth={2} color={COLORS.accent} />
        </motion.div>

        {/* Consolidated PULSE pill */}
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
          animate={inView ? { opacity: 1, scale: 1 } : undefined}
          transition={{ duration: 0.7, ease: MOTION.easeSmooth, delay: 0.75 }}
          style={{
            position: 'relative',
            padding: '14px 28px',
            background: `${COLORS.accent}18`,
            border: `1px solid ${COLORS.accent}`,
            borderRadius: RADIUS.full,
            fontFamily: FONTS.mono,
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.textPrimary,
            letterSpacing: '0.16em',
            boxShadow: `0 0 24px ${COLORS.accentGlow}`,
          }}
        >
          <motion.span
            aria-hidden
            animate={reduceMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute',
              left: 14,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 6,
              height: 6,
              borderRadius: RADIUS.full,
              background: COLORS.accent,
              boxShadow: `0 0 8px ${COLORS.accent}`,
            }}
          />
          <span style={{ marginLeft: 14 }}>PULSE</span>
        </motion.div>
      </div>
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// 3. PILLARS
// ════════════════════════════════════════════════════════════════

const PillarsSection: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => (
  <Section>
    <Reveal>
      <Mono tone="accent" size="xs" style={{ letterSpacing: '0.22em' }}>
        // THE PILLARS
      </Mono>
    </Reveal>
    <Reveal delay={0.1}>
      <h2
        style={{
          fontFamily: FONTS.sans,
          fontSize: 'clamp(28px, 4vw, 52px)',
          fontWeight: 600,
          letterSpacing: '-0.025em',
          lineHeight: 1.08,
          color: COLORS.textPrimary,
          margin: '20px 0 56px',
          maxWidth: 880,
        }}
      >
        See it. Run it. Carry it.
      </h2>
    </Reveal>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: SPACE.lg,
      }}
    >
      <Reveal delay={0.2}>
        <PillarCard
          icon={<Activity size={16} strokeWidth={1.75} />}
          label="SEE"
          title="Situational awareness"
          body="Capacity, NEDOCS, alerts, surge state. The whole hospital in one glance. The signal stays above the noise."
          demo={<CapacityDemo reduceMotion={reduceMotion} />}
        />
      </Reveal>
      <Reveal delay={0.3}>
        <PillarCard
          icon={<ListChecks size={16} strokeWidth={1.75} />}
          label="DO"
          title="Coordination · with AI"
          body="Tasks extracted from every call. The AI runs the mechanical ones itself. You only see the items that need clinical judgment."
          demo={<TaskFeedDemo reduceMotion={reduceMotion} />}
        />
      </Reveal>
      <Reveal delay={0.4}>
        <PillarCard
          icon={<Smartphone size={16} strokeWidth={1.75} />}
          label="GO"
          title="On the ground"
          body="Mobile companion built for one-handed use. Your shift, your patients, your inbox. Always within reach."
          demo={<TranscriptDemo reduceMotion={reduceMotion} />}
        />
      </Reveal>
    </div>
  </Section>
);

const PillarCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  title: string;
  body: string;
  demo: React.ReactNode;
}> = ({ icon, label, title, body, demo }) => (
  <div
    style={{
      position: 'relative',
      padding: 24,
      background: COLORS.surface,
      border: `1px solid ${COLORS.border}`,
      borderRadius: RADIUS.sm,
      display: 'flex',
      flexDirection: 'column',
      gap: SPACE.md,
      minHeight: 420,
    }}
  >
    <CornerBracket position="tl" color={COLORS.borderStrong} size={6} thickness={1} />
    <CornerBracket position="br" color={COLORS.borderStrong} size={6} thickness={1} />

    {/* Eyebrow */}
    <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm }}>
      <span
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: `${COLORS.accent}14`,
          border: `1px solid ${COLORS.accent}`,
          borderRadius: RADIUS.sm,
          color: COLORS.accent,
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <BracketLabel tone="accent" size="xs">
        {label}
      </BracketLabel>
    </div>

    {/* Title + body */}
    <div>
      <h3
        style={{
          fontFamily: FONTS.sans,
          fontSize: 22,
          fontWeight: 600,
          letterSpacing: '-0.015em',
          color: COLORS.textPrimary,
          margin: '0 0 10px',
          lineHeight: 1.2,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: FONTS.sans,
          fontSize: 14,
          color: COLORS.textSecondary,
          margin: 0,
          lineHeight: 1.6,
          letterSpacing: '-0.003em',
        }}
      >
        {body}
      </p>
    </div>

    {/* Demo */}
    <div
      style={{
        marginTop: 'auto',
        background: COLORS.bgDeep,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        padding: SPACE.md,
        minHeight: 132,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {demo}
    </div>
  </div>
);

// ─── Demo 1: capacity bar pulsing toward 88% ────────────────────
const CapacityDemo: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <Mono tone="dim" size="xs" style={{ letterSpacing: '0.14em' }}>
        // ED CAPACITY
      </Mono>
      <Mono
        size="xs"
        style={{ color: COLORS.warn, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}
      >
        88%
      </Mono>
    </div>
    <div
      style={{
        position: 'relative',
        height: 6,
        background: COLORS.border,
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <motion.div
        initial={{ width: 0 }}
        animate={reduceMotion ? { width: '88%' } : { width: ['72%', '88%', '76%', '88%'] }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          background: COLORS.warn,
        }}
      />
    </div>
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        fontFamily: FONTS.mono,
        fontSize: 10,
        color: COLORS.textMuted,
        letterSpacing: '0.06em',
        fontVariantNumeric: 'tabular-nums',
        marginTop: 4,
      }}
    >
      <span>NEDOCS 142</span>
      <span>BUSY</span>
    </div>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        marginTop: SPACE.xs,
      }}
    >
      {[
        { label: 'Active alerts', value: '12' },
        { label: 'Beds ready', value: '4 of 24' },
      ].map((r) => (
        <div
          key={r.label}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}
        >
          <Mono tone="muted" size="xs">
            {r.label}
          </Mono>
          <Mono
            size="xs"
            style={{ color: COLORS.textPrimary, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}
          >
            {r.value}
          </Mono>
        </div>
      ))}
    </div>
  </div>
);

// ─── Demo 2: task feed · 1 AUTO ticking · 1 MANUAL waiting ───────
const TaskFeedDemo: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const [autoState, setAutoState] = useState<'queued' | 'running' | 'done'>('queued');
  useEffect(() => {
    if (reduceMotion) {
      setAutoState('done');
      return;
    }
    const loop = () => {
      setAutoState('queued');
      setTimeout(() => setAutoState('running'), 600);
      setTimeout(() => setAutoState('done'), 2200);
    };
    loop();
    const id = setInterval(loop, 5200);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: SPACE.sm }}>
      <Mono tone="dim" size="xs" style={{ letterSpacing: '0.14em' }}>
        // TASKS · LIVE
      </Mono>

      {/* AUTO task */}
      <div
        style={{
          padding: '6px 10px',
          background: COLORS.surface,
          border: `1px solid ${COLORS.border}`,
          borderLeft: `3px solid ${COLORS.info}`,
          borderRadius: RADIUS.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: 2 }}>
          <Mono
            size="xs"
            style={{ color: COLORS.info, fontWeight: 700, letterSpacing: '0.14em' }}
          >
            AUTO
          </Mono>
          <div style={{ flex: 1 }} />
          <Mono
            size="xs"
            style={{
              color:
                autoState === 'done' ? COLORS.ok :
                autoState === 'running' ? COLORS.info : COLORS.textMuted,
              fontWeight: 700,
              letterSpacing: '0.12em',
            }}
          >
            {autoState === 'done' ? '✓ DONE' : autoState === 'running' ? 'AI RUN' : 'QUEUED'}
          </Mono>
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 11,
            color: COLORS.textPrimary,
            fontWeight: 500,
            lineHeight: 1.3,
          }}
        >
          Page RT to ER
        </div>
      </div>

      {/* MANUAL task */}
      <div
        style={{
          padding: '6px 10px',
          background: COLORS.surface,
          border: `1px solid ${COLORS.warn}`,
          borderLeft: `3px solid ${COLORS.warn}`,
          borderRadius: RADIUS.sm,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: SPACE.xs, marginBottom: 2 }}>
          <Mono
            size="xs"
            style={{ color: COLORS.warn, fontWeight: 700, letterSpacing: '0.14em' }}
          >
            MANUAL · STAT
          </Mono>
          <div style={{ flex: 1 }} />
          <motion.span
            aria-hidden
            animate={reduceMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Mono
              size="xs"
              style={{ color: COLORS.accent, fontWeight: 700, letterSpacing: '0.12em' }}
            >
              NEEDS YOU
            </Mono>
          </motion.span>
        </div>
        <div
          style={{
            fontFamily: FONTS.sans,
            fontSize: 11,
            color: COLORS.textPrimary,
            fontWeight: 500,
            lineHeight: 1.3,
          }}
        >
          Expedite discharges · 204, 206
        </div>
      </div>
    </div>
  );
};

// ─── Demo 3: tiny transcript scrolling ──────────────────────────
const TRANSCRIPT_LOOP = [
  { speaker: 'REMOTE',   text: 'Bed 14 turnover complete.' },
  { speaker: 'OPERATOR', text: 'Confirm cleaned. Sending next admit.' },
  { speaker: 'REMOTE',   text: 'Copy. Ready in 3.' },
];
const TranscriptDemo: React.FC<{ reduceMotion: boolean }> = ({ reduceMotion }) => {
  const [visible, setVisible] = useState<number>(reduceMotion ? TRANSCRIPT_LOOP.length : 0);
  useEffect(() => {
    if (reduceMotion) return;
    let n = 0;
    const id = setInterval(() => {
      n = (n + 1) % (TRANSCRIPT_LOOP.length + 2);
      setVisible(Math.min(n, TRANSCRIPT_LOOP.length));
    }, 1600);
    return () => clearInterval(id);
  }, [reduceMotion]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <motion.span
          aria-hidden
          animate={reduceMotion ? undefined : { opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 6,
            height: 6,
            borderRadius: RADIUS.full,
            background: COLORS.ok,
            boxShadow: `0 0 6px ${COLORS.ok}`,
          }}
        />
        <Mono tone="dim" size="xs" style={{ letterSpacing: '0.14em' }}>
          // LINK · EVS
        </Mono>
      </div>
      {TRANSCRIPT_LOOP.slice(0, visible).map((l, i) => (
        <motion.div
          key={`${l.speaker}-${i}-${visible}`}
          initial={reduceMotion ? undefined : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: MOTION.easeSmooth }}
          style={{
            display: 'flex',
            gap: 8,
            alignItems: 'baseline',
          }}
        >
          <Mono
            size="xs"
            style={{
              color: l.speaker === 'OPERATOR' ? COLORS.info : COLORS.ok,
              fontWeight: 700,
              letterSpacing: '0.12em',
              flexShrink: 0,
            }}
          >
            {l.speaker}
          </Mono>
          <span
            style={{
              fontFamily: FONTS.sans,
              fontSize: 11,
              color: COLORS.textPrimary,
              lineHeight: 1.35,
              letterSpacing: '-0.003em',
            }}
          >
            {l.text}
          </span>
        </motion.div>
      ))}
    </div>
  );
};

// ════════════════════════════════════════════════════════════════
// 4. ROLES
// ════════════════════════════════════════════════════════════════

interface Role {
  icon: React.ReactNode;
  title: string;
  body: string;
}

const ROLES: Role[] = [
  {
    icon: <Crown size={14} strokeWidth={1.75} />,
    title: 'Manager',
    body: 'Hospital-wide situational awareness · surge activation · resource allocation.',
  },
  {
    icon: <Shield size={14} strokeWidth={1.75} />,
    title: 'Charge Nurse',
    body: 'Bed flow · staff coordination · inter-unit comms · handoff prep.',
  },
  {
    icon: <Stethoscope size={14} strokeWidth={1.75} />,
    title: 'ER Personnel',
    body: 'Your patients · your tasks · your shift · your inbox. One companion.',
  },
  {
    icon: <HeartPulse size={14} strokeWidth={1.75} />,
    title: 'Trauma',
    body: 'MTP activation · resus protocols · physician routing · live cath-lab status.',
  },
];

const RolesSection: React.FC = () => (
  <Section>
    <Reveal>
      <Mono tone="accent" size="xs" style={{ letterSpacing: '0.22em' }}>
        // BUILT FOR
      </Mono>
    </Reveal>
    <Reveal delay={0.1}>
      <h2
        style={{
          fontFamily: FONTS.sans,
          fontSize: 'clamp(28px, 4vw, 52px)',
          fontWeight: 600,
          letterSpacing: '-0.025em',
          lineHeight: 1.08,
          color: COLORS.textPrimary,
          margin: '20px 0 48px',
          maxWidth: 880,
        }}
      >
        Different roles. Different surfaces. One source of truth.
      </h2>
    </Reveal>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        gap: SPACE.md,
      }}
    >
      {ROLES.map((r, i) => (
        <Reveal key={r.title} delay={0.15 + i * 0.08}>
          <div
            style={{
              padding: '20px 22px',
              background: COLORS.surface,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.sm,
              borderLeft: `2px solid ${COLORS.accent}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              minHeight: 132,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACE.sm,
              }}
            >
              <span
                style={{
                  color: COLORS.accent,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {r.icon}
              </span>
              <BracketLabel tone="accent" size="xs">
                {r.title.toUpperCase()}
              </BracketLabel>
            </div>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 17,
                fontWeight: 600,
                color: COLORS.textPrimary,
                letterSpacing: '-0.015em',
                lineHeight: 1.3,
              }}
            >
              {r.title}
            </div>
            <div
              style={{
                fontFamily: FONTS.sans,
                fontSize: 13,
                color: COLORS.textSecondary,
                lineHeight: 1.55,
                letterSpacing: '-0.003em',
              }}
            >
              {r.body}
            </div>
          </div>
        </Reveal>
      ))}
    </div>
  </Section>
);

// ════════════════════════════════════════════════════════════════
// 5. CTA
// ════════════════════════════════════════════════════════════════

const CtaSection: React.FC<{ onEnter: () => void }> = ({ onEnter }) => (
  <Section minH="60vh">
    <Reveal>
      <div
        style={{
          padding: 'clamp(36px, 6vw, 64px) clamp(24px, 4vw, 48px)',
          background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.bgDeep} 100%)`,
          border: `1px solid ${COLORS.accent}55`,
          borderRadius: RADIUS.sm,
          position: 'relative',
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <CornerBracket position="tl" color={COLORS.accent} size={10} thickness={2} />
        <CornerBracket position="tr" color={COLORS.accent} size={10} thickness={2} />
        <CornerBracket position="bl" color={COLORS.accent} size={10} thickness={2} />
        <CornerBracket position="br" color={COLORS.accent} size={10} thickness={2} />
        <ScanningLine color={COLORS.accent} duration={12} />

        <Mono tone="accent" size="xs" style={{ letterSpacing: '0.22em' }}>
          // READY WHEN YOU ARE
        </Mono>

        <h2
          style={{
            fontFamily: FONTS.sans,
            fontSize: 'clamp(28px, 4vw, 48px)',
            fontWeight: 600,
            letterSpacing: '-0.025em',
            lineHeight: 1.1,
            color: COLORS.textPrimary,
            margin: '20px auto 16px',
            maxWidth: 680,
          }}
        >
          The hospital never stops. Neither does PULSE.
        </h2>
        <p
          style={{
            fontFamily: FONTS.sans,
            fontSize: 'clamp(14px, 1.2vw, 16px)',
            color: COLORS.textSecondary,
            margin: '0 auto 36px',
            maxWidth: 540,
            lineHeight: 1.55,
          }}
        >
          Sign in to bring up the operational console. Whether you're on a
          desktop in the command center or on your phone at the bedside,
          PULSE meets you where you work.
        </p>

        <EnterButton onClick={onEnter} />
      </div>
    </Reveal>

    <div
      style={{
        padding: '48px 0 24px',
        textAlign: 'center',
      }}
    >
      <Mono tone="dim" size="xs" style={{ letterSpacing: '0.18em' }}>
        // PULSE · 2026 · OPERATIONAL INTELLIGENCE FOR HOSPITALS
      </Mono>
    </div>
  </Section>
);

// Hero-sized rose CTA — bigger than TacticalButton's md size, icon
// on the right, magnetic-style hover lift.
const EnterButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const [hovered, setHovered] = useState(false);
  const reduce = useReducedMotion();
  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileTap={reduce ? undefined : { scale: 0.98 }}
      transition={{ duration: MOTION.fast }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '18px 36px',
        background: COLORS.accent,
        color: COLORS.textPrimary,
        border: `1px solid ${COLORS.accent}`,
        borderRadius: RADIUS.sm,
        fontFamily: FONTS.sans,
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: '-0.005em',
        cursor: 'pointer',
        boxShadow: hovered
          ? `0 8px 32px ${COLORS.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.1)`
          : `0 4px 16px ${COLORS.accentGlow}, inset 0 1px 0 rgba(255,255,255,0.06)`,
        transition: `box-shadow ${MOTION.base}s ${MOTION.cssEase}, transform ${MOTION.base}s ${MOTION.cssEase}`,
        transform: hovered && !reduce ? 'translateY(-1px)' : 'translateY(0)',
      }}
    >
      <CornerBracket position="tl" color={COLORS.textPrimary} size={5} thickness={1} />
      <CornerBracket position="tr" color={COLORS.textPrimary} size={5} thickness={1} />
      <CornerBracket position="bl" color={COLORS.textPrimary} size={5} thickness={1} />
      <CornerBracket position="br" color={COLORS.textPrimary} size={5} thickness={1} />
      <span>Enter PULSE</span>
      <motion.span
        aria-hidden
        animate={hovered && !reduce ? { x: 4 } : { x: 0 }}
        transition={{ duration: MOTION.fast, ease: MOTION.ease }}
        style={{ display: 'inline-flex' }}
      >
        <ArrowRight size={16} strokeWidth={2.25} />
      </motion.span>
    </motion.button>
  );
};
