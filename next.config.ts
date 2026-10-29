import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers(){return [{source:"/:path*",headers:[{key:"X-Content-Type-Options",value:"nosniff"},{key:"Referrer-Policy",value:"no-referrer"},{key:"X-Frame-Options",value:"SAMEORIGIN"},{key:"Permissions-Policy",value:"camera=(), microphone=(), geolocation=()"},{key:"Content-Security-Policy",value:"frame-ancestors 'self'; base-uri 'self'; object-src 'none'"}]}];},
  // Keep development files separate so production builds cannot overwrite them.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  outputFileTracingIncludes: {
    "/api/cvs": ["./node_modules/pdf-parse/dist/worker/**/*", "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};
export default nextConfig;
