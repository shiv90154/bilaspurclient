import type { MetadataRoute } from "next";

const SITE_URL = process.env.PUBLIC_ORIGIN ?? "https://dhiayurved.com";

/** Search engines may read the public website; the panels behind login stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/learn", "/dashboard", "/receipt/", "/download"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
