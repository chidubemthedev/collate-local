import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Indexes for the lookups the API runs on every page. Measured on a copy of the schema loaded
 * with the full INEC list (177k polling units) and about 100k agent assignments:
 *
 * - polling_unit.ward_id: every "polling units in this ward / LGA / state" join. Without it each
 *   LGA or ward list read the whole polling_unit table (ward list 20 ms -> 0.4 ms).
 * - phone_number.person_id, consent (person_id, created_at, id): the phone and consent checks done
 *   for each agent, candidate and broadcast recipient.
 * - agent_assignment owner columns: owner filters, and the foreign keys' ON DELETE checks.
 * - agent_assignment extra agents by polling unit (with person_id): extra-agent counts per area.
 * - membership.group_id, membership_scope_unit.membership_id: loading a user's roles and scope.
 * - delivery (broadcast_id, created_at, id): the deliveries list for a broadcast, newest first.
 *
 * IF NOT EXISTS: some databases may already have an index the entities declare.
 */
export class AddQueryIndexes1790000003000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS ix_polling_unit_ward_id
        ON polling_unit (ward_id);

      CREATE INDEX IF NOT EXISTS ix_phone_number_person_id
        ON phone_number (person_id);

      CREATE INDEX IF NOT EXISTS ix_consent_person_id_created_at
        ON consent (person_id, created_at, id);

      CREATE INDEX IF NOT EXISTS ix_agent_assignment_owner_group_id
        ON agent_assignment (owner_group_id);

      CREATE INDEX IF NOT EXISTS ix_agent_assignment_owner_candidate_id
        ON agent_assignment (owner_candidate_id);

      CREATE INDEX IF NOT EXISTS ix_agent_assignment_extra_polling_unit
        ON agent_assignment (polling_unit_id) INCLUDE (person_id)
        WHERE agent_kind = 'extra';

      CREATE INDEX IF NOT EXISTS ix_membership_group_id
        ON membership (group_id);

      CREATE INDEX IF NOT EXISTS ix_membership_scope_unit_membership_id
        ON membership_scope_unit (membership_id);

      CREATE INDEX IF NOT EXISTS ix_delivery_broadcast_id_created_at
        ON delivery (broadcast_id, created_at, id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS ix_delivery_broadcast_id_created_at;
      DROP INDEX IF EXISTS ix_membership_scope_unit_membership_id;
      DROP INDEX IF EXISTS ix_membership_group_id;
      DROP INDEX IF EXISTS ix_agent_assignment_extra_polling_unit;
      DROP INDEX IF EXISTS ix_agent_assignment_owner_candidate_id;
      DROP INDEX IF EXISTS ix_agent_assignment_owner_group_id;
      DROP INDEX IF EXISTS ix_consent_person_id_created_at;
      DROP INDEX IF EXISTS ix_phone_number_person_id;
      DROP INDEX IF EXISTS ix_polling_unit_ward_id;
    `);
  }
}
