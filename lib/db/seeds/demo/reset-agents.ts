import "dotenv/config";
import type { DataSource, QueryRunner } from "typeorm";
import { assertDemoSeedAllowed } from "./utils";

const DELETE_CHUNK_SIZE = 10_000;

async function deleteInChunks(
  queryRunner: QueryRunner,
  table: string,
  condition: string,
): Promise<number> {
  let total = 0;
  for (;;) {
    const rows = (await queryRunner.query(`
      WITH deleted AS (
        DELETE FROM ${table}
        WHERE ctid IN (SELECT ctid FROM ${table} WHERE ${condition} LIMIT ${DELETE_CHUNK_SIZE})
        RETURNING 1
      )
      SELECT COUNT(*)::int AS count FROM deleted;
    `)) as Array<{ count: number | string }>;
    const count = Number(rows[0]?.count ?? 0);
    if (count === 0) break;
    total += count;
  }
  return total;
}

// Removes only seeded demo agents: people with a +234000000 phone and an agent
// assignment (or an agent.N@demo.collate.test email), never admins, candidates or members.
export async function resetDemoAgents(
  dataSource: DataSource,
): Promise<{ agent_assignments: number; people: number }> {
  assertDemoSeedAllowed();

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`
        CREATE TEMP TABLE demo_agent_reset_person_ids ON COMMIT DROP AS
        SELECT DISTINCT person.id
        FROM person
        WHERE EXISTS (
            SELECT 1 FROM agent_assignment aa WHERE aa.person_id = person.id
          )
          AND (
            person.email_address LIKE 'agent.%@demo.collate.test'
            OR EXISTS (
              SELECT 1 FROM phone_number pn
              WHERE pn.person_id = person.id
                AND pn.e164_number LIKE '+234000000%'
            )
          )
          AND NOT EXISTS (SELECT 1 FROM membership m WHERE m.person_id = person.id)
          AND NOT EXISTS (SELECT 1 FROM candidate c WHERE c.person_id = person.id);
      `);

      const condition = "person_id IN (SELECT id FROM demo_agent_reset_person_ids)";
      await deleteInChunks(queryRunner, "delivery", condition);
      const assignments = await deleteInChunks(queryRunner, "agent_assignment", condition);
      await deleteInChunks(queryRunner, "consent", condition);
      await deleteInChunks(queryRunner, "phone_number", condition);
      const people = await deleteInChunks(
        queryRunner,
        "person",
        "id IN (SELECT id FROM demo_agent_reset_person_ids)",
      );

      await queryRunner.commitTransaction();
      return { agent_assignments: assignments, people };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      throw error;
    }
  } finally {
    await queryRunner.release();
  }
}

if (require.main === module) {
  void (async () => {
    assertDemoSeedAllowed();
    const source = await import("../../data-source");
    await source.default.initialize();
    try {
      const result = await resetDemoAgents(source.default);
      console.log(JSON.stringify(result));
    } finally {
      await source.default.destroy();
    }
  })();
}
