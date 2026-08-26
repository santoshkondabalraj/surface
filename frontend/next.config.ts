import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Prevent Turbopack from walking up to D:\Tastemaker_bot due to the
    // mcp_server package-lock.json, which caused the slow filesystem warning
    root: __dirname,
  },
};

export default nextConfig;
