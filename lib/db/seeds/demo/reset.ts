import "dotenv/config";
import type { DataSource } from "typeorm";
import { assertDemoSeedAllowed } from "./utils";

export async function ensureDemoDataDoesNotExist(dataSource: DataSource): Promise<boolean> {
  const result = await dataSource.query(`
    SELECT EXISTS (
      SELECT 1 FROM person WHERE email_address LIKE '%@demo.collate.test%'
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
        DELETE FROM delivery WHERE person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%');
        DELETE FROM broadcast WHERE sender_person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%');
        DELETE FROM access_link WHERE candidate_id IN (SELECT c.id FROM candidate c JOIN person p ON p.id = c.person_id WHERE p.email_address LIKE '%@demo.collate.test%');
        DELETE FROM import_batch WHERE uploader_person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%');
        DELETE FROM coverage_count WHERE owner_group_id IN (SELECT id FROM groups WHERE group_name IN ('Collate Admins', 'NDC', 'NDC Lagos', 'NDC Anambra', 'NDC Kano', 'Party Presidential Campaign', 'Independent Presidential Campaign', 'Obedient Movement', 'Kwankwasiyya', 'OK Movement', 'Obedient Movement Youth Wing', 'Obedient Movement Ward Coordinators'));
        DELETE FROM audit_log
        WHERE ip_address LIKE '203.0.113.%'
          OR actor_person_id IN (
            SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%'
          );
        DELETE FROM agent_assignment WHERE person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%');
        DELETE FROM group_visibility_grant WHERE viewer_group_id IN (SELECT id FROM groups WHERE group_name IN ('Collate Admins', 'NDC', 'NDC Lagos', 'NDC Anambra', 'NDC Kano', 'Party Presidential Campaign', 'Independent Presidential Campaign', 'Obedient Movement', 'Kwankwasiyya', 'OK Movement', 'Obedient Movement Youth Wing', 'Obedient Movement Ward Coordinators')) OR owner_group_id IN (SELECT id FROM groups WHERE group_name IN ('Collate Admins', 'NDC', 'NDC Lagos', 'NDC Anambra', 'NDC Kano', 'Party Presidential Campaign', 'Independent Presidential Campaign', 'Obedient Movement', 'Kwankwasiyya', 'OK Movement', 'Obedient Movement Youth Wing', 'Obedient Movement Ward Coordinators'));
        DELETE FROM membership_scope_unit WHERE membership_id IN (SELECT m.id FROM membership m JOIN person p ON p.id = m.person_id WHERE p.email_address LIKE '%@demo.collate.test%');
        DELETE FROM membership WHERE person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%');
        DELETE FROM candidate WHERE person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%');
        DELETE FROM consent WHERE person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%');
        DELETE FROM phone_number WHERE person_id IN (SELECT id FROM person WHERE email_address LIKE '%@demo.collate.test%');
        DELETE FROM pu_political_unit WHERE polling_unit_id IN (
          SELECT id FROM polling_unit WHERE inec_polling_unit_code LIKE '90-%' OR inec_polling_unit_code LIKE '91-%' OR inec_polling_unit_code LIKE '92-%'
        );
        DELETE FROM political_unit WHERE political_unit_name IN (
          'Nigeria', 'Lagos', 'Anambra', 'Kano',
          'Lagos Senatorial District 1', 'Lagos Senatorial District 2', 'Lagos Senatorial District 3',
          'Anambra Senatorial District 1', 'Anambra Senatorial District 2', 'Anambra Senatorial District 3',
          'Kano Senatorial District 1', 'Kano Senatorial District 2', 'Kano Senatorial District 3',
          'Lagos Federal Constituency 1', 'Lagos Federal Constituency 2',
          'Anambra Federal Constituency 1', 'Anambra Federal Constituency 2',
          'Kano Federal Constituency 1', 'Kano Federal Constituency 2',
          'Lagos State Constituency 1', 'Lagos State Constituency 2', 'Lagos State Constituency 3',
          'Anambra State Constituency 1', 'Anambra State Constituency 2', 'Anambra State Constituency 3',
          'Kano State Constituency 1', 'Kano State Constituency 2', 'Kano State Constituency 3'
        );
        DELETE FROM polling_unit WHERE inec_polling_unit_code LIKE '90-%' OR inec_polling_unit_code LIKE '91-%' OR inec_polling_unit_code LIKE '92-%';
        DELETE FROM ward WHERE lga_id IN (
          SELECT id FROM lga WHERE state_id IN (SELECT id FROM state WHERE inec_state_code IN ('90', '91', '92'))
        );
        DELETE FROM lga WHERE state_id IN (SELECT id FROM state WHERE inec_state_code IN ('90', '91', '92'));
        DELETE FROM state WHERE inec_state_code IN ('90', '91', '92');
        DELETE FROM person WHERE email_address LIKE '%@demo.collate.test%';
        DELETE FROM groups WHERE group_name IN ('Collate Admins', 'NDC', 'NDC Lagos', 'NDC Anambra', 'NDC Kano', 'Party Presidential Campaign', 'Independent Presidential Campaign', 'Obedient Movement', 'Kwankwasiyya', 'OK Movement', 'Obedient Movement Youth Wing', 'Obedient Movement Ward Coordinators');
      `);

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
