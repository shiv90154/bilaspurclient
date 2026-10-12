import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { getOpenPlans } from "@/lib/server/public-plans";

/** Public pages for search engines, plus one page per open course. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const pages: MetadataRoute.Sitemap = ["", "/about", "/courses", "/features", "/app", "/contact", "/register", "/privacy", "/terms"].map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: path === "/courses" ? "weekly" : "monthly",
    priority: path === "" ? 1 : path === "/courses" ? 0.9 : 0.6,
  }));
  const courses = (await getOpenPlans()).map((p) => ({
    url: `${SITE_URL}/courses/${p.id}`,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));
  return [...pages, ...courses];
}
