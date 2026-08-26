import type { NextConfig } from "next";
import { assertRequiredEnv } from "./lib/env";

assertRequiredEnv();

/**
 * Supabase Storage host, derived from the project URL rather than hardcoded so
 * local, preview and production each authorise their own instance.
 *
 * `next/image` will only optimise remote images from a host listed here. The
 * `images` bucket went public in migration 017 (see CONSTRAINT-15), which is
 * what makes optimisation possible at all: signed URLs carry a 1-hour token
 * and cannot be edge-cached.
 */
function supabaseImageHost(): string {
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  try {
    return new URL(raw).hostname;
  } catch {
    // assertRequiredEnv only proves the var is present, not that it parses.
    // Fail with the value in hand rather than an opaque "Invalid URL".
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not a valid URL (got: ${JSON.stringify(raw)}). ` +
        `Expected something like https://<project-ref>.supabase.co. ` +
        `See docs/env-checklist.md.`,
    );
  }
}

const supabaseHost = supabaseImageHost();

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: supabaseHost,
        pathname: '/storage/v1/object/public/images/**',
      },
    ],
  },
};

export default nextConfig;
