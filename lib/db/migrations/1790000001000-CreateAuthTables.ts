import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAuthTables1790000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE login_otp (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL,
        code_hash VARCHAR NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        consumed_at TIMESTAMPTZ,
        failed_attempt_count INTEGER NOT NULL DEFAULT 0,
        requested_from_ip VARCHAR,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_login_otp_person FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE
      );

      CREATE INDEX ix_login_otp_person_id_created_at
        ON login_otp (person_id, created_at);

      CREATE TABLE auth_session (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL,
        session_token_hash VARCHAR NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        last_active_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ,
        created_from_ip VARCHAR,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_auth_session_person FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE
      );

      CREATE INDEX ix_auth_session_person_id
        ON auth_session (person_id);

      CREATE TABLE auth_rate_limit (
        id BIGSERIAL PRIMARY KEY,
        bucket_key VARCHAR NOT NULL,
        window_started_at TIMESTAMPTZ NOT NULL,
        hit_count INTEGER NOT NULL DEFAULT 0,
        CONSTRAINT uq_auth_rate_limit_bucket_window UNIQUE (bucket_key, window_started_at)
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS auth_rate_limit;
      DROP TABLE IF EXISTS auth_session;
      DROP TABLE IF EXISTS login_otp;
    `);
  }
}
