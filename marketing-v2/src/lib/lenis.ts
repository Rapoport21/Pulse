import { useEffect } from 'react';
import Lenis from 'lenis';

/** Smooth scroll setup. Critical detail: dispatches a fake scroll event
 *  on mount so motion/react's `useScroll` consumers initialize correctly
 *  even when the page reloads at scrollY > 0. */
export function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
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

    // Kick motion's `useScroll` listeners so initial scrollY > 0 renders
    // correctly, AND nudge any mount-time `animate` props that aren't firing
    // in StrictMode dev double-mount. We dispatch a real wheel + scroll event
    // pair, then bounce the scroll position by 1px each direction. This is
    // enough to trigger motion's render cycle and let entry animations land.
    const kick = () => {
      const y = window.scrollY;
      if (y > 0) {
        window.scrollTo({ top: y - 1, behavior: 'instant' as ScrollBehavior });
        window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
      } else {
        // At y=0, bounce by going to y=1 then back to 0
        window.scrollTo({ top: 1, behavior: 'instant' as ScrollBehavior });
        window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
      }
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new WheelEvent('wheel', { deltaY: 0, bubbles: true }));
    };
    requestAnimationFrame(() => requestAnimationFrame(kick));
    const t1 = setTimeout(kick, 100);
    const t2 = setTimeout(kick, 400);
    const t3 = setTimeout(kick, 1200); // late kick for slow-mounting StrictMode

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      cancelAnimationFrame(raf);
      lenis.destroy();
    };
  }, []);
}
