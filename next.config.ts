import type { NextConfig } from "next";

const devHost = process.env.DEV_HOST?.trim();
const allowedDevOrigins = ["127.0.0.1", "localhost"];
if (devHost) {
  allowedDevOrigins.push(devHost);
}

const nextConfig: NextConfig = {
  allowedDevOrigins,
};

export default nextConfig;
