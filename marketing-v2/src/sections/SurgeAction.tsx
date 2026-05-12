import { motion, useTransform, type MotionValue } from 'motion/react';
import { PinnedScrub } from '../components/PinnedScrub';

/**
 * Surge Action — 10vh, 3 stages.
 *
 * The longest beat in the page. This is the central differentiator —
 * human-in-the-loop — so it earns the most scroll budget.
 *
 * Single accent: the `Confirm plan` button on Stage 2 only. Stages 1 and 3
 * have neutral surfaces.
 */

type Stage = {
  id: string;
  state: string;
  title: string;
  subtitle: string;
  detail: string;
};

const STAGES: Stage[] = [
  {
    id: 'detect',
    state: 'PROPOSED',
    title: 'Threshold crossing detected.',
    subtitle: 'Risk 0.71 at T+72m',
    detail:
      'Composite risk crosses threshold. Driver: boarding. Confidence high (0.91). PULSE gathers candidate actions across departments.',
  },
  {
    id: 'review',
    state: 'AWAITING DIRECTOR',
    title: 'Surge plan ready for review.',
    subtitle: '5 actions · 4 owners · projected drop −0.28',
    detail:
      'Each action shows projected risk reduction, named owners, and ETAs. Director can approve, edit, or reject. Plan is never auto-executed.',
  },
  {
    id: 'execute',
    state: 'EXECUTING',
    title: 'Tasks routed and tracked.',
    subtitle: '4 of 5 complete · risk now 0.39',
    detail:
      'On confirmation, tasks distribute to owners across departments. Each owner closes them in their own surface. PULSE re-forecasts as each lands.',
  },
];

export function SurgeAction() {
  return (
    <PinnedScrub viewports={10} variants={STAGES.length}>
      {({ progress, variantIndex }) => (
        <SurgeInner progress={progress} variantIndex={variantIndex} />
      )}
    </PinnedScrub>
  );
}

function SurgeInner({
  progress,
  variantIndex,
}: {
  progress: MotionValue<number>;
  variantIndex: MotionValue<number>;
}) {
  const titleOpacity = useTransform(progress, [0, 0.06], [1, 0]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: 'var(--bg)' }}>
      {/* Eyebrow */}
      <div
        style={{
          position: 'absolute',
          top: 'clamp(72px, 12vh, 120px)',
          left: 0,
          right: 0,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--text-3)' }}>
          HUMAN IN THE LOOP
        </div>
      </div>

      {/* Section title */}
      <motion.div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'grid',
          placeItems: 'center',
          opacity: titleOpacity,
          pointerEvents: 'none',
        }}
      >
        <h2
          style={{
            fontSize: 'var(--type-display)',
            fontWeight: 600,
            letterSpacing: '-0.045em',
            lineHeight: 0.95,
            textAlign: 'center',
            maxWidth: '16ch',
            color: 'var(--text)',
          }}
        >
          From rising risk to coordinated action.
        </h2>
      </motion.div>

      {/* Stage progress strip — top */}
      <StageStrip variantIndex={variantIndex} />

      {/* Stage scenes */}
      {STAGES.map((s, i) => (
        <Scene key={s.id} stage={s} index={i} variantIndex={variantIndex} />
      ))}
    </div>
  );
}

function StageStrip({ variantIndex }: { variantIndex: MotionValue<number> }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'clamp(120px, 18vh, 200px)',
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0,
      }}
    >
      {STAGES.map((s, i) => (
        <StageDot key={s.id} stage={s} index={i} variantIndex={variantIndex} isLast={i === STAGES.length - 1} />
      ))}
    </div>
  );
}

function StageDot({
  stage,
  index,
  variantIndex,
  isLast,
}: {
  stage: Stage;
  index: number;
  variantIndex: MotionValue<number>;
  isLast: boolean;
}) {
  const isActive = useTransform(variantIndex, (v) => Math.round(v) === index);
  const isPast = useTransform(variantIndex, (v) => v >= index - 0.3);
  const dotColor = useTransform(isPast, (p) => (p ? 'var(--text)' : 'var(--text-faint)'));
  const labelOpacity = useTransform(isActive, (a) => (a ? 1 : 0.5));

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          minWidth: 160,
        }}
      >
        <motion.div
          style={{
            width: 8,
            height: 8,
            background: dotColor,
            transition: 'background 0.4s var(--ease-out)',
          }}
        />
        <motion.div
          className="mono"
          style={{
            opacity: labelOpacity,
            fontSize: 10,
            letterSpacing: '0.22em',
            color: 'var(--text-2)',
          }}
        >
          {stage.state}
        </motion.div>
      </div>
      {!isLast && (
        <motion.div
          style={{
            width: 80,
            height: 1,
            background: useTransform(variantIndex, (v) =>
              v > index + 0.3 ? 'var(--text)' : 'var(--border-strong)',
            ),
            marginTop: -22,
          }}
        />
      )}
    </>
  );
}

function Scene({
  stage,
  index,
  variantIndex,
}: {
  stage: Stage;
  index: number;
  variantIndex: MotionValue<number>;
}) {
  // Linear crossfade between adjacent stages
  const opacity = useTransform(variantIndex, (v) => {
    const d = Math.abs(v - index);
    return Math.max(0, 1 - d);
  });

  const isStage2 = index === 1;

  return (
    <motion.div
      style={{
        position: 'absolute',
        inset: 0,
        opacity,
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(220px, 30vh, 320px) 24px clamp(120px, 18vh, 200px)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 800,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 24,
        }}
      >
        <div className="mono" style={{ fontSize: 10, color: 'var(--text-3)' }}>
          STAGE · 0{index + 1} / 03
        </div>

        <h3
          style={{
            fontSize: 'var(--type-display-sm)',
            fontWeight: 600,
            letterSpacing: '-0.03em',
            lineHeight: 1.05,
            color: 'var(--text)',
            maxWidth: '20ch',
          }}
        >
          {stage.title}
        </h3>

        <div className="mono" style={{ fontSize: 11, color: 'var(--text-2)' }}>
          {stage.subtitle}
        </div>

        <p
          style={{
            fontSize: 'var(--type-body-lg)',
            color: 'var(--text-2)',
            lineHeight: 1.55,
            maxWidth: '52ch',
          }}
        >
          {stage.detail}
        </p>

        {/* Confirm plan button — accent moment, only on stage 2 */}
        {isStage2 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 12 }}>
            <button
              type="button"
              style={{
                padding: '14px 22px',
                background: 'var(--accent)',
                color: 'var(--text)',
                fontWeight: 500,
                fontSize: 14,
                borderRadius: 2,
                cursor: 'default',
              }}
            >
              Confirm plan
            </button>
            <button
              type="button"
              style={{
                padding: '14px 22px',
                background: 'transparent',
                border: '1px solid var(--border-strong)',
                color: 'var(--text)',
                fontWeight: 500,
                fontSize: 14,
                borderRadius: 2,
                cursor: 'default',
              }}
            >
              Edit
            </button>
            <span
              className="mono"
              style={{
                marginLeft: 8,
                alignSelf: 'center',
                fontSize: 10,
                color: 'var(--text-3)',
              }}
            >
              demonstration only
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
