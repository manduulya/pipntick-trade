import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pipntick.trade";

// Only the pages that should be indexed. /login and /register are noindex; /dashboard is private.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ["", "/privacy", "/terms"].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
    changeFrequency: path === "" ? "weekly" : "monthly",
    priority: path === "" ? 1 : 0.5,
  }));
}
