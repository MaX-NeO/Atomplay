import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // enable instrumentation hook (src/instrumentation.ts) to spawn the realtime service
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;
