"use client";

import { useEffect, useRef } from "react";
import { signOut } from "next-auth/react";

const TIMEOUT_MS = 30 * 60 * 1000;

const activityEvents = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
];

export function SessionTimeout() {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const resetTimer = () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        signOut({ redirect: true, callbackUrl: "/login" });
      }, TIMEOUT_MS);
    };

    resetTimer();
    activityEvents.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      activityEvents.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, []);

  return null;
}
