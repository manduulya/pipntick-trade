"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Subtle fade+rise on route change so navigating between dashboard pages reads as a transition
 * rather than an instant swap — gives the sidebar's active-state change some spatial continuity
 * with the content it's pointing at. Respects prefers-reduced-motion via the global CSS rule in
 * globals.css (author-stylesheet !important beats this inline style).
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
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 0.2s ease, transform 0.2s ease",
      }}
    >
      {children}
    </div>
  );
}
