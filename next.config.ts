import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // "output: standalone" removed for Vercel deployment (Vercel manages output)
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the sandbox preview host (preview-<chat_id>.space-z.ai) to load
  // cross-origin dev resources (chunks, HMR) in development.
  allowedDevOrigins: [
    "all"
  ],
};

export default nextConfig;
