import dataSource from "../lib/db/data-source";

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    const rows = (await dataSource.query(
      "SELECT COUNT(*)::int AS count FROM polling_unit",
    )) as Array<{ count: number | string }>;
    if (rows.length !== 1) {
      throw new Error("Polling unit count query returned an unexpected result.");
    }

    console.log(JSON.stringify({ pollingUnits: Number(rows[0].count) }));
  } finally {
    await dataSource.destroy();
  }
}

void main();
