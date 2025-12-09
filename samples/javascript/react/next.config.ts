import type { NextConfig } from "next";
import path from "path";
import { config } from "dotenv";

// Load .env from project root (3 levels up)
config({ path: path.resolve(__dirname, "../../../.env") });

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        bufferutil: false,
        'utf-8-validate': false,
      };
    }
    return config;
  },
};

export default nextConfig;
