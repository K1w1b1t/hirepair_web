import type { NextConfig } from 'next';
import { withPostHogConfig } from '@posthog/nextjs-config';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.module.rules.push({
      test: /pdf\.worker\.mjs$/,
      type: 'asset/resource',
    });
    return config;
  },
};

const sourceMapsEnabled = Boolean(process.env.POSTHOG_API_KEY && process.env.POSTHOG_PROJECT_ID);

export default sourceMapsEnabled
  ? withPostHogConfig(nextConfig, {
      personalApiKey: process.env.POSTHOG_API_KEY!,
      envId: process.env.POSTHOG_PROJECT_ID!,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      sourcemaps: { enabled: true, project: 'hirepair-web', deleteAfterUpload: true },
    })
  : nextConfig;
