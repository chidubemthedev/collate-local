"use client";

import React, { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
  className?: string;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Counts from the previously shown value to `value`.
 * Jumps straight to the value when the user prefers reduced motion.
 */
export function AnimatedNumber({ value, durationMs = 900, className }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const shownRef = useRef(0);

  useEffect(() => {
    const from = shownRef.current;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let start: number | null = null;

    const step = (now: number) => {
      if (start === null) start = now;
      const progress = reduceMotion ? 1 : Math.min((now - start) / durationMs, 1);
      const next = Math.round(from + (value - from) * easeOutCubic(progress));
      shownRef.current = next;
      setDisplay(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, durationMs]);

  return (
    <span className={className} aria-label={value.toLocaleString()}>
      <span aria-hidden="true">{display.toLocaleString()}</span>
    </span>
  );
}
