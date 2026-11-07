import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Settings · Audit log lists entries newest first, a page at a time. Every list view is logged,
 * so the table grows quickly; this index keeps "newest first" from sorting the whole table.
 */
export class AddAuditLogCreatedAtIndex1790000007000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE INDEX ix_audit_log_created_at_id ON audit_log (created_at DESC, id DESC);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_audit_log_created_at_id;`);
  }
}
