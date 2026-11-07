import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Candidate invites. The unused access_link table becomes invite_access_link: an admin enters a
 * candidate's email, the app emails a single-use link (only its hash is kept), and the candidate
 * completes registration from it.
 *
 *   email_address:        where the invite went; saved on the candidate only when they complete it
 *   accepted_at:          when they completed registration (the link is then used up)
 *   invited_by_person_id: the admin who sent it
 *
 * No API used access_link, so any rows in it are leftovers: they get the candidate's own email if
 * they have one, and rows with no email are removed (the column is required from now on).
 */
export class RenameAccessLinkToInviteAccessLink1790000006000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE access_link RENAME TO invite_access_link;`);
    await queryRunner.query(`ALTER TABLE invite_access_link RENAME CONSTRAINT access_link_pkey TO invite_access_link_pkey;`);
    await queryRunner.query(
      `ALTER TABLE invite_access_link RENAME CONSTRAINT access_link_token_hash_key TO invite_access_link_token_hash_key;`,
    );
    await queryRunner.query(
      `ALTER TABLE invite_access_link RENAME CONSTRAINT fk_access_link_candidate TO fk_invite_access_link_candidate;`,
    );

    await queryRunner.query(`
      ALTER TABLE invite_access_link
        ADD COLUMN email_address VARCHAR,
        ADD COLUMN accepted_at TIMESTAMPTZ,
        ADD COLUMN invited_by_person_id UUID;
    `);
    await queryRunner.query(`
      UPDATE invite_access_link link
      SET email_address = LOWER(p.email_address)
      FROM candidate c
      JOIN person p ON p.id = c.person_id
      WHERE c.id = link.candidate_id AND p.email_address IS NOT NULL;
    `);
    await queryRunner.query(`DELETE FROM invite_access_link WHERE email_address IS NULL;`);
    await queryRunner.query(`ALTER TABLE invite_access_link ALTER COLUMN email_address SET NOT NULL;`);
    await queryRunner.query(`
      ALTER TABLE invite_access_link
        ADD CONSTRAINT fk_invite_access_link_invited_by FOREIGN KEY (invited_by_person_id)
          REFERENCES person (id) ON DELETE SET NULL;
    `);
    await queryRunner.query(`CREATE INDEX ix_invite_access_link_candidate_id ON invite_access_link (candidate_id);`);
    await queryRunner.query(`CREATE INDEX ix_invite_access_link_email ON invite_access_link (LOWER(email_address));`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS ix_invite_access_link_email;`);
    await queryRunner.query(`DROP INDEX IF EXISTS ix_invite_access_link_candidate_id;`);
    await queryRunner.query(`ALTER TABLE invite_access_link DROP CONSTRAINT IF EXISTS fk_invite_access_link_invited_by;`);
    await queryRunner.query(`
      ALTER TABLE invite_access_link
        DROP COLUMN invited_by_person_id,
        DROP COLUMN accepted_at,
        DROP COLUMN email_address;
    `);
    await queryRunner.query(
      `ALTER TABLE invite_access_link RENAME CONSTRAINT fk_invite_access_link_candidate TO fk_access_link_candidate;`,
    );
    await queryRunner.query(
      `ALTER TABLE invite_access_link RENAME CONSTRAINT invite_access_link_token_hash_key TO access_link_token_hash_key;`,
    );
    await queryRunner.query(`ALTER TABLE invite_access_link RENAME CONSTRAINT invite_access_link_pkey TO access_link_pkey;`);
    await queryRunner.query(`ALTER TABLE invite_access_link RENAME TO access_link;`);
  }
}
