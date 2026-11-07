import "dotenv/config";
import type { DataSource, QueryRunner } from "typeorm";
import { assertDemoSeedAllowed } from "./utils";

const DELETE_CHUNK_SIZE = 10_000;

async function deleteInChunks(
  queryRunner: QueryRunner,
  table: string,
  condition: string,
): Promise<void> {
  for (;;) {
    const rows = (await queryRunner.query(`
      WITH deleted AS (
        DELETE FROM ${table}
        WHERE ctid IN (SELECT ctid FROM ${table} WHERE ${condition} LIMIT ${DELETE_CHUNK_SIZE})
        RETURNING 1
      )
      SELECT COUNT(*)::int AS count FROM deleted;
    `)) as Array<{ count: number | string }>;
    if (Number(rows[0]?.count ?? 0) === 0) break;
  }
}

export async function ensureDemoDataDoesNotExist(dataSource: DataSource): Promise<boolean> {
  const result = await dataSource.query(`
    SELECT EXISTS (
      SELECT 1 FROM person WHERE email_address LIKE '%@demo.collate.test'
      UNION ALL
      SELECT 1 FROM state WHERE inec_state_code IN ('90', '91', '92')
      UNION ALL
      SELECT 1 FROM groups WHERE group_name IN (
        'Collate Admins', 'NDC', 'NDC Lagos', 'NDC Anambra', 'NDC Kano',
        'Party Presidential Campaign', 'Independent Presidential Campaign',
        'Obedient Movement', 'Kwankwasiyya', 'OK Movement',
        'Obedient Movement Youth Wing', 'Obedient Movement Ward Coordinators'
      )
    ) AS exists;
  `) as Array<{ exists: boolean }>;
  return Boolean(result[0]?.exists);
}

