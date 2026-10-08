import type { NextConfig } from "next";

/** Sent with every page and API response (doc 09: transport + XSS hardening). */
const securityHeaders = [
  // Browsers only honour this over HTTPS; production always is (Nginx + Let's Encrypt).
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self \"https://api.razorpay.com\")" },
  // No script restrictions here (Next inlines its bootstrap); this only blocks framing,
  // <base> hijacking, plugins and forms posting to other sites.
  {
    key: "Content-Security-Policy",
    value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'",
  },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see admin-web/Dockerfile).
  output: "standalone",
  // Do not advertise the framework version.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
