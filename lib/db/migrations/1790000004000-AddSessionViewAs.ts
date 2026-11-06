import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * "View as": the narrower access a signed-in person is previewing, kept on their session so it
 * lasts across pages and refreshes until they exit or sign out. Null = their own access.
 * Shape: { kind: "party" } | { kind: "seat", seatId, unitId, unitType, label }.
 */
export class AddSessionViewAs1790000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE auth_session ADD COLUMN IF NOT EXISTS view_as JSONB;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE auth_session DROP COLUMN IF EXISTS view_as;`);
  }
}
