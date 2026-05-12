import { useEffect, useRef, type RefObject } from 'react';
import { useMotionValue, type MotionValue } from 'motion/react';

/**
 * useScrollProgress — manual progress for a tall pinned section.
 *
 * Returns a MotionValue<number> in [0..1]:
 *   0 when the element's TOP enters the viewport's TOP
 *   1 when the element's BOTTOM enters the viewport's BOTTOM
 *
 * This is the same intent as motion's `useScroll({ target, offset: ['start start', 'end end'] })`
 * but computed off `getBoundingClientRect()` directly — values match hand
 * math, unlike framer-motion's which has run ~30× slower than expected
 * for tall pinned sections in this version.
 *
 * Why bother: the design relies on tight scroll-driven transitions
 * (variant scenes, headline fades). Off-by-30× progress makes those
 * transitions impossible to tune.
 */
export function useScrollProgress(ref: RefObject<HTMLElement | null>): MotionValue<number> {
  // useMotionValue is React-hook-safe — same value across renders.
  const progress = useMotionValue(0);

  // Use a ref to capture the current progress motion value in the listener
  // (the listener closes over progress, but progress is stable anyway).
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const sectionH = rect.height;
      const scrollableLength = sectionH - vh;
      if (scrollableLength <= 0) {
        progress.set(0);
        return;
      }
      const distanceScrolledIn = -rect.top;
      const p = Math.max(0, Math.min(1, distanceScrolledIn / scrollableLength));
      progress.set(p);
    };

    // Throttle via rAF — guarantees we never compute progress more than
    // once per frame even when scroll events fire faster than that.
    const onScroll = () => {
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = 0;
        update();
      });
    };

    update(); // initial read
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', update);
    };
  }, [ref, progress]);

  return progress;
}
