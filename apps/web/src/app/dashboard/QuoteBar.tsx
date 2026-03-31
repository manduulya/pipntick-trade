"use client";

import { useEffect, useState, useRef } from "react";

const STORAGE_KEY = "pipntick_quote";
const STORAGE_TS  = "pipntick_quote_ts";
const TWELVE_HOURS = 12 * 60 * 60 * 1000;
const SHINE_INTERVAL = 15 * 60 * 1000;

type Quote = { content: string; author: string };

// Tags to fetch trading/investing/motivational quotes
const TAGS = ["success", "motivational", "business", "leadership"];

async function fetchQuote(): Promise<Quote> {
  const tag = TAGS[Math.floor(Math.random() * TAGS.length)];
  try {
    const res = await fetch(`https://api.quotable.io/random?tags=${tag}&minLength=40&maxLength=140`);
    if (!res.ok) throw new Error();
    const data = await res.json();
    return { content: data.content, author: data.author };
  } catch {
    return { content: "The stock market is a device for transferring money from the impatient to the patient.", author: "Warren Buffett" };
  }
}

export default function QuoteBar() {
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
        const q = await fetchQuote();
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

      <p
        className="text-xs"
        style={{ color: "#8899aa", fontStyle: "italic", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
      >
        <span style={{ color: "#a3e05a" }}>"</span>
        {quote.content}
        <span style={{ color: "#a3e05a" }}>"</span>
        <span className="ml-2 not-italic font-medium" style={{ color: "#4a5d70" }}>
          — {quote.author}
        </span>
      </p>
    </div>
  );
}
