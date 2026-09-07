import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pipntick.trade";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The app is behind auth and has nothing to index. No trailing slash so it also covers the
      // bare `/dashboard`. Auth pages (/login, /register, /sso-callback) are intentionally left
      // crawlable so Google can see their `noindex` and drop them cleanly.
      disallow: "/dashboard",
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
