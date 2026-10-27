import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  // Keep development files separate so production builds cannot overwrite them.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/cvs": ["./node_modules/pdf-parse/dist/worker/**/*", "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};
export default nextConfig;