export async function resetDemoData(dataSource: DataSource): Promise<{ deleted_count: number; trigger_enabled: boolean }> {
  assertDemoSeedAllowed();

  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(`ALTER TABLE audit_log DISABLE TRIGGER audit_log_append_only;`);
      await queryRunner.query(`
        CREATE TEMP TABLE demo_reset_person_ids ON COMMIT DROP AS
        SELECT DISTINCT person.id
        FROM person
        WHERE person.email_address LIKE '%@demo.collate.test'
           OR (
             EXISTS (
               SELECT 1 FROM phone_number
               WHERE phone_number.person_id = person.id
                 AND phone_number.e164_number LIKE '+234000000%'
             )
             AND EXISTS (
               SELECT 1 FROM agent_assignment
               WHERE agent_assignment.person_id = person.id
             )
           );
        CREATE TEMP TABLE demo_reset_political_unit_ids ON COMMIT DROP AS
        SELECT DISTINCT mapping.political_unit_id AS id
        FROM pu_political_unit mapping
        JOIN polling_unit demo_unit ON demo_unit.id = mapping.polling_unit_id
        WHERE (
          demo_unit.inec_polling_unit_code LIKE '90-%'
          OR demo_unit.inec_polling_unit_code LIKE '91-%'
          OR demo_unit.inec_polling_unit_code LIKE '92-%'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM pu_political_unit real_mapping
          JOIN polling_unit real_unit ON real_unit.id = real_mapping.polling_unit_id
          WHERE real_mapping.political_unit_id = mapping.political_unit_id
            AND real_unit.inec_polling_unit_code NOT LIKE '90-%'
            AND real_unit.inec_polling_unit_code NOT LIKE '91-%'
            AND real_unit.inec_polling_unit_code NOT LIKE '92-%'
        );
      `);

      await deleteInChunks(queryRunner, "delivery", "person_id IN (SELECT id FROM demo_reset_person_ids)");
      await deleteInChunks(
        queryRunner,
        "audit_log",
        `(ip_address LIKE '203.0.113.%'
          OR actor_person_id IN (SELECT id FROM demo_reset_person_ids)
          OR (
            target_entity_type = 'agent_assignment'
            AND target_entity_id IN (
              SELECT assignment.id::text FROM agent_assignment assignment
              WHERE assignment.person_id IN (SELECT id FROM demo_reset_person_ids)
            )
          ))`,
      );
      await deleteInChunks(queryRunner, "agent_assignment", "person_id IN (SELECT id FROM demo_reset_person_ids)");
      await deleteInChunks(queryRunner, "consent", "person_id IN (SELECT id FROM demo_reset_person_ids)");
      await deleteInChunks(queryRunner, "phone_number", "person_id IN (SELECT id FROM demo_reset_person_ids)");

      await queryRunner.query(`
        DELETE FROM broadcast WHERE sender_person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test');
        DELETE FROM invite_access_link WHERE candidate_id IN (SELECT c.id FROM candidate c JOIN person p ON p.id = c.person_id WHERE p.email_address LIKE '%@demo.collate.test');
        DELETE FROM import_batch WHERE uploader_person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test');
        DELETE FROM coverage_count WHERE owner_group_id IN (SELECT id FROM groups WHERE group_name IN ('Collate Admins', 'NDC', 'NDC Lagos', 'NDC Anambra', 'NDC Kano', 'Party Presidential Campaign', 'Independent Presidential Campaign', 'Obedient Movement', 'Kwankwasiyya', 'OK Movement', 'Obedient Movement Youth Wing', 'Obedient Movement Ward Coordinators'));
        DELETE FROM group_visibility_grant WHERE viewer_group_id IN (SELECT id FROM groups WHERE group_name IN ('Collate Admins', 'NDC', 'NDC Lagos', 'NDC Anambra', 'NDC Kano', 'Party Presidential Campaign', 'Independent Presidential Campaign', 'Obedient Movement', 'Kwankwasiyya', 'OK Movement', 'Obedient Movement Youth Wing', 'Obedient Movement Ward Coordinators')) OR owner_group_id IN (SELECT id FROM groups WHERE group_name IN ('Collate Admins', 'NDC', 'NDC Lagos', 'NDC Anambra', 'NDC Kano', 'Party Presidential Campaign', 'Independent Presidential Campaign', 'Obedient Movement', 'Kwankwasiyya', 'OK Movement', 'Obedient Movement Youth Wing', 'Obedient Movement Ward Coordinators'));
        DELETE FROM membership_scope_unit WHERE membership_id IN (SELECT m.id FROM membership m JOIN person p ON p.id = m.person_id WHERE p.email_address LIKE '%@demo.collate.test');
        DELETE FROM membership WHERE person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test');
        DELETE FROM candidate WHERE person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test');
        DELETE FROM pu_political_unit WHERE polling_unit_id IN (
          SELECT id FROM polling_unit WHERE inec_polling_unit_code LIKE '90-%' OR inec_polling_unit_code LIKE '91-%' OR inec_polling_unit_code LIKE '92-%'
        );
        DELETE FROM seat WHERE political_unit_id IN (
          SELECT id FROM demo_reset_political_unit_ids
        );
        DELETE FROM polling_unit WHERE inec_polling_unit_code LIKE '90-%' OR inec_polling_unit_code LIKE '91-%' OR inec_polling_unit_code LIKE '92-%';
        DELETE FROM political_unit
        WHERE id IN (SELECT id FROM demo_reset_political_unit_ids)
          AND NOT EXISTS (
            SELECT 1 FROM political_unit child
            WHERE child.parent_political_unit_id = political_unit.id
          );
        DELETE FROM ward WHERE lga_id IN (
          SELECT id FROM lga WHERE state_id IN (SELECT id FROM state WHERE inec_state_code IN ('90', '91', '92'))
        );
        DELETE FROM lga WHERE state_id IN (SELECT id FROM state WHERE inec_state_code IN ('90', '91', '92'));
        DELETE FROM state WHERE inec_state_code IN ('90', '91', '92');
        DELETE FROM groups WHERE group_name IN ('Collate Admins', 'NDC', 'NDC Lagos', 'NDC Anambra', 'NDC Kano', 'Party Presidential Campaign', 'Independent Presidential Campaign', 'Obedient Movement', 'Kwankwasiyya', 'OK Movement', 'Obedient Movement Youth Wing', 'Obedient Movement Ward Coordinators');
      `);

      await deleteInChunks(queryRunner, "person", "id IN (SELECT id FROM demo_reset_person_ids)");

      for (;;) {
        const deletedRows = (await queryRunner.query(`
          WITH deleted AS (
            DELETE FROM political_unit
            WHERE id IN (SELECT id FROM demo_reset_political_unit_ids)
              AND NOT EXISTS (
                SELECT 1 FROM political_unit child
                WHERE child.parent_political_unit_id = political_unit.id
              )
            RETURNING id
          )
          SELECT COUNT(*)::int AS count FROM deleted;
        `)) as Array<{ count: number | string }>;
        if (Number(deletedRows[0]?.count ?? 0) === 0) break;
      }

      await queryRunner.query(`ALTER TABLE audit_log ENABLE TRIGGER audit_log_append_only;`);

      const triggerState = await queryRunner.query(`
        SELECT tgenabled
        FROM pg_trigger
        WHERE tgrelid = 'audit_log'::regclass
          AND tgname = 'audit_log_append_only';
      `) as Array<{ tgenabled: string }>;
      const triggerEnabled = Boolean(triggerState[0]) && triggerState[0].tgenabled !== "D";
      if (!triggerEnabled) {
        throw new Error("audit_log append-only trigger is not enabled");
      }

      await queryRunner.commitTransaction();
      return { deleted_count: 0, trigger_enabled: true };
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
      const result = await resetDemoData(source.default);
      console.log(JSON.stringify(result));
    } finally {
      await source.default.destroy();
    }
  })();
}
