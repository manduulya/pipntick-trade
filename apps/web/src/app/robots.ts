import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pipntick.trade";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The app itself is behind auth and has nothing to index; keep crawlers on the public pages.
      disallow: ["/dashboard/", "/sso-callback"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
