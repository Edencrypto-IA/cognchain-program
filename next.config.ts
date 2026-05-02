import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: "standalone", // disabled for Railway — uses custom server.js
  reactStrictMode: true,
  experimental: {
    // @ts-expect-error — disable Turbopack for production builds
    turbopack: false,
  },
  // Railway / production headers
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type,Authorization,X-API-Key" },
        ],
      },
    ];
  },
};

export default nextConfig;
