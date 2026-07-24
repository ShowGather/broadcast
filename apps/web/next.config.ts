import type { NextConfig } from "next";

const apiTarget = process.env.API_INTERNAL_URL ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@showgather/player-core",
    "@showgather/player-ui",
    "@showgather/presentation-model",
    "@showgather/event-schema",
    "@showgather/id3",
  ],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
