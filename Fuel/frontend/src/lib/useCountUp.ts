import { useEffect, useRef, useState } from 'react';

import { motion } from '@/theme';

/** Counts from the value on screen to `target` over 400ms; a new target restarts from where it is. Instant if reduced. */
export function useCountUp(target: number, reduceMotion: boolean): number {
  const [value, setValue] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (reduceMotion || current.current === target) {
      current.current = target;
      setValue(target);
      return;
    }
    const from = current.current;
    const start = Date.now();
    let frame = 0;
    const step = () => {
      const t = Math.min((Date.now() - start) / motion.slow, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      current.current = from + (target - from) * eased;
      setValue(current.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, reduceMotion]);
  return reduceMotion ? target : value;
}
