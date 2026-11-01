import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["app/api/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "Response",
          property: "json",
          message: "API routes must return envelopes from lib/api/response.",
        },
        {
          object: "NextResponse",
          property: "json",
          message: "API routes must return envelopes from lib/api/response.",
        },
      ],
    },
  },
  {
    files: ["app/api/**/*.ts"],
    // Auth owns its tables; health and dev routes are infrastructure endpoints.
    ignores: ["app/api/auth/**", "app/api/health/**", "app/api/dev/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "typeorm", message: "API routes must read through lib/policy." },
            { name: "pg", message: "API routes must read through lib/policy." },
          ],
          patterns: ["@/lib/db", "@/lib/db/*", "@/lib/db/**"],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
