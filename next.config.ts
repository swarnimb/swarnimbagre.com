import type { NextConfig } from "next";
import { assertRequiredEnv } from "./lib/env";

assertRequiredEnv();

const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
