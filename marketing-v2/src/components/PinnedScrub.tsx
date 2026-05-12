import { useRef, type ReactNode } from 'react';
import { useTransform, type MotionValue } from 'motion/react';
import { useScrollProgress } from '../lib/scroll-progress';

/**
 * PinnedScrub — `position: sticky` inner content over a tall outer wrapper.
 *
 * Children get `progress` (0..1 across the section) and `variantIndex`
 * (0..variants-1) so they can drive crossfades on scroll.
 *
 * Note on progress source: framer-motion's own `useScroll` returns values
 * that run ~30× slower than hand math expects for tall pinned sections,
 * which makes timing transitions painful. We compute progress manually
 * via `useScrollProgress` so the values match the math.
 */
type PinnedScrubProps = {
  viewports: number;
  variants: number;
  children: (ctx: {
    progress: MotionValue<number>;
    variantIndex: MotionValue<number>;
  }) => ReactNode;
  id?: string;
  background?: string;
};

export function PinnedScrub({ viewports, variants, children, id, background }: PinnedScrubProps) {
  const ref = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(ref);

  const variantIndex = useTransform(
    progress,
    [0, 1],
    [0, Math.max(0, variants - 1)],
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
        {children({ progress, variantIndex })}
      </div>
    </section>
  );
}
