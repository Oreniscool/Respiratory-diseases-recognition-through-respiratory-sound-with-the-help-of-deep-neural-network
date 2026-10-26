import { useEffect, useState, useRef, useCallback } from "react";
import { useInView } from "react-intersection-observer";

interface UseCountUpOptions {
  end: number;
  start?: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  decimals?: number;
}

export function useCountUp({
  end,
  start = 0,
  duration = 2000,
  suffix = "",
  prefix = "",
  decimals = 0,
}: UseCountUpOptions) {
  const [value, setValue] = useState(start);
  const [hasAnimated, setHasAnimated] = useState(false);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const { ref, inView } = useInView({
    triggerOnce: true,
    threshold: 0.3,
  });

  const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

  const animate = useCallback(
    (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);
      const currentValue = start + (end - start) * easedProgress;

      setValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setValue(end);
        setHasAnimated(true);
      }
    },
    [start, end, duration],
  );

  useEffect(() => {
    if (inView && !hasAnimated) {
      startTimeRef.current = null;
      animationRef.current = requestAnimationFrame(animate);
    }

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [inView, hasAnimated, animate]);

  const displayValue = decimals > 0
    ? value.toFixed(decimals)
    : Math.round(value).toLocaleString();

  return {
    ref,
    displayValue: `${prefix}${displayValue}${suffix}`,
    rawValue: value,
    inView,
    hasAnimated,
  };
}
