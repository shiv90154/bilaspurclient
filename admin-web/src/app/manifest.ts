import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

/**
 * Web app manifest: lets the website be installed like an app (PWA) on computers, iPhones and
 * Android. It opens on /login, which sends a signed-in user straight to their own home.
 * The Play Store app is listed as the related app; `prefer_related_applications` stays false
 * so browsers still offer the web version (staff and iPhone users need it).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "DHĪ Ayurveda Classroom",
    short_name: "DHĪ",
    description: "AIAPGET, AMO and BAMS coaching by Dr. Pardeuman Singh: live classes, doubts, fees and your profile.",
    start_url: "/login",
    scope: "/",
    display: "standalone",
    background_color: "#fdfaf3",
    theme_color: "#1f4d2c",
    lang: "en-IN",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Courses", url: "/courses", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Contact", url: "/contact", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
    related_applications: [{ platform: "play", url: SITE.playStore, id: "com.dhiayurved.app" }],
    prefer_related_applications: false,
  };
}
