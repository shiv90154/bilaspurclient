import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

// Same family as the mobile app. Not a variable font, so the weights are listed; Devanagari is
// included so Hindi names and notes render in the same face.
const poppins = Poppins({
  variable: "--font-poppins",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin", "devanagari"],
});

// Link previews (WhatsApp, Facebook, Telegram) need absolute URLs for the share image.
const SITE_URL = process.env.PUBLIC_ORIGIN ?? "https://dhiayurved.com";
const DESCRIPTION =
  "DHĪ (DHI) Ayurveda Classroom by Dr. Pardeuman Singh, BAMS, MS: online coaching for AIAPGET, AMO and BAMS exams with live classes, PDF notes, test series and doubt solving.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "DHĪ Ayurveda Classroom", template: "%s · DHĪ Ayurveda Classroom" },
  description: DESCRIPTION,
  applicationName: "DHĪ",
  keywords: [
    "DHI Ayurveda", "DHI Ayurved", "Ayurveda classroom", "Dr. Pardeuman Singh", "AIAPGET coaching", "AIAPGET preparation",
    "AMO exam preparation", "Ayurveda Medical Officer exam", "BAMS coaching", "online Ayurveda classes", "Ayurveda test series",
    "Shalya Tantra", "Himachal Pradesh",
  ],
  authors: [{ name: "Dr. Pardeuman Singh" }],
  creator: "DHĪ Ayurveda Classroom",
  category: "education",
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    type: "website",
    siteName: "DHĪ Ayurveda Classroom",
    title: "DHĪ Ayurveda Classroom: AIAPGET & AMO coaching by Dr. Pardeuman Singh",
    description: DESCRIPTION,
    url: "/",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "DHĪ Ayurveda Classroom: AIAPGET & AMO coaching by Dr. Pardeuman Singh",
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${poppins.variable} h-full antialiased`}>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
