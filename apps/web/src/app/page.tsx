import Image from "next/image";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import ViewTransitionLink from "./ViewTransitionLink";

const features = [
  {
    icon: "◎",
    title: "Trade Logging",
    description:
      "Log trades manually, upload screenshots, or sync live from MT4/MT5.",
  },
  {
    icon: "◈",
    title: "Performance Analytics",
    description:
      "Weekly, monthly, and yearly breakdowns of your P&L, win rate, and risk metrics.",
  },
  {
    icon: "▦",
    title: "Trading Calendar",
    description:
      "Visual calendar with green and red days at a glance. Spot patterns in your trading behaviour.",
  },
  {
    icon: "⬡",
    title: "AI Trade Analysis",
    description:
      "Select any trade and get an AI-generated report with chart annotations and insights.",
  },
  {
    icon: "⇄",
    title: "MT4 / MT5 Live Sync",
    description:
      "Connect your broker account via EA and have trades populate automatically in real time.",
  },
  {
    icon: "◉",
    title: "Market News & Events",
    description:
      "Economic calendar filtered by country, currency, and impact level — always in context.",
  },
];

export default async function Home() {
  const user = await currentUser();
  const displayName = user?.firstName || user?.fullName || user?.primaryEmailAddress?.emailAddress || "Trader";

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg-base)", color: "var(--color-text-primary)" }}>

      {/* Navbar — pinned to the dark palette regardless of the page theme (see globals.css's
          [data-theme="dark"] block), same treatment as the dashboard sidebar. Needs its own
          explicit background (the surrounding page div's bg would otherwise show through, since
          <header> itself has none). */}
      <header data-theme="dark" style={{ backgroundColor: "var(--color-bg-base)", borderBottom: "1px solid var(--color-border)" }}>
        <nav className="max-w-6xl mx-auto px-6 py-1 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.svg" alt="pipntick" width={120} height={120} priority />
          </Link>
          <div className="flex items-center gap-6">
            <SignedOut>
              <Link href="/login" className="nav-link text-sm">
                Log in
              </Link>
              <Link href="/register" className="neon-btn text-sm font-medium px-4 py-2 rounded-md">
                Get started
              </Link>
            </SignedOut>
            <SignedIn>
              <span className="text-sm" style={{ color: "var(--color-text-secondary)" }}>
                Hello {displayName}!
              </span>
              <ViewTransitionLink href="/dashboard" className="neon-btn text-sm font-medium px-4 py-2 rounded-md">
                Dashboard
              </ViewTransitionLink>
            </SignedIn>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="gradient-radial-green">
        <div className="max-w-6xl mx-auto px-6 pt-28 pb-32 text-center">
          <div
            className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-full mb-8 neon-border border"
            style={{ color: "var(--color-green-primary)", backgroundColor: "rgba(123,193,59,0.05)" }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ backgroundColor: "var(--color-green-primary)", boxShadow: "0 0 6px rgba(123,193,59,0.8)" }}
            />
            Now in early access
          </div>

          <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-tight mb-6">
            Track your trades.
            <br />
            <span className="neon-text">Master your edge.</span>
          </h1>

          <p className="text-lg max-w-xl mx-auto mb-10" style={{ color: "var(--color-text-secondary)" }}>
            pipntick is a professional trading journal that helps you log, analyse,
            and improve every trade — powered by AI insights and real-time broker sync.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <SignedOut>
              <Link href="/register" className="neon-btn font-semibold px-6 py-3 rounded-md text-sm">
                Start for free
              </Link>
              <Link href="/login" className="ghost-btn text-sm font-medium px-6 py-3 rounded-md">
                Log in →
              </Link>
            </SignedOut>
            <SignedIn>
              <ViewTransitionLink href="/dashboard" className="neon-btn font-semibold px-6 py-3 rounded-md text-sm">
                Go to dashboard →
              </ViewTransitionLink>
            </SignedIn>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-32">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Everything a serious trader needs
          </h2>
          <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
            One place for your entire trading operation.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px" style={{ backgroundColor: "var(--color-border)" }}>
          {features.map((f) => (
            <div key={f.title} className="feature-card p-8">
              <div className="text-2xl mb-4 neon-text">{f.icon}</div>
              <h3 className="text-base font-semibold mb-2">{f.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="max-w-6xl mx-auto px-6 py-28 text-center">
          <h2 className="text-4xl font-bold tracking-tight mb-4">
            Ready to trade <span className="neon-text">smarter</span>?
          </h2>
          <p className="text-base mb-10" style={{ color: "var(--color-text-secondary)" }}>
            Join traders who use pipntick to build consistency and discipline.
          </p>
          <SignedOut>
            <Link href="/register" className="neon-btn font-semibold px-8 py-3 rounded-md text-sm inline-block">
              Get started for free
            </Link>
          </SignedOut>
          <SignedIn>
            <ViewTransitionLink href="/dashboard" className="neon-btn font-semibold px-8 py-3 rounded-md text-sm inline-block">
              Go to dashboard
            </ViewTransitionLink>
          </SignedIn>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-3 items-center text-xs" style={{ color: "var(--color-text-muted)" }}>
          <span aria-hidden="true" />
          <span className="text-center">© 2026 pipntick.trade</span>
          <div className="flex gap-6 justify-end">
            <SignedOut>
              <Link href="/login" className="footer-link">Log in</Link>
              <Link href="/register" className="footer-link">Register</Link>
            </SignedOut>
          </div>
        </div>
      </footer>
    </div>
  );
}
