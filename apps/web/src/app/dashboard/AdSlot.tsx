"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;
const SIDEBAR_SLOT_ID = process.env.NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT_ID;

/**
 * Sidebar ad unit, shown to all users (no paid tier exists yet to gate this on — see the
 * conversation this was scoped in). Renders nothing once slot ID isn't configured, same
 * env-gated escape hatch as the API's DEV_AUTH_BYPASS: the AdSense *account* (CLIENT_ID) can be
 * wired up before the specific ad *unit* (SIDEBAR_SLOT_ID) exists, without breaking the page —
 * create the unit in the AdSense dashboard (Ads > By ad unit > Display ads) and set
 * NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT_ID to go live.
 */
export default function AdSlot() {
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID || !SIDEBAR_SLOT_ID || pushedRef.current) return;
    pushedRef.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      // Ad blockers / offline / script not yet loaded all throw here — never let a failed ad
      // request break the sidebar it's sitting in.
      console.warn("AdSense push failed", err);
    }
  }, []);

  if (!CLIENT_ID || !SIDEBAR_SLOT_ID) {
    if (process.env.NODE_ENV !== "production") {
      return (
        <div
          className="mx-2 mb-3 rounded-lg px-3 py-2 text-[10px]"
          style={{ border: "1px dashed var(--color-border)", color: "var(--color-text-disabled)" }}
        >
          Ad slot not configured — set NEXT_PUBLIC_ADSENSE_SIDEBAR_SLOT_ID (dev-only notice).
        </div>
      );
    }
    return null;
  }

  return (
    <div
      className="mx-2 mb-3 overflow-hidden rounded-lg"
      // Reserve space so an ad filling in later doesn't shove the sidebar's bottom nav around.
      style={{ border: "1px solid var(--color-border)", minHeight: 100 }}
    >
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={CLIENT_ID}
        data-ad-slot={SIDEBAR_SLOT_ID}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
