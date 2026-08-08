"use client";

import { useEffect, useRef, useState } from "react";
import { matchInstruments, loadStockInstruments } from "../../lib/instruments";

export default function InstrumentInput({
  value,
  onChange,
  style,
}: {
  value: string;
  onChange: (value: string) => void;
  style?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [, forceRematch] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const matches = matchInstruments(value);

  useEffect(() => setHighlighted(0), [value]);

  useEffect(() => {
    loadStockInstruments().then(() => forceRematch((n) => n + 1));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function select(symbol: string) {
    onChange(symbol);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter") {
      if (matches[highlighted]) {
        e.preventDefault();
        select(matches[highlighted].symbol);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        placeholder="Instrument (e.g. EUR/USD)"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        style={style}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div
          className="absolute left-0 right-0 mt-1 z-20 rounded-lg overflow-hidden"
          style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
        >
          {matches.map((inst, i) => (
            <button
              key={inst.symbol}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHighlighted(i)}
              onClick={() => select(inst.symbol)}
              className="flex items-center justify-between w-full px-3 py-1.5 text-left transition-colors"
              style={{ backgroundColor: i === highlighted ? "rgba(123,193,59,0.12)" : "transparent" }}
            >
              <span className="text-xs font-semibold" style={{ color: "var(--color-text-primary)" }}>{inst.symbol}</span>
              <span className="text-[10px] truncate ml-2" style={{ color: "var(--color-text-muted)" }}>{inst.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
