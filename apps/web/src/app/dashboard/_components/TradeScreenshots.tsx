"use client";

import { useState } from "react";
import { parseTradingViewSnapshot } from "@pipntick/shared";

// Pre/post-trade TradingView snapshots for one trade (Journal expanded row, calendar day view).
// Thumbnails use the PNG behind each snapshot link — an informal TradingView path — so a thumbnail
// that fails to load falls back to a plain link. Renders nothing when the trade has neither link.

function Shot({ label, url }: { label: string; url: string }) {
  const snap = parseTradingViewSnapshot(url);
  const [broken, setBroken] = useState(false);
  const href = snap?.url ?? url;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="group flex flex-col gap-1 shrink-0"
      title={`Open the ${label.toLowerCase()} chart on TradingView`}
    >
      <span className="text-[10px] font-semibold" style={{ color: "var(--color-text-muted)" }}>{label}</span>
      {snap && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- external snapshot, no Next image config
        <img
          src={snap.imageUrl}
          alt={`${label} chart`}
          loading="lazy"
          onError={() => setBroken(true)}
          className="rounded-md object-cover transition-opacity group-hover:opacity-80"
          style={{ width: 168, height: 96, border: "1px solid var(--color-border)", backgroundColor: "var(--color-bg-base)" }}
        />
      ) : (
        <span className="text-[11px] underline" style={{ color: "var(--color-green-primary)" }}>Open on TradingView ↗</span>
      )}
    </a>
  );
}

export default function TradeScreenshots({ preTradeUrl, postTradeUrl }: { preTradeUrl: string | null; postTradeUrl: string | null }) {
  if (!preTradeUrl && !postTradeUrl) return null;
  return (
    <div className="flex flex-wrap gap-3">
      {preTradeUrl && <Shot label="Pre-trade" url={preTradeUrl} />}
      {postTradeUrl && <Shot label="Post-trade" url={postTradeUrl} />}
    </div>
  );
}
