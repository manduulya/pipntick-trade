"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import type { Quote } from "@pipntick/shared";
import { api } from "../../lib/api";

const STORAGE_KEY = "pipntick_quote";
const STORAGE_TS  = "pipntick_quote_ts";
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const SHINE_INTERVAL = 15 * 60 * 1000;

// Fallback only — used if the API is unreachable, not the everyday path.
const FALLBACK_QUOTE: Quote = {
  content: "The stock market is a device for transferring money from the impatient to the patient.",
  author: "Warren Buffett",
};

export default function QuoteBar() {
  const { getToken } = useAuth();
  const [quote, setQuote]     = useState<Quote | null>(null);
  const [visible, setVisible] = useState(false);
  const [shine, setShine]     = useState(false);
  const shineRef              = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load or fetch quote (shared across pages via localStorage, refreshes every 12h)
  useEffect(() => {
    async function init() {
      const stored   = localStorage.getItem(STORAGE_KEY);
      const storedTs = localStorage.getItem(STORAGE_TS);
      const now      = Date.now();

      if (stored && storedTs && now - Number(storedTs) < TWELVE_HOURS) {
        setQuote(JSON.parse(stored));
      } else {
        const q = await api.quote.get(await getToken()).catch(() => FALLBACK_QUOTE);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
        localStorage.setItem(STORAGE_TS, String(now));
        setQuote(q);
      }

      // Slight delay then fade in
      setTimeout(() => setVisible(true), 300);
    }
    init();
  }, []);

  // Shine effect every 15 minutes
  useEffect(() => {
    function triggerShine() {
      setShine(true);
      setTimeout(() => setShine(false), 1200);
    }

    shineRef.current = setInterval(triggerShine, SHINE_INTERVAL);
    // Also trigger once after 3s so you can see it works
    const initial = setTimeout(triggerShine, 3000);

    return () => {
      if (shineRef.current) clearInterval(shineRef.current);
      clearTimeout(initial);
    };
  }, []);

  if (!quote) return null;

  return (
    <div
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-4px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
        position: "relative",
        overflow: "hidden",
        width: "100%",
      }}
    >
      {/* Shine sweep overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: shine ? "110%" : "-60%",
          width: "50%",
          height: "100%",
          background: "linear-gradient(120deg, transparent 0%, rgba(163,224,90,0.25) 50%, transparent 100%)",
          transition: shine ? "left 1.1s ease" : "none",
          pointerEvents: "none",
          zIndex: 1,
          borderRadius: 8,
        }}
      />

      {/* No truncation anywhere. Below lg it wraps within its full-width row (there's no room to
          go single-line without overflowing a phone). At lg+ it's a floating, uncapped-width
          corner element (see its wrapper in dashboard/layout.tsx) with room to grow leftward, so
          it stays on one line instead of wrapping. */}
      <p
        className="text-base lg:whitespace-nowrap"
        style={{ color: "var(--color-text-secondary)", fontStyle: "italic" }}
      >
        <span style={{ color: "var(--color-green-neon)" }}>"</span>
        {quote.content}
        <span style={{ color: "var(--color-green-neon)" }}>"</span>
        <span className="ml-2 not-italic font-medium" style={{ color: "var(--color-text-muted)" }}>
          — {quote.author}
        </span>
      </p>
    </div>
  );
}
