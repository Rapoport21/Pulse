import { motion, useTransform, type MotionValue } from 'motion/react';
import { PinnedScrub } from '../components/PinnedScrub';
import { HudPanel } from '../components/HudPanel';

/**
 * Surge Action — pinned scrub, three stages of the human-in-the-loop loop.
 * Mirrors Relats's "Periflex" pattern (single big visual + variant
 * highlights + spec cards) but here the variants are stages of a workflow.
 */

type Stage = {
  id: string;
  title: string;
  detail: string;
  state: 'PROPOSED' | 'AWAITING' | 'EXECUTING' | 'RESOLVED';
  taskCount: string;
  owners: string[];
  deltaLabel: string;
  deltaValue: string;
  color: string;
};

const STAGES: Stage[] = [
  {
    id: 'detect',
    title: 'Threshold crossing detected',
    detail: 'Capacity forecast crosses 95% at T+72m. Composite risk score 0.71. Driver: boarding. Confidence high (0.91). System gathers candidate actions.',
    state: 'PROPOSED',
    taskCount: '5 candidate actions',
    owners: ['Manager', 'Charge RN', 'EVS Lead', 'Bed Mgmt'],
    deltaLabel: 'Risk if no action',
    deltaValue: '↑ 0.84 in 90m',
    color: 'var(--warn)',
  },
  {
    id: 'review',
    title: 'Surge plan awaits Operations Director',
    detail: '5 actions with named owners and ETAs. Each action shows projected risk reduction. Director can approve, edit, or reject. Plan is never auto-executed.',
    state: 'AWAITING',
    taskCount: '5 actions · 4 owners',
    owners: ['Discharge ICU 9', 'Open 4 beds EVS', 'Pull 2 RNs to MS', 'Hold 1 elective', 'Notify ED triage'],
    deltaLabel: 'Projected risk after',
    deltaValue: '↓ 0.28 by T+90m',
    color: 'var(--accent)',
  },
  {
    id: 'execute',
    title: 'Tasks routed and tracked',
    detail: 'On confirm, tasks are distributed to owners across departments with ETAs. Owners check off in their own surface. PULSE re-forecasts as each task lands.',
    state: 'EXECUTING',
    taskCount: '4 of 5 complete',
    owners: ['ICU 9 ✓', 'EVS · 4 of 4 ✓', 'MS coverage ✓', 'Elective hold ✓', 'Triage notify · in flight'],
    deltaLabel: 'Risk now',
    deltaValue: '0.39 · trending ↓',
    color: 'var(--ok)',
  },
];

export function SurgeAction() {
  return (
    <PinnedScrub id="surge" viewports={8} variants={STAGES.length}>
      {({ progress, variantIndex }) => (
        <SurgeInner progress={progress} variantIndex={variantIndex} />
      )}
    </PinnedScrub>
  );
}

