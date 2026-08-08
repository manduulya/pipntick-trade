"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import QuoteBar from "./QuoteBar";
import AccountSwitcher from "./AccountSwitcher";
import AdSlot from "./AdSlot";
import PageTransition from "./PageTransition";
import ViewTransitionLink from "../ViewTransitionLink";
import { SelectedAccountProvider } from "../../lib/account-context";

const navItems = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    ),
  },
  {
    label: "Performance",
    href: "/dashboard/performance",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 20L9 13l4 4 4-5 3 3" />
      </svg>
    ),
  },
  {
    label: "Journal",
    href: "/dashboard/journal",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
  {
    label: "AI Analysis",
    href: "/dashboard/ai",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3a9 9 0 100 18A9 9 0 0012 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3" />
      </svg>
    ),
  },
  {
    label: "Market News",
    href: "/dashboard/news",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V7a2 2 0 012-2h10l6 6v7a2 2 0 01-2 2z" />
        <path strokeLinecap="round" d="M9 12h6M9 16h4" />
      </svg>
    ),
  },
];

const bottomItems = [
  {
    label: "Settings",
    href: "/dashboard/settings",
    icon: (
      <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the drawer on navigation — otherwise picking a nav item on mobile leaves it open
  // behind the newly-loaded page.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Escape closes the drawer, same convention as AccountSwitcher's dropdown.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawerOpen(false);
    }
    if (drawerOpen) document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [drawerOpen]);

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Trader";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <SelectedAccountProvider>
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "var(--color-bg-base)" }}>
      {/* Drawer backdrop — mobile/tablet only (lg: the sidebar is always visible, no drawer).
          Always mounted, opacity/pointer-events driven by drawerOpen so it can transition instead
          of snapping, same "always mounted, CSS-driven visibility" pattern as AccountSwitcher's
          dropdown. */}
      <div
        aria-hidden="true"
        onClick={() => setDrawerOpen(false)}
        className="lg:hidden fixed inset-0 z-40"
        style={{
          backgroundColor: "rgba(0,0,0,0.6)",
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? "auto" : "none",
          transition: "opacity 0.3s ease",
        }}
      />

      {/* Sidebar — pinned to the dark palette regardless of the page theme (see globals.css's
          [data-theme="dark"] block), by design: the nav rail stays dark even in light mode.
          Below lg: a fixed slide-out drawer (transform-driven, toggled by drawerOpen). At lg+:
          back to the original static rail — internals below are completely unchanged either way,
          only this element's own positioning/transform differs per breakpoint. */}
      <aside
        data-theme="dark"
        className={`flex flex-col w-56 shrink-0 py-4 px-3 fixed inset-y-0 left-0 z-50 transition-transform duration-300 ease-in-out lg:static lg:z-auto lg:translate-x-0 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
        style={{
          backgroundColor: "var(--color-bg-base)",
          borderRight: "1px solid var(--color-border)",
          boxShadow: drawerOpen ? "0 0 40px rgba(0,0,0,0.5)" : undefined,
        }}
      >
        {/* Logo */}
        <ViewTransitionLink href="/" className="flex justify-center mb-4 px-2">
          <Image src="/logo.svg" alt="pipntick" width={140} height={140} priority />
        </ViewTransitionLink>

        {/* Account switcher */}
        <AccountSwitcher />

        {/* Nav */}
        <nav className="flex flex-col gap-0.5 flex-1">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="focus-ring press-scale relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-lg text-sm font-medium"
                style={{
                  color: active ? "var(--color-green-primary)" : "var(--color-text-secondary)",
                  backgroundColor: active ? "rgba(123,193,59,0.08)" : "transparent",
                  transition: "background-color 0.3s ease, color 0.3s ease",
                }}
                onMouseEnter={(e) => { if (!active) { const el = e.currentTarget; el.style.backgroundColor = "rgba(255,255,255,0.04)"; el.style.color = "var(--color-text-primary)"; } }}
                onMouseLeave={(e) => { if (!active) { const el = e.currentTarget; el.style.backgroundColor = "transparent"; el.style.color = "var(--color-text-secondary)"; } }}
              >
                {/* Current-page accent bar — a stronger, more standard "you are here" signal than
                    color/background alone. */}
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "20%",
                    bottom: "20%",
                    width: 3,
                    borderRadius: 2,
                    backgroundColor: "var(--color-green-primary)",
                    opacity: active ? 1 : 0,
                    transition: "opacity 0.2s ease",
                  }}
                />
                <span style={{ color: active ? "var(--color-green-primary)" : "var(--color-text-muted)" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <AdSlot />

        {/* Bottom */}
        <div className="flex flex-col gap-0.5 border-t pt-3" style={{ borderColor: "var(--color-border)" }}>
          {bottomItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="focus-ring press-scale relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-lg text-sm font-medium"
                style={{
                  color: active ? "var(--color-green-primary)" : "var(--color-text-secondary)",
                  backgroundColor: active ? "rgba(123,193,59,0.08)" : "transparent",
                  transition: "background-color 0.3s ease, color 0.3s ease",
                }}
                onMouseEnter={(e) => { if (!active) { const el = e.currentTarget; el.style.backgroundColor = "rgba(255,255,255,0.04)"; el.style.color = "var(--color-text-primary)"; } }}
                onMouseLeave={(e) => { if (!active) { const el = e.currentTarget; el.style.backgroundColor = "transparent"; el.style.color = "var(--color-text-secondary)"; } }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "20%",
                    bottom: "20%",
                    width: 3,
                    borderRadius: 2,
                    backgroundColor: "var(--color-green-primary)",
                    opacity: active ? 1 : 0,
                    transition: "opacity 0.2s ease",
                  }}
                />
                <span style={{ color: active ? "var(--color-green-primary)" : "var(--color-text-muted)" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          {/* User */}
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg" style={{ backgroundColor: "var(--color-bg-surface)" }}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "rgba(123,193,59,0.15)", color: "var(--color-green-primary)" }}
            >
              {initial}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-medium truncate" style={{ color: "var(--color-text-primary)" }}>{displayName}</span>
              <span className="text-xs truncate" style={{ color: "var(--color-text-muted)" }}>Free plan</span>
            </div>
            <button
              type="button"
              onClick={() => signOut(() => router.push("/login"))}
              title="Log out"
              aria-label="Log out"
              className="focus-ring press-scale shrink-0 p-2.5 rounded-md transition-colors"
              style={{ color: "var(--color-text-secondary)" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--color-danger)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--color-text-secondary)"; }}
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h5a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ position: "relative" }}>
        {/* Mobile-only header strip: hamburger opens the drawer. Hidden at lg+, where the
            sidebar is always visible and needs no toggle. */}
        <div className="lg:hidden flex items-center shrink-0 px-4 py-3" style={{ borderBottom: "1px solid var(--color-border)" }}>
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation menu"
            className="focus-ring press-scale p-2 -ml-2 rounded-md"
            style={{ color: "var(--color-text-secondary)" }}
          >
            <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        {/* QuoteBar: floats top-right at lg+ (original design, unchanged), single line, growing
            as wide as it needs to the left rather than capped/wrapped; sits inline below the
            mobile header strip on smaller screens instead of overlapping page content. */}
        <div className="px-4 pt-3 lg:px-0 lg:pt-0 lg:absolute lg:top-5 lg:right-4 lg:z-10">
          <QuoteBar />
        </div>

        <div className="flex-1 min-h-0">
          <PageTransition>{children}</PageTransition>
        </div>
      </main>
    </div>
    </SelectedAccountProvider>
  );
}
