import "dotenv/config";
import { Client } from "pg";
import { assertTestDatabase, resetTestDatabase, seedTestFixture } from "./fixture";

/**
 * `npm run db:seed:test` — empties the test database and loads the fixed test fixture
 * (the "Personas" and "Fixture data" tabs of the test script). Refuses to run against
 * production or a database whose name does not contain "test".
 */
async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  assertTestDatabase(databaseUrl);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  });
  await client.connect();
  try {
    const db = {
      query: async <T>(sql: string, parameters?: unknown[]) =>
        (await client.query(sql, parameters as unknown[])).rows as T,
    };
    await client.query("BEGIN");
    await resetTestDatabase(db);
    const fixture = await seedTestFixture(db);
    await client.query("COMMIT");
    console.log(
      `Test fixture loaded: ${Object.keys(fixture.pollingUnitIds).length} polling units, ` +
        `${Object.keys(fixture.personIds).length} people.`,
    );
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
