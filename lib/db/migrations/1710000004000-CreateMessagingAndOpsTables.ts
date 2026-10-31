import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateMessagingAndOpsTables1710000004000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE broadcast_status AS ENUM ('draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled');
      CREATE TYPE delivery_channel AS ENUM ('telegram', 'sms');
      CREATE TYPE delivery_status AS ENUM ('pending', 'sent', 'delivered', 'delivered_by_sms', 'failed', 'tapped_ok');
      CREATE TYPE coverage_kind AS ENUM ('headline', 'group');

      CREATE TABLE broadcast (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        sender_person_id UUID NOT NULL,
        audience_filter JSONB NOT NULL,
        message_text TEXT NOT NULL,
        scheduled_send_at TIMESTAMPTZ,
        broadcast_status broadcast_status NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_broadcast_sender_person FOREIGN KEY (sender_person_id) REFERENCES person (id) ON DELETE RESTRICT
      );

      CREATE TABLE delivery (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        broadcast_id UUID NOT NULL,
        person_id UUID NOT NULL,
        delivery_channel delivery_channel NOT NULL,
        delivery_status delivery_status NOT NULL DEFAULT 'pending',
        sent_at TIMESTAMPTZ,
        delivered_at TIMESTAMPTZ,
        tapped_ok_at TIMESTAMPTZ,
        failed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_delivery_broadcast FOREIGN KEY (broadcast_id) REFERENCES broadcast (id) ON DELETE CASCADE,
        CONSTRAINT fk_delivery_person FOREIGN KEY (person_id) REFERENCES person (id) ON DELETE RESTRICT,
        UNIQUE (broadcast_id, person_id)
      );

      CREATE INDEX ix_delivery_broadcast_id ON delivery (broadcast_id);
      CREATE INDEX ix_delivery_person_id ON delivery (person_id);

      CREATE TABLE access_link (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        candidate_id INT NOT NULL,
        token_hash VARCHAR NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_access_link_candidate FOREIGN KEY (candidate_id) REFERENCES candidate (id) ON DELETE RESTRICT
      );

      CREATE TABLE import_batch (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        file_name VARCHAR NOT NULL,
        uploader_person_id UUID NOT NULL,
        total_row_count INT NOT NULL DEFAULT 0,
        imported_row_count INT NOT NULL DEFAULT 0,
        error_row_count INT NOT NULL DEFAULT 0,
        error_details JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_import_batch_uploader_person FOREIGN KEY (uploader_person_id) REFERENCES person (id) ON DELETE RESTRICT
      );

      CREATE TABLE coverage_count (
        id BIGSERIAL PRIMARY KEY,
        unit_state_id INT,
        unit_lga_id INT,
        unit_ward_id INT,
        unit_political_unit_id INT,
        owner_group_id INT,
        owner_candidate_id INT,
        coverage_kind coverage_kind NOT NULL,
        covered_polling_unit_count INT NOT NULL,
        total_polling_unit_count INT NOT NULL,
        refreshed_at TIMESTAMPTZ NOT NULL,
        CONSTRAINT fk_coverage_count_unit_state FOREIGN KEY (unit_state_id) REFERENCES state (id) ON DELETE CASCADE,
        CONSTRAINT fk_coverage_count_unit_lga FOREIGN KEY (unit_lga_id) REFERENCES lga (id) ON DELETE CASCADE,
        CONSTRAINT fk_coverage_count_unit_ward FOREIGN KEY (unit_ward_id) REFERENCES ward (id) ON DELETE CASCADE,
        CONSTRAINT fk_coverage_count_unit_political_unit FOREIGN KEY (unit_political_unit_id) REFERENCES political_unit (id) ON DELETE CASCADE,
        CONSTRAINT fk_coverage_count_owner_group FOREIGN KEY (owner_group_id) REFERENCES groups (id) ON DELETE CASCADE,
        CONSTRAINT fk_coverage_count_owner_candidate FOREIGN KEY (owner_candidate_id) REFERENCES candidate (id) ON DELETE CASCADE,
        CONSTRAINT ck_coverage_count_scope CHECK (num_nonnulls(unit_state_id, unit_lga_id, unit_ward_id, unit_political_unit_id) = 1),
        CONSTRAINT ck_coverage_count_counts CHECK (covered_polling_unit_count <= total_polling_unit_count)
      );

      CREATE UNIQUE INDEX uq_coverage_count_scope_owner_kind
        ON coverage_count (unit_state_id, unit_lga_id, unit_ward_id, unit_political_unit_id, owner_group_id, owner_candidate_id, coverage_kind)
        NULLS NOT DISTINCT;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP TABLE IF EXISTS coverage_count;
      DROP TABLE IF EXISTS import_batch;
      DROP TABLE IF EXISTS access_link;
      DROP TABLE IF EXISTS delivery;
      DROP TABLE IF EXISTS broadcast;
      DROP TYPE IF EXISTS coverage_kind;
      DROP TYPE IF EXISTS delivery_status;
      DROP TYPE IF EXISTS delivery_channel;
      DROP TYPE IF EXISTS broadcast_status;
    `);
  }
}
