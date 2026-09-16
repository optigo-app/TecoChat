import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["pdfjs-dist"],
  turbopack: {},
  // Production optimizations
  compress: true, // Enable gzip compression for served assets
  poweredByHeader: false, // Remove X-Powered-By header for security + smaller response
  images: {
    // Allow serving SVG brand logos via next/image (brandlogodark.svg etc.)
    dangerouslyAllowSVG: true,
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
