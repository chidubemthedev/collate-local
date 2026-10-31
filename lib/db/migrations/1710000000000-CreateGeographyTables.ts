import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateGeographyTables1710000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE political_unit_type AS ENUM (
        'country',
        'state',
        'senatorial_district',
        'federal_constituency',
        'state_constituency'
      );

      CREATE TABLE state (
        id SERIAL PRIMARY KEY,
        inec_state_code VARCHAR NOT NULL UNIQUE,
        state_name VARCHAR NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE lga (
        id SERIAL PRIMARY KEY,
        state_id INT NOT NULL,
        inec_lga_code VARCHAR NOT NULL,
        lga_name VARCHAR NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (state_id, inec_lga_code),
        CONSTRAINT fk_lga_state FOREIGN KEY (state_id) REFERENCES state (id) ON DELETE RESTRICT
      );

      CREATE TABLE ward (
        id SERIAL PRIMARY KEY,
        lga_id INT NOT NULL,
        inec_ward_code VARCHAR NOT NULL,
        ward_name VARCHAR NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (lga_id, inec_ward_code),
        CONSTRAINT fk_ward_lga FOREIGN KEY (lga_id) REFERENCES lga (id) ON DELETE RESTRICT
      );

      CREATE TABLE polling_unit (
        id SERIAL PRIMARY KEY,
        inec_polling_unit_code VARCHAR NOT NULL UNIQUE,
        polling_unit_name VARCHAR,
        ward_id INT NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        is_position_doubtful BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_polling_unit_ward FOREIGN KEY (ward_id) REFERENCES ward (id) ON DELETE RESTRICT
      );

      CREATE TABLE political_unit (
        id SERIAL PRIMARY KEY,
        political_unit_name VARCHAR NOT NULL,
        political_unit_type political_unit_type NOT NULL,
        parent_political_unit_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_political_unit_parent FOREIGN KEY (parent_political_unit_id) REFERENCES political_unit (id) ON DELETE RESTRICT
      );

      CREATE INDEX ix_political_unit_type_parent
        ON political_unit (political_unit_type, parent_political_unit_id);

      CREATE TABLE pu_political_unit (
        political_unit_id INT NOT NULL,
        polling_unit_id INT NOT NULL,
        PRIMARY KEY (political_unit_id, polling_unit_id),
        CONSTRAINT fk_pu_political_unit_political_unit FOREIGN KEY (political_unit_id) REFERENCES political_unit (id) ON DELETE CASCADE,
        CONSTRAINT fk_pu_political_unit_polling_unit FOREIGN KEY (polling_unit_id) REFERENCES polling_unit (id) ON DELETE CASCADE
      );

      CREATE INDEX ix_pu_political_unit_polling_unit_id
        ON pu_political_unit (polling_unit_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS pu_political_unit;
      DROP TABLE IF EXISTS political_unit;
      DROP TABLE IF EXISTS polling_unit;
      DROP TABLE IF EXISTS ward;
      DROP TABLE IF EXISTS lga;
      DROP TABLE IF EXISTS state;
      DROP TYPE IF EXISTS political_unit_type;
    `);
  }
}
