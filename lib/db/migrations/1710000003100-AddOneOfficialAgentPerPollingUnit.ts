import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOneOfficialAgentPerPollingUnit1710000003100 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      -- May be replaced by a per-candidate rule depending on the Electoral Act s.42/44 question. Keep this migration separate so it is easy to change.
      CREATE UNIQUE INDEX uq_agent_assignment_official_polling_unit
        ON agent_assignment (polling_unit_id)
        WHERE agent_kind = 'official';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS uq_agent_assignment_official_polling_unit;
    `);
  }
}
