import type { QueryRunner } from "typeorm";
import { Lga } from "../../entities/lga.entity";
import { PollingUnit } from "../../entities/polling-unit.entity";
import { State } from "../../entities/state.entity";
import { Ward } from "../../entities/ward.entity";
import { getDemoStates } from "./utils";

export async function seedGeography(queryRunner: QueryRunner): Promise<{
  states: Record<string, number>;
  lgas: Record<string, number>;
  wards: Record<string, number>;
  pollingUnits: Record<string, number>;
}> {
  const statesMeta = getDemoStates();
  const states: Record<string, number> = {};
  const lgas: Record<string, number> = {};
  const wards: Record<string, number> = {};
  const pollingUnits: Record<string, number> = {};

  const realGeography = await queryRunner.query<{ has_real_state: boolean; polling_unit_count: string }>(`
    SELECT
      EXISTS (SELECT 1 FROM state WHERE inec_state_code NOT IN ('90', '91', '92')) AS has_real_state,
      (SELECT COUNT(*)::int FROM polling_unit) AS polling_unit_count;
  `);

  const hasRealGeography = Boolean(realGeography[0]?.has_real_state) && Number(realGeography[0]?.polling_unit_count ?? 0) > 1000;
  if (hasRealGeography) {
    const stateRows = await queryRunner.manager.getRepository(State).find();
    for (const state of stateRows) {
      states[state.inecStateCode] = state.id;
    }

    const lgaRows = await queryRunner.manager.getRepository(Lga).find();
    for (const lga of lgaRows) {
      lgas[`${lga.stateId}:${lga.inecLgaCode}`] = lga.id;
    }

    const wardRows = await queryRunner.manager.getRepository(Ward).find();
    for (const ward of wardRows) {
      wards[`${ward.lgaId}:${ward.inecWardCode}`] = ward.id;
    }

    const pollingUnitRows = await queryRunner.manager.getRepository(PollingUnit).find();
    for (const pollingUnit of pollingUnitRows) {
      pollingUnits[pollingUnit.inecPollingUnitCode] = pollingUnit.id;
    }

    return { states, lgas, wards, pollingUnits };
  }

  const createdStateRows = await queryRunner.query<{ id: number; inec_state_code: string }>(`
    INSERT INTO state (inec_state_code, state_name)
    VALUES ${statesMeta
      .map((state) => `('${state.stateCode}', '${state.stateName.replace("'", "''")}')`)
      .join(", ")}
    RETURNING id, inec_state_code;
  `);

  for (const row of createdStateRows) {
    states[row.inec_state_code] = row.id;
  }

  let lgaCursor = 0;
  for (const state of statesMeta) {
    const lgaRows = await queryRunner.query<{ id: number; state_id: number; inec_lga_code: string }>(
      `
        INSERT INTO lga (state_id, inec_lga_code, lga_name)
        VALUES ${state.lgaNames
          .map((name, index) => {
            lgaCursor += 1;
            const code = `${state.stateCode}${String(index + 1).padStart(2, "0")}`;
            lgas[`${states[state.stateCode]}:${code}`] = 0;
            return `(${states[state.stateCode]}, '${code}', '${name.replace("'", "''")}')`;
          })
          .join(", ")}
        RETURNING id, state_id, inec_lga_code;
      `,
    );

    for (const row of lgaRows) {
      lgas[`${row.state_id}:${row.inec_lga_code}`] = row.id;
    }

    for (let lgaIndex = 0; lgaIndex < state.lgaNames.length; lgaIndex += 1) {
      const lgaCode = `${state.stateCode}${String(lgaIndex + 1).padStart(2, "0")}`;
      const lgaId = lgas[`${states[state.stateCode]}:${lgaCode}`];
      const wardRows = await queryRunner.query<{ id: number; lga_id: number; inec_ward_code: string }>(
        `
          INSERT INTO ward (lga_id, inec_ward_code, ward_name)
          VALUES ${Array.from({ length: 5 }, (_, wardIndex) => {
            const wardCode = `${String(wardIndex + 1).padStart(2, "0")}`;
            const wardName = `Ward ${String(wardIndex + 1).padStart(2, "0")} ${state.lgaNames[lgaIndex]}`;
            wards[`${lgaId}:${wardCode}`] = 0;
            return `(${lgaId}, '${wardCode}', '${wardName.replace("'", "''")}')`;
          }).join(", ")}
          RETURNING id, lga_id, inec_ward_code;
        `,
      );

      for (const row of wardRows) {
        wards[`${row.lga_id}:${row.inec_ward_code}`] = row.id;
      }

      let puNumber = 0;
      for (const row of wardRows) {
        const puList: string[] = [];
        const totalPus = 8 + ((lgaIndex + row.id) % 4);
        for (let puIndex = 1; puIndex <= totalPus; puIndex += 1) {
          puNumber += 1;
          const code = `${state.stateCode}-${String(lgaIndex + 1).padStart(2, "0")}-${row.inec_ward_code}-${String(puIndex).padStart(3, "0")}`;
          const name = `Primary School ${puIndex}`;
          const lat = state.boundingBox.latMin + ((state.boundingBox.latMax - state.boundingBox.latMin) * (puNumber / (wardRows.length * 10 + 1)));
          const lon = state.boundingBox.lonMin + ((state.boundingBox.lonMax - state.boundingBox.lonMin) * ((puIndex + row.id) / (totalPus + wardRows.length + 2)));
          const doubtful = puIndex % 50 === 0;
          puList.push(`('${code}', '${name.replace("'", "''")}', ${row.id}, ${lat}, ${lon}, ${doubtful})`);
          pollingUnits[code] = 0;
        }

        const insertedPus = await queryRunner.query<{ id: number; inec_polling_unit_code: string }>(`
          INSERT INTO polling_unit (inec_polling_unit_code, polling_unit_name, ward_id, latitude, longitude, is_position_doubtful)
          VALUES ${puList.join(", ")}
          RETURNING id, inec_polling_unit_code;
        `);

        for (const inserted of insertedPus) {
          pollingUnits[inserted.inec_polling_unit_code] = inserted.id;
        }
      }
    }
  }

  return { states, lgas, wards, pollingUnits };
}
