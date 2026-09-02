import Link from "next/link";

// Shared footer for the public marketing + legal pages. Static links only (no auth-gated items)
// so it renders identically on every public route — and so the Privacy / Terms links Google's
// AdSense review looks for are present site-wide.
export default function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--color-border)" }}>
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs" style={{ color: "var(--color-text-muted)" }}>
        <span>© {new Date().getFullYear()} pipntick.trade</span>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/" className="footer-link">Home</Link>
          <Link href="/privacy" className="footer-link">Privacy Policy</Link>
          <Link href="/terms" className="footer-link">Terms of Service</Link>
          <Link href="/login" className="footer-link">Log in</Link>
        </nav>
      </div>
    </footer>
  );
}
