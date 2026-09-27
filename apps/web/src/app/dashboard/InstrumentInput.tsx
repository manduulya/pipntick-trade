"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { matchInstruments, loadStockInstruments } from "../../lib/instruments";

const PORTAL_MIN_WIDTH = 280;

export default function InstrumentInput({
  value,
  onChange,
  onSelect,
  style,
  className,
  placeholder = "Instrument (e.g. EUR/USD)",
  portal = false,
  inputProps,
}: {
  value: string;
  /** Every keystroke. */
  onChange: (value: string) => void;
  /** A symbol picked from the suggestion list (defaults to onChange). */
  onSelect?: (symbol: string) => void;
  style?: React.CSSProperties;
  className?: string;
  placeholder?: string;
  /** Render the suggestion list in a fixed-position portal instead of inline — needed when the
   * input sits inside an `overflow: hidden`/scrolling ancestor that would clip it (Trade Plan tiles). */
  portal?: boolean;
  inputProps?: Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "style" | "className" | "placeholder">;
}) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [, forceRematch] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const matches = matchInstruments(value);
  const showList = open && matches.length > 0;

  useEffect(() => setHighlighted(0), [value]);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    loadStockInstruments().then(() => forceRematch((n) => n + 1));
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || listRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Portal mode: pin the list under the input, following scroll (any ancestor, hence capture) and
  // resize, and keep it on-screen horizontally.
  useLayoutEffect(() => {
    if (!portal || !showList) return;
    function place() {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const width = Math.max(r.width, PORTAL_MIN_WIDTH);
      const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
      setRect({ left, top: r.bottom + 4, width });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [portal, showList, value]);

  function select(symbol: string) {
    (onSelect ?? onChange)(symbol);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    handleListKeys(e);
    // The caller's handler only sees keys the list didn't consume (e.g. Enter picking a match
    // shouldn't also trigger a caller's "Enter = done" blur).
    if (!e.defaultPrevented) inputProps?.onKeyDown?.(e);
  }

  function handleListKeys(e: React.KeyboardEvent<HTMLInputElement>) {
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
      e.preventDefault();
      setOpen(false);
    }
  }

  const list = (
    <div
      ref={listRef}
      role="listbox"
      className={portal ? "fixed z-[60] rounded-lg overflow-hidden" : "absolute left-0 right-0 mt-1 z-20 rounded-lg overflow-hidden"}
      style={{
        backgroundColor: "var(--color-bg-surface)",
        border: "1px solid var(--color-border)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        ...(portal && rect ? { left: rect.left, top: rect.top, width: rect.width } : {}),
      }}
    >
      {matches.map((inst, i) => (
        <button
          key={`${inst.symbol}|${inst.name}`}
          type="button"
          role="option"
          aria-selected={i === highlighted}
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
  );

  return (
    <div ref={containerRef} className={portal ? "relative flex-1 min-w-0" : "relative"}>
      <input
        {...inputProps}
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={(e) => { setOpen(true); inputProps?.onFocus?.(e); }}
        onBlur={(e) => { setOpen(false); inputProps?.onBlur?.(e); }}
        onKeyDown={handleKeyDown}
        style={style}
        className={className}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-autocomplete="list"
      />
      {showList && (portal ? mounted && rect && createPortal(list, document.body) : list)}
    </div>
  );
}
