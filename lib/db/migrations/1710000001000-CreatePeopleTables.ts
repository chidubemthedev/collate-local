import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePeopleTables1710000001000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE verification_status AS ENUM ('unverified', 'verified', 'rejected');

      CREATE TABLE person (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        full_name VARCHAR NOT NULL,
        home_polling_unit_id INT,
        email_address VARCHAR,
        voter_card_number VARCHAR,
        verification_status verification_status NOT NULL DEFAULT 'unverified',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_person_home_polling_unit FOREIGN KEY (home_polling_unit_id) REFERENCES polling_unit (id) ON DELETE SET NULL
      );

      CREATE UNIQUE INDEX uq_person_email_address_lower
        ON person (LOWER(email_address))
        WHERE email_address IS NOT NULL;

      CREATE TABLE phone_number (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL,
        e164_number VARCHAR NOT NULL,
        is_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        telegram_chat_id BIGINT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_phone_number_person FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE,
        CONSTRAINT ck_phone_number_e164 CHECK (e164_number ~ '^\\+[1-9][0-9]{6,14}$'),
        UNIQUE (e164_number),
        UNIQUE (telegram_chat_id)
      );

      CREATE TABLE consent (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL,
        consent_text_version VARCHAR NOT NULL,
        is_accepted BOOLEAN NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_consent_person FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS consent;
      DROP TABLE IF EXISTS phone_number;
      DROP TABLE IF EXISTS person;
      DROP TYPE IF EXISTS verification_status;
    `);
  }
}
