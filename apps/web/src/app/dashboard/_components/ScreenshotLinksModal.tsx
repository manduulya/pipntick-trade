"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { parseTradingViewSnapshot } from "@pipntick/shared";

// Popup opened from the trade form's "Screenshots" button: two optional TradingView snapshot
// links, pre-trade and post-trade. Either (or both) can be left empty. Save hands back normalized
// links (null for empty); Skip closes without changes.

const inputStyle: React.CSSProperties = {
  backgroundColor: "var(--color-bg-base)",
  border: "1px solid var(--color-border)",
  color: "var(--color-text-primary)",
  borderRadius: 6,
  fontSize: 12,
  padding: "7px 10px",
  outline: "none",
  width: "100%",
};

const PLACEHOLDER = "https://www.tradingview.com/x/…";

function LinkField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const snap = value.trim() ? parseTradingViewSnapshot(value) : null;
  const invalid = value.trim() !== "" && !snap;
  const [broken, setBroken] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>{label} <span style={{ color: "var(--color-text-disabled)" }}>· optional</span></label>
      <input
        type="url"
        inputMode="url"
        placeholder={PLACEHOLDER}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={invalid ? { ...inputStyle, border: "1px solid var(--color-danger)" } : inputStyle}
      />
      {invalid && (
        <p className="text-[10px]" style={{ color: "var(--color-danger)" }}>
          Paste a TradingView snapshot link (tradingview.com/x/…). In TradingView: camera icon → Copy link.
        </p>
      )}
      {snap && broken !== snap.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- external snapshot preview
        <img
          src={snap.imageUrl}
          alt={`${label} preview`}
          onError={() => setBroken(snap.imageUrl)}
          className="rounded-md object-cover mt-1"
          style={{ width: "100%", maxHeight: 140, border: "1px solid var(--color-border)" }}
        />
      )}
    </div>
  );
}

export default function ScreenshotLinksModal({
  preTradeUrl,
  postTradeUrl,
  onSave,
  onClose,
}: {
  preTradeUrl: string;
  postTradeUrl: string;
  onSave: (links: { preTradeUrl: string; postTradeUrl: string }) => void;
  onClose: () => void;
}) {
  const [pre, setPre] = useState(preTradeUrl);
  const [post, setPost] = useState(postTradeUrl);
  const invalid = [pre, post].some((v) => v.trim() !== "" && !parseTradingViewSnapshot(v));

  function save() {
    if (invalid) return;
    const norm = (v: string) => (v.trim() ? parseTradingViewSnapshot(v)!.url : "");
    onSave({ preTradeUrl: norm(pre), postTradeUrl: norm(post) });
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(3px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        role="dialog"
        aria-label="Chart screenshots"
        className="w-full max-w-sm rounded-2xl flex flex-col gap-3 p-5"
        style={{ backgroundColor: "var(--color-bg-surface)", border: "1px solid var(--color-border)", maxHeight: "90vh", overflowY: "auto" }}
      >
        <div>
          <h3 className="text-sm font-bold" style={{ color: "var(--color-text-primary)" }}>Chart screenshots</h3>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            TradingView snapshot links from before and after the trade. Skip either one.
          </p>
        </div>
        <LinkField label="Pre-trade chart" value={pre} onChange={setPre} />
        <LinkField label="Post-trade chart" value={post} onChange={setPost} />
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-xs font-semibold"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={save}
            disabled={invalid}
            className="rounded-lg px-4 py-2 text-xs font-semibold transition-opacity"
            style={{ backgroundColor: "var(--color-green-primary)", color: "var(--color-bg-base)", opacity: invalid ? 0.5 : 1 }}
          >
            Save
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
