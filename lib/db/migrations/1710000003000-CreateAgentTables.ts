import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAgentTables1710000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE agent_kind AS ENUM ('official', 'extra');

      CREATE TABLE agent_assignment (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        person_id UUID NOT NULL,
        polling_unit_id INT NOT NULL,
        owner_group_id INT,
        owner_candidate_id INT,
        agent_kind agent_kind NOT NULL,
        slot_number SMALLINT NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_agent_assignment_person FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE RESTRICT,
        CONSTRAINT fk_agent_assignment_polling_unit FOREIGN KEY (polling_unit_id) REFERENCES polling_unit (id) ON DELETE RESTRICT,
        CONSTRAINT fk_agent_assignment_owner_group FOREIGN KEY (owner_group_id) REFERENCES groups (id) ON DELETE SET NULL,
        CONSTRAINT fk_agent_assignment_owner_candidate FOREIGN KEY (owner_candidate_id) REFERENCES candidate (id) ON DELETE SET NULL,
        CONSTRAINT ck_agent_assignment_owner_xor CHECK ((owner_group_id IS NOT NULL) <> (owner_candidate_id IS NOT NULL)),
        CONSTRAINT ck_agent_assignment_slot CHECK ((agent_kind = 'official' AND slot_number = 0) OR (agent_kind = 'extra' AND slot_number >= 1))
      );

      CREATE INDEX ix_agent_assignment_person_id ON agent_assignment (person_id);
      CREATE INDEX ix_agent_assignment_polling_unit_id ON agent_assignment (polling_unit_id);

      CREATE TABLE audit_log (
        id BIGSERIAL PRIMARY KEY,
        actor_person_id UUID,
        action_type VARCHAR NOT NULL,
        target_entity_type VARCHAR,
        target_entity_id VARCHAR,
        ip_address VARCHAR,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_audit_log_actor_person FOREIGN KEY (actor_person_id) REFERENCES person (id) ON DELETE SET NULL
      );

      CREATE INDEX ix_audit_log_actor_person_id_created_at ON audit_log (actor_person_id, created_at);
      CREATE INDEX ix_audit_log_target_entity ON audit_log (target_entity_type, target_entity_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS audit_log;
      DROP TABLE IF EXISTS agent_assignment;
      DROP TYPE IF EXISTS agent_kind;
    `);
  }
}
