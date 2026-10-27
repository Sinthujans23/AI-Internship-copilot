import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Keep development files separate so production builds cannot overwrite them.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  serverExternalPackages: ["pdf-parse"],
};
export default nextConfig;
