import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** True while the OS Reduce Motion setting is on; follows live changes. Falls back to false if unreadable. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => alive && setReduce(on))
      .catch(() => alive && setReduce(false));
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduce;
}
