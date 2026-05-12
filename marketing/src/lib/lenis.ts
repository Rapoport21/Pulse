import { useEffect } from 'react';
import Lenis from 'lenis';

export function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.1,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 1,
      touchMultiplier: 1.5,
    });

    let raf = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Kick motion/react's `useScroll` listeners after mount.
    // Without this, motion values stay frozen at their initial state
    // until the user produces a real scroll event — which means a
    // page that reloads at scrollY > 0 renders the wrong scrub frame.
    const kick = () => {
      const y = window.scrollY;
      if (y > 0) {
        // Tiny up/down nudge dispatches a real scroll event
        // without visibly moving the page.
        window.scrollTo({ top: y - 1, behavior: 'instant' as ScrollBehavior });
        window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      }
      window.dispatchEvent(new Event('scroll'));
    };
    // Two passes: once after first paint, once after layout settles.
    requestAnimationFrame(() => requestAnimationFrame(kick));
    const t = setTimeout(kick, 250);

    return () => {
      clearTimeout(t);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
}
