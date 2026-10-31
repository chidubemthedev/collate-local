import type { QueryRunner } from "typeorm";
import { PoliticalUnitType } from "../../entities/political-unit.entity";
import { seedOffices } from "../index";
import { getDemoStates } from "./utils";

export async function seedPoliticalStructure(
  queryRunner: QueryRunner,
  stateIds: Record<string, number>,
  pollingUnitIds: Record<string, number>,
): Promise<{ politicalUnits: Record<string, number>; statePoliticalUnitIds: Record<string, number> }> {
  await seedOffices();

  const demoStates = getDemoStates();
  const politicalUnits: Record<string, number> = {};
  const statePoliticalUnitIds: Record<string, number> = {};

  const countryResult = await queryRunner.query<{ id: number }>(`
    INSERT INTO political_unit (political_unit_name, political_unit_type, parent_political_unit_id)
    VALUES ('Nigeria', '${PoliticalUnitType.COUNTRY}', NULL)
    RETURNING id;
  `);
  const countryId = countryResult[0].id;
  politicalUnits[`country`] = countryId;

  for (const state of demoStates) {
    const stateRow = await queryRunner.query<{ id: number }>(`
      INSERT INTO political_unit (political_unit_name, political_unit_type, parent_political_unit_id)
      VALUES ('${state.stateName}', '${PoliticalUnitType.STATE}', ${countryId})
      RETURNING id;
    `);
    const stateId = stateRow[0].id;
    politicalUnits[`state:${state.stateCode}`] = stateId;
    statePoliticalUnitIds[state.stateCode] = stateId;

    for (let district = 1; district <= 3; district += 1) {
      const districtName = `${state.stateName} Senatorial District ${district}`;
      const districtRow = await queryRunner.query<{ id: number }>(`
        INSERT INTO political_unit (political_unit_name, political_unit_type, parent_political_unit_id)
        VALUES ('${districtName}', '${PoliticalUnitType.SENATORIAL_DISTRICT}', ${stateId})
        RETURNING id;
      `);
      politicalUnits[`senatorial:${state.stateCode}:${district}`] = districtRow[0].id;
    }

    for (let constituency = 1; constituency <= 2; constituency += 1) {
      const constituencyName = `${state.stateName} Federal Constituency ${constituency}`;
      const constituencyRow = await queryRunner.query<{ id: number }>(`
        INSERT INTO political_unit (political_unit_name, political_unit_type, parent_political_unit_id)
        VALUES ('${constituencyName}', '${PoliticalUnitType.FEDERAL_CONSTITUENCY}', ${stateId})
        RETURNING id;
      `);
      politicalUnits[`federal:${state.stateCode}:${constituency}`] = constituencyRow[0].id;
    }

    for (let assembly = 1; assembly <= 3; assembly += 1) {
      const assemblyName = `${state.stateName} State Constituency ${assembly}`;
      const assemblyRow = await queryRunner.query<{ id: number }>(`
        INSERT INTO political_unit (political_unit_name, political_unit_type, parent_political_unit_id)
        VALUES ('${assemblyName}', '${PoliticalUnitType.STATE_CONSTITUENCY}', ${stateId})
        RETURNING id;
      `);
      politicalUnits[`state_constituency:${state.stateCode}:${assembly}`] = assemblyRow[0].id;
    }
  }

  const allPollingUnits = await queryRunner.query<{ polling_unit_id: number; inec_polling_unit_code: string }>(`
    SELECT id AS polling_unit_id, inec_polling_unit_code
    FROM polling_unit
    WHERE inec_polling_unit_code LIKE '90-%'
      OR inec_polling_unit_code LIKE '91-%'
      OR inec_polling_unit_code LIKE '92-%';
  `);

  for (const unit of allPollingUnits) {
    const [stateCode] = unit.inec_polling_unit_code.split("-");
    const statePoliticalUnitId = statePoliticalUnitIds[stateCode];
    const districtId = politicalUnits[`senatorial:${stateCode}:1`];
    const federalId = politicalUnits[`federal:${stateCode}:1`];
    const stateAssemblyId = politicalUnits[`state_constituency:${stateCode}:1`];

    await queryRunner.query(`
      INSERT INTO pu_political_unit (political_unit_id, polling_unit_id)
      VALUES (${countryId}, ${unit.polling_unit_id}), (${statePoliticalUnitId}, ${unit.polling_unit_id}), (${districtId}, ${unit.polling_unit_id}), (${federalId}, ${unit.polling_unit_id}), (${stateAssemblyId}, ${unit.polling_unit_id})
      ON CONFLICT (political_unit_id, polling_unit_id) DO NOTHING;
    `);
  }

  return { politicalUnits, statePoliticalUnitIds };
}
