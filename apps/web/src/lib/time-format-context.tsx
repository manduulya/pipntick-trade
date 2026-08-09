"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TIME_FORMAT_STORAGE_KEY, resolveInitialTimeFormat, type DateTimeFormat } from "./time-format";

type TimeFormatContextValue = {
  timeFormat: DateTimeFormat;
  setTimeFormat: (format: DateTimeFormat) => void;
};

const TimeFormatContext = createContext<TimeFormatContextValue | null>(null);

export function TimeFormatProvider({ children }: { children: React.ReactNode }) {
  // Safe default for the server render (no localStorage there) — the effect below reads the real
  // stored value back on mount. No blocking pre-hydration script needed here unlike ThemeProvider:
  // a one-frame default-format flash on times isn't the jarring wrong-background flash a theme
  // mismatch would be, so a plain effect is enough.
  const [timeFormat, setTimeFormatState] = useState<DateTimeFormat>("us-24h");

  useEffect(() => {
    setTimeFormatState(resolveInitialTimeFormat(localStorage.getItem(TIME_FORMAT_STORAGE_KEY)));
  }, []);

  const setTimeFormat = useCallback((next: DateTimeFormat) => {
    setTimeFormatState(next);
    localStorage.setItem(TIME_FORMAT_STORAGE_KEY, next);
  }, []);

  const value = useMemo<TimeFormatContextValue>(
    () => ({ timeFormat, setTimeFormat }),
    [timeFormat, setTimeFormat],
  );

  return <TimeFormatContext.Provider value={value}>{children}</TimeFormatContext.Provider>;
}

export function useTimeFormat() {
  const ctx = useContext(TimeFormatContext);
  if (!ctx) throw new Error("useTimeFormat must be used within TimeFormatProvider");
  return ctx;
}
