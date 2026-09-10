import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silence firebase/undici warnings during build
  serverExternalPackages: [],
};

export default nextConfig;
