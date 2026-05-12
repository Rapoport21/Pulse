import { motion, useScroll, useTransform, useSpring } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

/** Count-up driven by section scroll. Used in the stat moment + intro card. */
type CountUpProps = {
  from: number;
  to: number;
  decimals?: number;
  format?: (n: number) => string;
  style?: React.CSSProperties;
};

export function CountUp({ from, to, decimals = 0, format, style }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [value, setValue] = useState(from);

  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start 90%', 'end 50%'],
  });

  const raw = useTransform(scrollYProgress, [0, 1], [from, to]);
  const smooth = useSpring(raw, { stiffness: 120, damping: 26 });

  useEffect(() => smooth.on('change', setValue), [smooth]);

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
