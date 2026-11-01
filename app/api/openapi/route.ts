import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { connection } from "next/server";

export async function GET() {
  await connection();

  const specification = await readFile(join(process.cwd(), "public", "openapi.yaml"), "utf8");
  const serverBaseUrl = process.env.SERVER_BASE_URL?.trim() || "/";
  const configuredSpecification = specification.replace(
    /^  - url:.*$/m,
    `  - url: ${JSON.stringify(serverBaseUrl)}`,
  );

  return new Response(configuredSpecification, {
    headers: {
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
