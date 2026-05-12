import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/**
 * Scroll-driven count-up. Numbers tick from `from` to `to` as the section
 * passes through the viewport. The Relats site uses this exact pattern —
 * 143,800,000 → 150,000,000 — to make the "live now" stat land.
 */
type CountUpProps = {
  from: number;
  to: number;
  format?: (n: number) => string;
  decimals?: number;
  style?: React.CSSProperties;
};

export function CountUp({ from, to, format, decimals = 0, style }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(from);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 90%', 'end 30%'],
  });

  const raw = useTransform(scrollYProgress, [0, 1], [from, to]);
  const smooth = useSpring(raw, { stiffness: 140, damping: 28 });

  useEffect(() => {
    return smooth.on('change', (v) => setValue(v));
  }, [smooth]);

  const display = format
    ? format(value)
    : value.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

  return (
    <motion.span ref={ref} style={style}>
      {display}
    </motion.span>
  );
}
