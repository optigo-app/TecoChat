import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["pdfjs-dist"],
  turbopack: {},
  output: "standalone",
  compiler: {
    removeConsole: { exclude: ["error", "warn"] },
  },
  // Production optimizations
  compress: true,
  poweredByHeader: false,
  images: {
    dangerouslyAllowSVG: true,
  },
  webpack: (config) => {
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
