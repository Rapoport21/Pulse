/**
 * Reveal — viewport-entry animation primitive.
 *
 * 2026-04-30 · Wraps children with a heavy fade-up + de-blur animation
 * triggered when the element enters the viewport. Built on
 * IntersectionObserver so the page doesn't pay scroll-listener tax.
 *
 * Use this on premium surfaces where elements should arrive with weight
 * (Boot, Login, top of Horizon). Don't use it on data tables or tight
 * dashboards — the de-blur step will fight rapid re-renders.
 *
 * Usage:
 *
 *   <Reveal>
 *     <SomeCard />
 *   </Reveal>
 *
 *   <Reveal delay={120} distance={32}>
 *     <Hero />
 *   </Reveal>
 *
 * Stagger a list:
 *
 *   {items.map((item, i) => (
 *     <Reveal key={item.id} delay={i * 80}>
 *       <Card item={item} />
 *     </Reveal>
 *   ))}
 */

import React, { useEffect, useRef, useState } from 'react';
import { MOTION } from './tokens';

interface RevealProps {
  children: React.ReactNode;
  /** Stagger delay in ms — wire i*80 from a map for cascading reveals. */
  delay?: number;
  /** Travel distance in px — defaults to 24. */
  distance?: number;
  /** Animation duration in ms — defaults to 800ms (heavy/cinematic). */
  duration?: number;
  /** Threshold passed to IntersectionObserver. 0 = any intersection. */
  threshold?: number;
  /** Whether to apply the de-blur step. Set false for tight surfaces. */
  blur?: boolean;
  /** Reveal once and stay revealed (default true). */
  once?: boolean;
  /** Inline style for the wrapper. */
  style?: React.CSSProperties;
  className?: string;
  /** Render the wrapper as a different element (default `div`). */
  as?: React.ElementType;
}

export const Reveal: React.FC<RevealProps> = ({
  children,
  delay = 0,
  distance = 24,
  duration = 800,
  threshold = 0.05,
  blur = true,
  once = true,
  style,
  className,
  as = 'div',
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // SSR / no-IO fallback: just show.
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) io.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold, rootMargin: '0px 0px -80px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold, once]);

  const Tag = as;

  return (
    <Tag
      ref={ref}
      className={className}
      style={{
        ...style,
        // Animation properties — only transform, opacity, and filter (blur)
        // so we don't trigger layout. willChange flips back to auto once
        // the reveal completes to free up the layer.
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate3d(0, 0, 0)' : `translate3d(0, ${distance}px, 0)`,
        filter: blur && !visible ? 'blur(12px)' : 'blur(0px)',
        transition: [
          `opacity ${duration}ms ${MOTION.cssEaseFluid} ${delay}ms`,
          `transform ${duration}ms ${MOTION.cssEaseFluid} ${delay}ms`,
          `filter ${Math.round(duration * 0.7)}ms ${MOTION.cssEase} ${delay}ms`,
        ].join(', '),
        willChange: visible ? 'auto' : 'transform, opacity, filter',
      }}
    >
      {children}
    </Tag>
  );
};
