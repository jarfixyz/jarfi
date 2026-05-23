"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useSignatureShake(duration = 400) {
  const [shaking, setShaking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    setShaking(true);
    timer.current = setTimeout(() => setShaking(false), duration);
  }, [duration]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return { shaking, trigger };
}
