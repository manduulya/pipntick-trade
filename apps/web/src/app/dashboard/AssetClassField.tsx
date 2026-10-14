"use client";

import { ASSET_CLASSES, ASSET_CLASS_VALUES, type AssetClass } from "@pipntick/shared";

// What the account trades. It limits the instrument picker to that class and names the size
// unit everywhere (Contracts / Lots / Shares / Coins). Options is shown but not selectable yet.
// Used by Add Trading Account and Account Settings.
export default function AssetClassField({
  value,
  onChange,
  error,
}: {
  value: AssetClass | null;
  onChange: (value: AssetClass) => void;
  error?: string | null;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>What do you trade in this account?</label>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Asset class">
        {ASSET_CLASS_VALUES.map((c) => {
          const active = value === c;
          return (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(c)}
              className="px-3 py-1.5 rounded-md text-[11px] font-semibold transition-colors"
              style={{
                backgroundColor: active ? "rgba(123,193,59,0.15)" : "var(--color-bg-base)",
                color: active ? "var(--color-green-neon)" : "var(--color-text-secondary)",
                border: `1px solid ${active ? "rgba(123,193,59,0.45)" : "var(--color-border)"}`,
              }}
            >
              {ASSET_CLASSES[c].label}
            </button>
          );
        })}
        <button
          type="button"
          disabled
          title="Options trading is coming soon"
          className="px-3 py-1.5 rounded-md text-[11px] font-semibold cursor-not-allowed"
          style={{ backgroundColor: "var(--color-bg-base)", color: "var(--color-text-disabled)", border: "1px dashed var(--color-border)" }}
        >
          Options <span className="text-[9px] font-medium">· Soon</span>
        </button>
      </div>
      {value && !error && (
        <p className="text-[10px]" style={{ color: "var(--color-text-muted)" }}>
          Trades are sized in {ASSET_CLASSES[value].unitPlural}
          {value === "forex" ? " (covers currency pairs, spot gold/silver and index CFDs)" : ""}.
        </p>
      )}
      {error && <p className="text-[10px]" style={{ color: "var(--color-danger)" }}>{error}</p>}
    </div>
  );
}
