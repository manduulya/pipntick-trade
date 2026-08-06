"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk, useUser } from "@clerk/nextjs";
import QuoteBar from "./QuoteBar";
import AccountSwitcher from "./AccountSwitcher";
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

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress || "Trader";
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <SelectedAccountProvider>
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: "#05090f" }}>
      {/* Sidebar */}
      <aside
        className="flex flex-col w-56 shrink-0 py-4 px-3"
        style={{ backgroundColor: "#05090f", borderRight: "1px solid #1a2d4a" }}
      >
        {/* Logo */}
        <Link href="/" className="flex justify-center mb-4 px-2">
          <Image src="/logo.svg" alt="pipntick" width={140} height={140} priority />
        </Link>

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
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{
                  color: active ? "#7bc13b" : "#8899aa",
                  backgroundColor: active ? "rgba(123,193,59,0.08)" : "transparent",
                  transition: "background-color 0.3s ease, color 0.3s ease",
                }}
                onMouseEnter={(e) => { if (!active) { const el = e.currentTarget; el.style.backgroundColor = "rgba(255,255,255,0.04)"; el.style.color = "#f0f0f0"; } }}
                onMouseLeave={(e) => { if (!active) { const el = e.currentTarget; el.style.backgroundColor = "transparent"; el.style.color = "#8899aa"; } }}
              >
                <span style={{ color: active ? "#7bc13b" : "#4a5d70" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="flex flex-col gap-0.5 border-t pt-3" style={{ borderColor: "#1a2d4a" }}>
          {bottomItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium"
                style={{
                  color: active ? "#7bc13b" : "#8899aa",
                  backgroundColor: active ? "rgba(123,193,59,0.08)" : "transparent",
                  transition: "background-color 0.3s ease, color 0.3s ease",
                }}
                onMouseEnter={(e) => { if (!active) { const el = e.currentTarget; el.style.backgroundColor = "rgba(255,255,255,0.04)"; el.style.color = "#f0f0f0"; } }}
                onMouseLeave={(e) => { if (!active) { const el = e.currentTarget; el.style.backgroundColor = "transparent"; el.style.color = "#8899aa"; } }}
              >
                <span style={{ color: active ? "#7bc13b" : "#4a5d70" }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
          {/* User */}
          <div className="flex items-center gap-3 px-3 py-2.5 mt-1 rounded-lg" style={{ backgroundColor: "#0b1220" }}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
              style={{ backgroundColor: "rgba(123,193,59,0.15)", color: "#7bc13b" }}
            >
              {initial}
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-medium truncate" style={{ color: "#f0f0f0" }}>{displayName}</span>
              <span className="text-xs truncate" style={{ color: "#4a5d70" }}>Free plan</span>
            </div>
            <button
              type="button"
              onClick={() => signOut(() => router.push("/login"))}
              title="Log out"
              className="shrink-0 p-1.5 rounded-md transition-colors"
              style={{ color: "#8899aa" }}
              onMouseEnter={(e) => { e.currentTarget.style.color = "#e05252"; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = "#8899aa"; }}
            >
              <svg width="22" height="22" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h5a2 2 0 012 2v1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-hidden" style={{ position: "relative" }}>
        <div style={{ position: "absolute", top: 20, right: 16, zIndex: 10, maxWidth: 600 }}>
          <QuoteBar />
        </div>
        {children}
      </main>
    </div>
    </SelectedAccountProvider>
  );
}