function SurgeInner({ progress, variantIndex }: { progress: MotionValue<number>; variantIndex: MotionValue<number> }) {
  const headerOpacity = useTransform(progress, [0, 0.005], [1, 0]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      <div className="grid-bg" style={{ position: 'absolute', inset: 0, opacity: 0.18 }} />

      {/* Section title */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: headerOpacity,
          textAlign: 'center',
          padding: '0 24px',
          pointerEvents: 'none',
        }}
      >
        <div>
          <div className="eyebrow" style={{ color: 'var(--accent)', marginBottom: 24 }}>
            HUMAN IN THE LOOP
          </div>
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 88px)', fontWeight: 600, letterSpacing: '-0.04em', lineHeight: 0.95, maxWidth: '20ch' }}>
            From <span style={{ color: 'var(--accent)' }}>rising risk</span><br />to coordinated action
          </h2>
        </div>
      </motion.div>

      {/* Stage progress bar — across the top */}
      <StageBar variantIndex={variantIndex} />

      {/* Stage content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          padding: '20vh 64px 12vh',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 'min(1240px, 100%)',
            height: '100%',
            maxHeight: 580,
          }}
        >
          {STAGES.map((s, i) => (
            <Scene key={s.id} stage={s} index={i} variantIndex={variantIndex} />
          ))}
        </div>
      </div>
    </div>
  );
}

function StageBar({ variantIndex }: { variantIndex: MotionValue<number> }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(12vh)',
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 0,
      }}
    >
      {STAGES.map((s, i) => (
        <StageDot key={s.id} stage={s} index={i} variantIndex={variantIndex} />
      ))}
    </div>
  );
}

function StageDot({ stage, index, variantIndex }: { stage: Stage; index: number; variantIndex: MotionValue<number> }) {
  const isActive = useTransform(variantIndex, (v) => Math.round(v) === index);
  const isPast = useTransform(variantIndex, (v) => v >= index);
  const dotColor = useTransform(isPast, (p) => (p ? stage.color : 'var(--border-strong)'));
  const labelOpacity = useTransform(isActive, (a) => (a ? 1 : 0.5));
  const labelColor = useTransform(isActive, (a) => (a ? 'var(--text)' : 'var(--text-2)'));

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 140 }}>
        <motion.div
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: dotColor,
            transition: 'background 0.4s var(--ease-out)',
          }}
        />
        <motion.div
          style={{
            opacity: labelOpacity,
            color: labelColor,
            fontFamily: 'var(--font-mono)',
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
          }}
        >
          {stage.state}
        </motion.div>
      </div>
      {index < STAGES.length - 1 && (
        <motion.div
          style={{
            width: 80,
            height: 1,
            background: useTransform(variantIndex, (v) => (v > index ? stage.color : 'var(--border)')),
            marginTop: -16,
          }}
        />
      )}
    </>
  );
}

function Scene({ stage, index, variantIndex }: { stage: Stage; index: number; variantIndex: MotionValue<number> }) {
  const opacity = useTransform(variantIndex, (v) => {
    const d = Math.abs(v - index);
    return Math.max(0, 1 - d * 1.6);
  });
  const y = useTransform(variantIndex, (v) => (v - index) * 12);

  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        y,
        display: 'grid',
        gridTemplateColumns: '1.2fr 0.8fr',
        gap: 32,
      }}
    >
      {/* Left: title + body */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
        <div className="eyebrow" style={{ color: stage.color }}>
          STAGE · 0{index + 1} / 03
        </div>
        <h3 style={{ fontSize: 'clamp(32px, 4.4vw, 64px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, maxWidth: '18ch' }}>
          {stage.title}
        </h3>
        <p style={{ fontSize: 16, color: 'var(--text-2)', maxWidth: '52ch', lineHeight: 1.6 }}>
          {stage.detail}
        </p>
      </div>

      {/* Right: live HUD card */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <HudPanel label={`${stage.state} · ${stage.taskCount.toUpperCase()}`} emphasized style={{ width: '100%' }}>
          <div className="eyebrow" style={{ color: stage.color, fontSize: 10, marginBottom: 14 }}>
            {stage.deltaLabel.toUpperCase()}
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', color: stage.color }}>
            {stage.deltaValue}
          </div>

          <div style={{ marginTop: 24, height: 1, background: 'var(--border)' }} />

          <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {stage.owners.map((o) => (
              <div key={o} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text)' }}>{o}</span>
                <span className="mono" style={{ fontSize: 9, color: stage.color }}>
                  {stage.state === 'EXECUTING' && o.includes('✓') ? 'DONE' : 'OWNED'}
                </span>
              </div>
            ))}
          </div>

          {stage.state === 'AWAITING' && (
            <div style={{ marginTop: 22, display: 'flex', gap: 8 }}>
              <button
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 2,
                  background: 'var(--accent)',
                  color: 'var(--text)',
                  fontWeight: 500,
                  fontSize: 13,
                  letterSpacing: '0.05em',
                }}
              >
                Confirm plan
              </button>
              <button
                style={{
                  padding: '10px 14px',
                  borderRadius: 2,
                  border: '1px solid var(--border-strong)',
                  color: 'var(--text)',
                  fontWeight: 500,
                  fontSize: 13,
                }}
              >
                Edit
              </button>
            </div>
          )}
        </HudPanel>
      </div>
    </motion.div>
  );
}
