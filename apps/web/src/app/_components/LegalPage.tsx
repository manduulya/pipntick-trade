import Image from "next/image";
import Link from "next/link";
import SiteFooter from "./SiteFooter";

// Chrome + prose styling shared by /privacy and /terms. Kept deliberately plain — these pages
// exist for readability and for AdSense's policy review, not to be marketing surfaces.
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--color-bg-base)", color: "var(--color-text-primary)" }}>
      <header data-theme="dark" style={{ backgroundColor: "var(--color-bg-base)", borderBottom: "1px solid var(--color-border)" }}>
        <nav className="max-w-6xl mx-auto px-6 py-1 flex items-center justify-between">
          <Link href="/">
            <Image src="/logo.svg" alt="pipntick" width={120} height={120} priority />
          </Link>
          <Link href="/" className="nav-link text-sm">← Back to home</Link>
        </nav>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-16 legal-prose">
        <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
        <p className="text-xs mb-12" style={{ color: "var(--color-text-muted)" }}>Last updated: {updated}</p>
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
