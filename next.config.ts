import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  env: {
    PRISMA_CLIENT_ENGINE_TYPE: "library",
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "www.nilavm.com",
      },
      {
        protocol: "https",
        hostname: "nilavm.com",
      },
      {
        protocol: "https",
        hostname: "www.detayresimler.com",
      },
      {
        protocol: "https",
        hostname: "detayresimler.com",
      },
    ],
  },
};

export default nextConfig;
