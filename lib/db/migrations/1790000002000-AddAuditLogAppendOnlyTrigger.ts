import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAuditLogAppendOnlyTrigger1790000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE FUNCTION prevent_audit_log_mutation()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'audit_log is append-only';
      END;
      $$;

      CREATE TRIGGER audit_log_append_only
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW
      EXECUTE FUNCTION prevent_audit_log_mutation();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS audit_log_append_only ON audit_log;
      DROP FUNCTION IF EXISTS prevent_audit_log_mutation();
    `);
  }
}
