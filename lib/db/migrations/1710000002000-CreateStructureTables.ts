import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateStructureTables1710000002000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE group_type AS ENUM ('party', 'campaign', 'support_group', 'admin');

      CREATE TABLE office (
        id SERIAL PRIMARY KEY,
        office_name VARCHAR NOT NULL UNIQUE,
        hierarchy_level INT NOT NULL,
        political_unit_type political_unit_type NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE election_day (
        id SERIAL PRIMARY KEY,
        election_date DATE NOT NULL UNIQUE,
        election_label VARCHAR,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE election_day_office (
        election_day_id INT NOT NULL,
        office_id INT NOT NULL,
        PRIMARY KEY (election_day_id, office_id),
        CONSTRAINT fk_election_day_office_election_day FOREIGN KEY (election_day_id) REFERENCES election_day (id) ON DELETE CASCADE,
        CONSTRAINT fk_election_day_office_office FOREIGN KEY (office_id) REFERENCES office (id) ON DELETE CASCADE
      );

      CREATE TABLE election_day_off_cycle_state (
        election_day_id INT NOT NULL,
        state_id INT NOT NULL,
        PRIMARY KEY (election_day_id, state_id),
        CONSTRAINT fk_election_day_off_cycle_state_election_day FOREIGN KEY (election_day_id) REFERENCES election_day (id) ON DELETE CASCADE,
        CONSTRAINT fk_election_day_off_cycle_state_state FOREIGN KEY (state_id) REFERENCES state (id) ON DELETE CASCADE
      );

      CREATE TABLE seat (
        id SERIAL PRIMARY KEY,
        office_id INT NOT NULL,
        political_unit_id INT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_seat_office FOREIGN KEY (office_id) REFERENCES office (id) ON DELETE RESTRICT,
        CONSTRAINT fk_seat_political_unit FOREIGN KEY (political_unit_id) REFERENCES political_unit (id) ON DELETE RESTRICT,
        UNIQUE (office_id, political_unit_id)
      );

      CREATE TABLE candidate (
        id SERIAL PRIMARY KEY,
        person_id UUID NOT NULL,
        seat_id INT,
        principal_candidate_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_candidate_person FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE RESTRICT,
        CONSTRAINT fk_candidate_seat FOREIGN KEY (seat_id) REFERENCES seat (id) ON DELETE SET NULL,
        CONSTRAINT fk_candidate_principal FOREIGN KEY (principal_candidate_id) REFERENCES candidate (id) ON DELETE SET NULL,
        CONSTRAINT ck_candidate_principal_self CHECK (principal_candidate_id IS DISTINCT FROM id),
        CONSTRAINT ck_candidate_seat_or_principal CHECK ((seat_id IS NOT NULL) <> (principal_candidate_id IS NOT NULL))
      );

      CREATE INDEX ix_candidate_person_id ON candidate (person_id);
      CREATE INDEX ix_candidate_seat_id ON candidate (seat_id);
      CREATE INDEX ix_candidate_principal_candidate_id ON candidate (principal_candidate_id);

      CREATE TABLE groups (
        id SERIAL PRIMARY KEY,
        group_name VARCHAR NOT NULL,
        group_type group_type NOT NULL,
        parent_group_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_group_parent FOREIGN KEY (parent_group_id) REFERENCES groups (id) ON DELETE SET NULL
      );

      CREATE TABLE membership (
        id SERIAL PRIMARY KEY,
        person_id UUID NOT NULL,
        group_id INT NOT NULL,
        membership_role VARCHAR(50) NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_membership_person FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE CASCADE,
        CONSTRAINT fk_membership_group FOREIGN KEY (group_id) REFERENCES groups (id) ON DELETE CASCADE,
        UNIQUE (person_id, group_id)
      );

      CREATE TABLE membership_scope_unit (
        id SERIAL PRIMARY KEY,
        membership_id INT NOT NULL,
        scope_state_id INT,
        scope_lga_id INT,
        scope_ward_id INT,
        scope_political_unit_id INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_membership_scope_unit_membership FOREIGN KEY (membership_id) REFERENCES membership (id) ON DELETE CASCADE,
        CONSTRAINT fk_membership_scope_unit_state FOREIGN KEY (scope_state_id) REFERENCES state (id) ON DELETE CASCADE,
        CONSTRAINT fk_membership_scope_unit_lga FOREIGN KEY (scope_lga_id) REFERENCES lga (id) ON DELETE CASCADE,
        CONSTRAINT fk_membership_scope_unit_ward FOREIGN KEY (scope_ward_id) REFERENCES ward (id) ON DELETE CASCADE,
        CONSTRAINT fk_membership_scope_unit_political_unit FOREIGN KEY (scope_political_unit_id) REFERENCES political_unit (id) ON DELETE CASCADE,
        CONSTRAINT ck_membership_scope_unit_exactly_one CHECK (num_nonnulls(scope_state_id, scope_lga_id, scope_ward_id, scope_political_unit_id) = 1)
      );

      CREATE TABLE group_visibility_grant (
        viewer_group_id INT NOT NULL,
        owner_group_id INT NOT NULL,
        is_allowed BOOLEAN NOT NULL DEFAULT TRUE,
        PRIMARY KEY (viewer_group_id, owner_group_id),
        CONSTRAINT fk_group_visibility_grant_viewer FOREIGN KEY (viewer_group_id) REFERENCES groups (id) ON DELETE CASCADE,
        CONSTRAINT fk_group_visibility_grant_owner FOREIGN KEY (owner_group_id) REFERENCES groups (id) ON DELETE CASCADE
      );
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS group_visibility_grant;
      DROP TABLE IF EXISTS membership_scope_unit;
      DROP TABLE IF EXISTS membership;
      DROP TABLE IF EXISTS groups;
      DROP TABLE IF EXISTS candidate;
      DROP TABLE IF EXISTS seat;
      DROP TABLE IF EXISTS election_day_off_cycle_state;
      DROP TABLE IF EXISTS election_day_office;
      DROP TABLE IF EXISTS election_day;
      DROP TABLE IF EXISTS office;
      DROP TYPE IF EXISTS group_type;
    `);
  }
}
