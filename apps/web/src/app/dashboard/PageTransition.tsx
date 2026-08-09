"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Subtle fade+rise on route change so navigating between dashboard pages reads as a transition
 * rather than an instant swap — gives the sidebar's active-state change some spatial continuity
 * with the content it's pointing at. Respects prefers-reduced-motion via the global CSS rule in
 * globals.css (author-stylesheet !important beats this inline style).
 *
 * `transform` is omitted (not set to "translateY(0)") once visible — any transform value, even a
 * no-op one, makes this div a new containing block for `position: fixed` descendants, which broke
 * every dashboard modal's fullscreen backdrop (it covered only this div's box instead of the real
 * viewport, leaving the mobile header/QuoteBar strip uncovered above it).
 */
export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);
    // A single rAF often fires before the browser has actually painted the opacity:0 frame, so
    // the transition has no "before" state to animate from and just jumps straight to visible.
    // Nesting two rAFs guarantees a paint happens in between.
    let innerFrame = 0;
    const outerFrame = requestAnimationFrame(() => {
      innerFrame = requestAnimationFrame(() => setVisible(true));
    });
    return () => {
      cancelAnimationFrame(outerFrame);
      cancelAnimationFrame(innerFrame);
    };
  }, [pathname]);

  return (
    // h-full is required — this sits between `main` (which stretches to fill the viewport as a
    // flex item) and page content that assumes it can use h-full itself (e.g. EmptyAccountsState
    // centering vertically). Without it this div collapses to its content's height and every
    // "centered" page below it silently stops centering.
    <div
      className="h-full"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? undefined : "translateY(6px)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
      }}
    >
      {children}
    </div>
  );
}
