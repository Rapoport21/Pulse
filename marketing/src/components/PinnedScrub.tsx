import { useRef, type ReactNode } from 'react';
import { useScroll, useTransform, motion, type MotionValue } from 'motion/react';

/**
 * The PinnedScrub primitive — direct port of the Relats `.sticky` + `.markers`
 * pattern. The wrapper is N×100vh tall to provide scroll length; the sticky
 * inner element stays fixed at the top of the viewport while you scroll
 * through the wrapper. Children get `progress` (0..1 across the section)
 * and `variantIndex` (which "marker" they're currently at) so they can
 * crossfade content tied to scroll position.
 *
 * No JS pinning. No transforms. Just position:sticky + Framer Motion's
 * scroll progress. Same effect, half the moving parts.
 */
type PinnedScrubProps = {
  /** Section height as a multiple of the viewport. e.g. 12 = 12vh tall, 11 of which scrub */
  viewports: number;
  /** Number of "variants" / marker stops within the scrub */
  variants: number;
  /** Renders inside the sticky frame */
  children: (ctx: {
    progress: MotionValue<number>;
    variantIndex: MotionValue<number>;
  }) => ReactNode;
  /** Optional id for anchor links */
  id?: string;
  /** Background color override */
  background?: string;
};

export function PinnedScrub({
  viewports,
  variants,
  children,
  id,
  background,
}: PinnedScrubProps) {
  const ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start start', 'end end'],
  });

  // Map scroll progress (0..1) to variant index (0..variants-1)
  const variantIndex = useTransform(
    scrollYProgress,
    [0, 1],
    [0, variants - 1],
  );

  return (
    <section
      id={id}
      ref={ref}
      style={{
        position: 'relative',
        height: `${viewports * 100}vh`,
        background: background ?? 'var(--bg)',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          width: '100%',
          overflow: 'hidden',
        }}
      >
        {children({ progress: scrollYProgress, variantIndex })}
      </div>
    </section>
  );
}
