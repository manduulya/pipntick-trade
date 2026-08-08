"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * Navigating between the public site (`/`) and the dashboard (`/dashboard/*`) crosses a full
 * route-tree boundary — different layout entirely, nothing persists across it — so there's no
 * shared component to animate through the way dashboard/PageTransition.tsx does for navigation
 * *within* the dashboard. The browser's native View Transitions API crossfades the old and new
 * page snapshots for us instead — no extra markup, degrades to a plain instant navigation
 * wherever it isn't supported yet. Used for both directions: page.tsx's "Dashboard" buttons and
 * the dashboard sidebar's logo (back to "/").
 */
export default function ViewTransitionLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();

  function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    // Let modified clicks (open in new tab, etc.) behave normally.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const startViewTransition = (document as { startViewTransition?: (cb: () => void) => void }).startViewTransition;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!startViewTransition || prefersReducedMotion) return; // fall through to normal Link navigation

    e.preventDefault();
    startViewTransition.call(document, () => {
      router.push(href);
    });
  }

  return (
    <Link href={href} className={className} onClick={handleClick}>
      {children}
    </Link>
  );
}
