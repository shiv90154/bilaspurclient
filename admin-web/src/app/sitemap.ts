import type { MetadataRoute } from "next";

const SITE_URL = process.env.PUBLIC_ORIGIN ?? "https://dhiayurved.com";

/** Public pages for search engines. */
export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/about", "/courses", "/features", "/app", "/contact", "/register", "/privacy", "/terms"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "/courses" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/courses" ? 0.9 : 0.6,
  }));
}
