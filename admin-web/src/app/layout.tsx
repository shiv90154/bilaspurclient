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
const SITE_URL = process.env.PUBLIC_ORIGIN ?? "https://xn--dhayurveda-2sb.com";
const DESCRIPTION =
  "Learn Ayurveda with Dr. Pardeuman Singh: live classes, PDF notes, test series and doubt solving in the DHĪ app.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: "DHĪ · Ayurveda Classroom", template: "%s · DHĪ" },
  description: DESCRIPTION,
  applicationName: "DHĪ",
  openGraph: {
    type: "website",
    siteName: "DHĪ · Ayurveda Classroom",
    title: "DHĪ · Ayurveda Classroom by Dr. Pardeuman Singh",
    description: DESCRIPTION,
    url: "/",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    title: "DHĪ · Ayurveda Classroom by Dr. Pardeuman Singh",
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
