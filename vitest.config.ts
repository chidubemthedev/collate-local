import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    // e2e/ holds Playwright specs (npm run test:e2e); .next/ holds build output.
    exclude: [...configDefaults.exclude, "e2e/**", ".next/**"],
  },
});
