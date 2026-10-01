import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['node:sqlite'],
  outputFileTracingIncludes: {
    '/**': ['./data/**/*'],
  },
};

export default nextConfig;
