import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: { allowedOrigins: ["localhost:3000"] },
    optimizePackageImports: [
      "framer-motion",
      "@solana/wallet-adapter-react",
      "@solana/wallet-adapter-react-ui",
      "sonner",
    ],
  },
  transpilePackages: ["@jarfi/sdk"],
  images: {
    // Runs on Cloudflare Workers via @opennextjs/cloudflare —
    // skip Next's built-in optimizer (no sharp on Workers).
    unoptimized: true,
  },
};

export default config;
