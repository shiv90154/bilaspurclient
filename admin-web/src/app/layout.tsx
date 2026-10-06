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

export const metadata: Metadata = {
  title: { default: "DHĪ", template: "%s · DHĪ" },
  description: "Coaching institute management: students, tests, classes and more.",
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
