import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import { currentUser } from "@clerk/nextjs/server";
import ViewTransitionLink from "./ViewTransitionLink";
import SiteFooter from "./_components/SiteFooter";

export const metadata: Metadata = {
  description:
    "A trading journal for logging every trade, spotting green and red days on a calendar, and tracking your win rate, profit factor, and P&L over weekly, monthly, and yearly ranges.",
};

const steps = [
  {
    n: "1",
    title: "Log your trades",
    description:
      "Add trades by hand in seconds, drop in a broker screenshot for the details to be read automatically, or import a CSV. Entry, exit, size, session, and fees are all captured.",
  },
  {
    n: "2",
    title: "See your month at a glance",
    description:
      "Every trading day lands on the calendar as green or red with its net P&L, so winning and losing streaks — and the days you overtrade — jump out immediately.",
  },
  {
    n: "3",
    title: "Understand what's working",
    description:
      "The performance view breaks down win rate, profit factor, average win and loss, and results by instrument and direction across any time range you pick.",
  },
];

const faqs = [
  {
    q: "Is pipntick free?",
    a: "Yes. pipntick is in early access and free to use. Ads help cover hosting while it grows.",
  },
  {
    q: "Do I need to connect my broker?",
    a: "No. You can log every trade manually or from screenshots. Live MT4/MT5 sync is optional and coming as the platform matures.",
  },
  {
    q: "Is my trading data private?",
    a: "Yes. Your trades, notes, and screenshots are tied to your account and are never sold or shared. You can permanently delete everything from Settings at any time.",
  },
  {
    q: "Does pipntick give trading advice?",
    a: "No. pipntick is a record-keeping and analytics tool. Its numbers and any AI commentary are informational only and are not financial advice or trade recommendations.",
  },
  {
    q: "What markets does it support?",
    a: "Forex, metals, indices, stocks, and crypto — contract sizes for common instruments are handled automatically when P&L is calculated.",
  },
];

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

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 pb-28">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight mb-4">How pipntick works</h2>
          <p className="text-base" style={{ color: "var(--color-text-secondary)" }}>
            Three steps between a closed position and a clear picture of your edge.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((s) => (
            <div key={s.n}>
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold mb-4"
                style={{ backgroundColor: "rgba(123,193,59,0.12)", border: "1px solid rgba(123,193,59,0.3)", color: "var(--color-green-primary)" }}
              >
                {s.n}
              </div>
              <h3 className="text-base font-semibold mb-2">{s.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-28">
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

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-6 pb-28">
        <h2 className="text-3xl font-bold tracking-tight mb-12 text-center">Frequently asked questions</h2>
        <div className="flex flex-col">
          {faqs.map((f) => (
            <div key={f.q} className="py-6" style={{ borderTop: "1px solid var(--color-border)" }}>
              <h3 className="text-base font-semibold mb-2">{f.q}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                {f.a}
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

      <SiteFooter />
    </div>
  );
}
