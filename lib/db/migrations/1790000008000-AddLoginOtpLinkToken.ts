import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sign-in by link. Each sign-in code now also has a link in its email; only the SHA-256 hash of the
 * link's token is stored. The link shares the code's row, so it has the same 10-minute expiry and
 * using either the code or the link uses up both. Nullable: codes sent before this keep working.
 */
export class AddLoginOtpLinkToken1790000008000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE login_otp ADD COLUMN link_token_hash VARCHAR;`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_login_otp_link_token_hash ON login_otp (link_token_hash);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS uq_login_otp_link_token_hash;`);
    await queryRunner.query(`ALTER TABLE login_otp DROP COLUMN link_token_hash;`);
  }
}
