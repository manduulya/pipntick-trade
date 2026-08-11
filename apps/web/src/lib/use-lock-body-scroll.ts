"use client";

import { useEffect } from "react";

// All the app's modals (AccountSettingsModal, AddAccountModal, DeleteTradingAccountModal, etc.)
// are `position: fixed` overlays layered on top of the page — they were never actually
// preventing the page underneath from scrolling. On a Windows/non-overlay-scrollbar setup that
// leaves the *page's* scrollbar visibly rendered next to (or through) the modal card whenever
// the page behind it is tall enough to scroll, which reads as a stray/misplaced scrollbar on
// the modal itself. Locking `document.body` overflow for the modal's lifetime is the standard
// fix — call this from any modal component's top level, unconditionally (it doesn't need to be
// wrapped in the modal's own open/visible state, since the component only exists in the tree
// while it's mounted).
export function useLockBodyScroll() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);
}
