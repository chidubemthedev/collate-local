import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Drops two person columns nothing in the app ever used: the home polling unit and the voter card
 * number. Only seeds filled them. `down` adds them back empty; the dropped values are not restored.
 */
export class DropPersonHomePollingUnitAndVoterCard1790000009000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE person DROP CONSTRAINT IF EXISTS fk_person_home_polling_unit;`);
    await queryRunner.query(`ALTER TABLE person DROP COLUMN home_polling_unit_id;`);
    await queryRunner.query(`ALTER TABLE person DROP COLUMN voter_card_number;`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE person ADD COLUMN voter_card_number VARCHAR;`);
    await queryRunner.query(`ALTER TABLE person ADD COLUMN home_polling_unit_id INT;`);
    await queryRunner.query(
      `ALTER TABLE person ADD CONSTRAINT fk_person_home_polling_unit FOREIGN KEY (home_polling_unit_id) REFERENCES polling_unit (id) ON DELETE SET NULL;`,
    );
  }
}
