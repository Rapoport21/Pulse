import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';

/**
 * Brief Me — 4vh (new in v2, replaces Worldwide from v1).
 *
 * Real-time text demo: a monospace terminal frame "types" a shift handoff
 * word-by-word as you scroll past. The shift handoff is shown happening,
 * not described.
 *
 * Single accent: the timestamp `14:09 · brief authored` lands at the end
 * in rose-600. The synthesized text itself is mono-neutral.
 */

const BRIEF_TEXT = `Outgoing shift: 3 holds in PACU. ICU at 92%. Telemetry transfer pending bed 4-East. EVS team aware. MS coverage thin past 22:00. One escalation: room 12 acuity rising — flagged for incoming charge.`;

export function BriefMe() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  });

  // The text reveals word-by-word over the section's middle scroll range
  const words = BRIEF_TEXT.split(' ');
  const wordsToShow = useTransform(scrollYProgress, [0.25, 0.7], [0, words.length]);
  const timestampOpacity = useTransform(scrollYProgress, [0.7, 0.85], [0, 1]);

  return (
    <section
      ref={ref}
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--bg-deep)',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(80px, 12vh, 140px) 24px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 880,
          display: 'flex',
          flexDirection: 'column',
          gap: 'clamp(32px, 5vh, 56px)',
          alignItems: 'flex-start',
        }}
      >
        <div className="eyebrow" style={{ color: 'var(--text-3)' }}>
          30-SECOND SHIFT HANDOFF
        </div>

        <h2
          style={{
            fontSize: 'var(--type-display)',
            fontWeight: 600,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: 'var(--text)',
            maxWidth: '14ch',
          }}
        >
          The next shift starts knowing.
        </h2>

        {/* Terminal frame */}
        <div
          style={{
            width: '100%',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            padding: 'clamp(24px, 3vw, 36px)',
            position: 'relative',
            minHeight: 280,
          }}
        >
          {/* Terminal label */}
          <div
            className="mono"
            style={{
              fontSize: 10,
              color: 'var(--text-3)',
              letterSpacing: '0.22em',
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>BRIEF · INCOMING CHARGE</span>
            <motion.span style={{ opacity: timestampOpacity }}>STATUS · COMPLETE</motion.span>
          </div>

          <div
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 'clamp(18px, 2vw, 24px)',
              lineHeight: 1.6,
              color: 'var(--text)',
              fontWeight: 400,
              letterSpacing: '-0.005em',
            }}
          >
            <BriefStream words={words} wordsToShow={wordsToShow} />
            <Cursor wordsToShow={wordsToShow} totalWords={words.length} />
          </div>

          {/* Timestamp — accent moment of this section */}
          <motion.div
            style={{
              opacity: timestampOpacity,
              marginTop: 32,
              paddingTop: 18,
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span
              className="mono"
              style={{
                fontSize: 10,
                color: 'var(--text-3)',
                letterSpacing: '0.18em',
              }}
            >
              AUTHORED BY PULSE · 32 SEC
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 13,
                fontWeight: 500,
                letterSpacing: '0.18em',
                color: 'var(--accent)',
              }}
            >
              14:09
            </span>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function BriefStream({
  words,
  wordsToShow,
}: {
  words: string[];
  wordsToShow: ReturnType<typeof useTransform<number, number>>;
}) {
  return (
    <span>
      {words.map((w, i) => (
        <Word key={i} word={w} index={i} wordsToShow={wordsToShow} />
      ))}
    </span>
  );
}

function Word({
  word,
  index,
  wordsToShow,
}: {
  word: string;
  index: number;
  wordsToShow: ReturnType<typeof useTransform<number, number>>;
}) {
  const opacity = useTransform(wordsToShow, (n) => (n > index ? 1 : 0));
  return (
    <motion.span style={{ opacity }}>
      {word}
      {' '}
    </motion.span>
  );
}

function Cursor({
  wordsToShow,
  totalWords,
}: {
  wordsToShow: ReturnType<typeof useTransform<number, number>>;
  totalWords: number;
}) {
  const opacity = useTransform(wordsToShow, (n) => (n < totalWords ? 1 : 0));
  return (
    <motion.span
      style={{
        opacity,
        display: 'inline-block',
        width: '0.5ch',
        height: '1em',
        background: 'var(--text-2)',
        verticalAlign: 'text-bottom',
        marginLeft: 2,
      }}
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
    />
  );
}
