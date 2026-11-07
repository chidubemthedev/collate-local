import "dotenv/config";
import { execSync } from "node:child_process";

/** Loads the test fixture once before the browser tests (empties the test database first). */
export default function globalSetup(): void {
  execSync("npm run db:seed:test", { stdio: "inherit" });
}
