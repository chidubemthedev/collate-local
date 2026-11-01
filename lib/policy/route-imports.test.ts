import { readdir, readFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const apiRoot = resolve(process.cwd(), "app", "api");
const forbiddenImport =
  /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)["'](typeorm|pg|@\/lib\/db(?:\/[^"']*)?)["']/g;
const forbiddenJsonResponse = /\b(?:Response|NextResponse)\s*\.\s*json\s*\(/;

async function findRouteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => findRouteFiles(join(directory, entry.name))),
  );
  const routes = entries
    .filter((entry) => entry.isFile() && entry.name === "route.ts")
    .map((entry) => join(directory, entry.name));
  return [...routes, ...nested.flat()];
}

function isExempt(routePath: string): boolean {
  return ["auth", "health", "dev"].some(
    (segment) => routePath === segment || routePath.startsWith(`${segment}/`),
  );
}

describe("API route imports", () => {
  it("keeps database imports out of non-infrastructure route handlers", async () => {
    const routeFiles = await findRouteFiles(apiRoot);
    const violations: string[] = [];

    for (const routeFile of routeFiles) {
      const routePath = relative(apiRoot, routeFile).replaceAll("\\", "/");
      if (isExempt(routePath.split("/")[0])) {
        continue;
      }

      const source = await readFile(routeFile, "utf8");
      const matches = [...source.matchAll(forbiddenImport)];
      if (matches.length > 0) {
        violations.push(routePath);
      }
    }

    expect(violations).toEqual([]);
  });

  it("uses the shared response helpers instead of raw JSON responses", async () => {
    const routeFiles = await findRouteFiles(apiRoot);
    const violations: string[] = [];

    for (const routeFile of routeFiles) {
      const source = await readFile(routeFile, "utf8");
      if (forbiddenJsonResponse.test(source)) {
        violations.push(relative(apiRoot, routeFile).replaceAll("\\", "/"));
      }
    }

    expect(violations).toEqual([]);
  });
});
