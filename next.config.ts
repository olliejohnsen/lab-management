import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["node-ssh", "ssh2", "dockerode"],
};

export default nextConfig;
