import type { NextConfig } from "next";

/**
 * Security headers applied to every response.
 *
 * HSTS is intentionally omitted here — Vercel sets it at the edge for custom
 * domains, and emitting it from the app would also apply it to plain-HTTP
 * local development.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    // Health data must never be indexed or cached by intermediaries.
    key: "X-Robots-Tag",
    value: "noindex, nofollow, noarchive",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // `pg` and the Prisma driver adapter must not be bundled for the browser.
  serverExternalPackages: ["@prisma/adapter-pg", "pg", "exceljs"],

  images: {
    remotePatterns: [
      // Media served from the Cloudflare R2 public base URL.
      { protocol: "https", hostname: "**.r2.dev" },
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
    ],
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        // API responses carry participant health data — never store them.
        source: "/api/:path*",
        headers: [
          ...securityHeaders,
          { key: "Cache-Control", value: "no-store, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
