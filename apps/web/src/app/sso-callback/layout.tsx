import type { Metadata } from "next";

// Auth / utility page — no standalone content worth indexing, and it must not compete with the
// homepage for ranking. The page itself is a client component, so its metadata lives here.
// (No canonical: Google treats noindex + canonical as conflicting signals.)
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function AuthUtilityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
