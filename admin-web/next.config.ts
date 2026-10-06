import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (see admin-web/Dockerfile).
  output: "standalone",
  // Do not advertise the framework version.
  poweredByHeader: false,
};

export default nextConfig;
