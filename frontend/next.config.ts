import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,

  // ─── Image Optimization ────────────────────────────────────
  images: {
    // Allow remote images from the backend API server
    remotePatterns: [
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "5000",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "5000",
        pathname: "/uploads/**",
      },
      // Support production/staging URLs (customize as needed)
      {
        protocol: "https",
        hostname: "**.logistiq.vn",
        pathname: "/uploads/**",
      },
    ],
    // Optimize for modern formats
    formats: ["image/avif", "image/webp"],
    // Reuse already-optimized PWA icons from /public
    // Device sizes for responsive images
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // Minimum cache TTL for optimized images (60 days)
    minimumCacheTTL: 60 * 60 * 24 * 60,
  },

  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=3600" },
          { key: "Content-Type", value: "application/manifest+json" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default nextConfig;
