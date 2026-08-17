import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // Allow the sandbox preview host (preview-<chat_id>.space-z.ai) to load
  // cross-origin dev resources (chunks, HMR) in development.
  allowedDevOrigins: [
    ".space-z.ai",
    "preview-chat-e9b5e055-a409-4142-bdeb-6aef1c2abe96.space-z.ai",
  ],
};

export default nextConfig;
