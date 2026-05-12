import { motion, useScroll, useTransform } from 'motion/react';
import { useRef, type RefObject } from 'react';

/**
 * Char-by-char reveal driven by scroll progress (0..1). When you pass a
 * `targetRef` we read its scroll progress directly — that's how Relats
 * times their headline reveals to the section's pinned scrub.
 */
type SplitTextProps = {
  text: string;
  /** The element whose scroll progress drives the reveal */
  targetRef?: RefObject<HTMLElement | null>;
  /** When the reveal should start/end relative to scroll progress */
  range?: [number, number];
  className?: string;
  style?: React.CSSProperties;
};

export function SplitText({
  text,
  targetRef,
  range = [0, 0.5],
  className,
  style,
}: SplitTextProps) {
  const internalRef = useRef<HTMLSpanElement>(null);
  const ref = targetRef ?? internalRef;

  const { scrollYProgress } = useScroll({
    target: ref as RefObject<HTMLElement>,
    offset: ['start end', 'end start'],
  });

  const chars = Array.from(text);
  const total = chars.length;

  return (
    <span
      ref={internalRef}
      className={className}
      style={{ display: 'inline-block', ...style }}
    >
      {chars.map((c, i) => {
        const start = range[0] + ((range[1] - range[0]) * i) / total;
        const end = range[0] + ((range[1] - range[0]) * (i + 4)) / total;
        return <Char key={i} char={c} progress={scrollYProgress} start={start} end={end} />;
      })}
    </span>
  );
}

function Char({
  char,
  progress,
  start,
  end,
}: {
  char: string;
  progress: ReturnType<typeof useScroll>['scrollYProgress'];
  start: number;
  end: number;
}) {
  const opacity = useTransform(progress, [start, end], [0.0001, 1]);
  const y = useTransform(progress, [start, end], [12, 0]);
  return (
    <motion.span
      style={{
        display: 'inline-block',
        opacity,
        y,
        whiteSpace: char === ' ' ? 'pre' : 'normal',
      }}
    >
      {char}
    </motion.span>
  );
}
