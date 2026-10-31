import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  // Keep DB code out of the bundle: TypeORM loads `pg` through its own
  // dynamic require, which bundling loses. Without this, `next build` fails
  // with "Postgres package has not been found installed".
  serverExternalPackages: ["typeorm", "pg"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
