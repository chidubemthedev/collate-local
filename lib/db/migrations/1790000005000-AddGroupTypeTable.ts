import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Group types as a table, each with its own access rules, instead of a fixed list in code.
 *
 *   group_type: the kind of access (Admin, Party, Campaign, Support group, or one an admin adds)
 *     - can_message:    none | agents_they_cover | all_agents
 *     - sees_coverage:  national | own_area (own area = the areas set on each member)
 *     - can_own_agents: whether its groups can own agents
 *   groups.group_type_id points at it (replacing the old group_type enum column).
 *
 * The four built-in types keep a fixed key ("admin", "party", ...) that the code relies on;
 * types an admin creates have no key.
 */
export class AddGroupTypeTable1790000005000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // The old enum is also called group_type, which would clash with the new table's name.
    await queryRunner.query(`ALTER TYPE group_type RENAME TO group_type_legacy;`);

    await queryRunner.query(`CREATE TYPE group_can_message AS ENUM ('none', 'agents_they_cover', 'all_agents');`);
    await queryRunner.query(`CREATE TYPE group_sees_coverage AS ENUM ('national', 'own_area');`);
    await queryRunner.query(`
      CREATE TABLE group_type (
        id SERIAL PRIMARY KEY,
        type_key VARCHAR(40) UNIQUE,
        type_name VARCHAR(80) NOT NULL,
        can_message group_can_message NOT NULL,
        sees_coverage group_sees_coverage NOT NULL,
        can_own_agents BOOLEAN NOT NULL DEFAULT TRUE,
        is_system BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_group_type_name ON group_type (LOWER(type_name));`);
    await queryRunner.query(`
      INSERT INTO group_type (type_key, type_name, can_message, sees_coverage, can_own_agents, is_system)
      VALUES
        ('admin', 'Admin', 'all_agents', 'national', FALSE, TRUE),
        ('party', 'Party', 'agents_they_cover', 'national', TRUE, TRUE),
        ('campaign', 'Campaign', 'agents_they_cover', 'own_area', TRUE, TRUE),
        ('support_group', 'Support group', 'none', 'own_area', TRUE, TRUE);
    `);

    await queryRunner.query(`ALTER TABLE groups ADD COLUMN group_type_id INT;`);
    await queryRunner.query(`
      UPDATE groups g
      SET group_type_id = t.id
      FROM group_type t
      WHERE t.type_key = g.group_type::text;
    `);
    await queryRunner.query(`ALTER TABLE groups ALTER COLUMN group_type_id SET NOT NULL;`);
    await queryRunner.query(`
      ALTER TABLE groups
        ADD CONSTRAINT fk_groups_group_type FOREIGN KEY (group_type_id) REFERENCES group_type (id) ON DELETE RESTRICT;
    `);
    await queryRunner.query(`CREATE INDEX ix_groups_group_type_id ON groups (group_type_id);`);

    await queryRunner.query(`ALTER TABLE groups DROP COLUMN group_type;`);
    await queryRunner.query(`DROP TYPE group_type_legacy;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE group_type_legacy AS ENUM ('party', 'campaign', 'support_group', 'admin');`);
    await queryRunner.query(`ALTER TABLE groups ADD COLUMN group_type group_type_legacy;`);
    // Types an admin created have no old equivalent: national ones become party, others campaign.
    await queryRunner.query(`
      UPDATE groups g
      SET group_type = (
        COALESCE(t.type_key, CASE WHEN t.sees_coverage = 'national' THEN 'party' ELSE 'campaign' END)
      )::group_type_legacy
      FROM group_type t
      WHERE t.id = g.group_type_id;
    `);
    await queryRunner.query(`ALTER TABLE groups ALTER COLUMN group_type SET NOT NULL;`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_groups_group_type_id;`);
    await queryRunner.query(`ALTER TABLE groups DROP CONSTRAINT IF EXISTS fk_groups_group_type;`);
    await queryRunner.query(`ALTER TABLE groups DROP COLUMN group_type_id;`);
    await queryRunner.query(`DROP TABLE group_type;`);
    await queryRunner.query(`DROP TYPE group_sees_coverage;`);
    await queryRunner.query(`DROP TYPE group_can_message;`);
    await queryRunner.query(`ALTER TYPE group_type_legacy RENAME TO group_type;`);
  }
}
