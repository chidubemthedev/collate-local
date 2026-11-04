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
    // Pin the workspace root to this repo. Otherwise Turbopack walks upwards
    // looking for a lockfile and can land on one outside the repository (e.g.
    // a stray package-lock.json in the user's home directory), which triggers
    // a startup warning and widens file watching. Must be an absolute path.
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      "*.mjs": {
        condition: { query: "?url" },
        type: "asset",
      },
    },
  },
};

export default nextConfig;
