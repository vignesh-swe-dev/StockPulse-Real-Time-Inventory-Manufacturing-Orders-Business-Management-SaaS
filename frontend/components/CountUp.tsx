"use client";

import React, { useEffect, useRef, useState } from "react";

/** Animates a number from its previous value to `value` and renders it through `format`. */
export function CountUp({ value, format, duration = 1100 }: { value: number; format: (n: number) => string; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 4);
      const current = origin + (value - origin) * eased;
      setDisplay(current);
      from.current = current;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{format(Math.round(display))}</>;
}
