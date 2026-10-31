import type { QueryRunner } from "typeorm";

export async function seedCoverageCounts(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    INSERT INTO coverage_count (unit_state_id, unit_lga_id, unit_ward_id, unit_political_unit_id, owner_group_id, owner_candidate_id, coverage_kind, covered_polling_unit_count, total_polling_unit_count, refreshed_at)
    WITH official_by_state AS (
      SELECT pu.id AS polling_unit_id, ward.lga_id, ward.id AS ward_id, l.state_id, state_pu.political_unit_id AS state_political_unit_id
      FROM polling_unit pu
      JOIN ward ON ward.id = pu.ward_id
      JOIN lga l ON l.id = ward.lga_id
      JOIN state st ON st.id = l.state_id
      JOIN pu_political_unit state_pu ON state_pu.polling_unit_id = pu.id
      JOIN political_unit pu_unit ON pu_unit.id = state_pu.political_unit_id
      WHERE pu_unit.political_unit_type = 'state'
      AND EXISTS (
        SELECT 1 FROM agent_assignment aa
        JOIN person p ON p.id = aa.person_id
        WHERE aa.polling_unit_id = pu.id
          AND aa.agent_kind = 'official'
      )
    ),
    official_coverage AS (
      SELECT st.id AS unit_state_id, NULL::int AS unit_lga_id, NULL::int AS unit_ward_id, NULL::int AS unit_political_unit_id, COUNT(*)::int AS covered_polling_unit_count, COUNT(*)::int AS total_polling_unit_count, NOW() AS refreshed_at
      FROM official_by_state obs
      JOIN state st ON st.id = obs.state_id
      GROUP BY st.id
      UNION ALL
      SELECT l.id AS unit_state_id, l.id AS unit_lga_id, NULL::int AS unit_ward_id, NULL::int AS unit_political_unit_id, COUNT(*)::int AS covered_polling_unit_count, COUNT(*)::int AS total_polling_unit_count, NOW() AS refreshed_at
      FROM official_by_state obs
      JOIN lga l ON l.id = obs.lga_id
      GROUP BY l.id
      UNION ALL
      SELECT st.id AS unit_state_id, NULL::int AS unit_lga_id, ward.id AS unit_ward_id, NULL::int AS unit_political_unit_id, COUNT(*)::int AS covered_polling_unit_count, COUNT(*)::int AS total_polling_unit_count, NOW() AS refreshed_at
      FROM official_by_state obs
      JOIN ward ON ward.id = obs.ward_id
      JOIN lga l2 ON l2.id = ward.lga_id
      JOIN state st ON st.id = l2.state_id
      GROUP BY st.id, ward.id
      UNION ALL
      SELECT st.id AS unit_state_id, NULL::int AS unit_lga_id, NULL::int AS unit_ward_id, state_pu.political_unit_id AS unit_political_unit_id, COUNT(*)::int AS covered_polling_unit_count, COUNT(*)::int AS total_polling_unit_count, NOW() AS refreshed_at
      FROM official_by_state obs
      JOIN state st ON st.id = obs.state_id
      JOIN pu_political_unit state_pu ON state_pu.polling_unit_id = obs.polling_unit_id
      GROUP BY st.id, state_pu.political_unit_id
    )
    SELECT unit_state_id, unit_lga_id, unit_ward_id, unit_political_unit_id, NULL::int AS owner_group_id, NULL::int AS owner_candidate_id, 'headline'::coverage_kind AS coverage_kind, covered_polling_unit_count, total_polling_unit_count, refreshed_at
    FROM official_coverage;
  `);

  await queryRunner.query(`
    INSERT INTO coverage_count (unit_state_id, unit_lga_id, unit_ward_id, unit_political_unit_id, owner_group_id, owner_candidate_id, coverage_kind, covered_polling_unit_count, total_polling_unit_count, refreshed_at)
    WITH group_membership AS (
      SELECT DISTINCT aa.polling_unit_id, aa.owner_group_id, g.parent_group_id, g.id AS group_id
      FROM agent_assignment aa
      JOIN groups g ON g.id = aa.owner_group_id
      WHERE aa.agent_kind = 'official'
    )
    SELECT st.id AS unit_state_id, NULL::int AS unit_lga_id, NULL::int AS unit_ward_id, NULL::int AS unit_political_unit_id, gm.owner_group_id AS owner_group_id, NULL::int AS owner_candidate_id, 'group'::coverage_kind AS coverage_kind,
      COUNT(DISTINCT gm.polling_unit_id)::int AS covered_polling_unit_count,
      COUNT(DISTINCT pu.id)::int AS total_polling_unit_count,
      NOW() AS refreshed_at
    FROM group_membership gm
    JOIN polling_unit pu ON pu.id = gm.polling_unit_id
    JOIN ward w ON w.id = pu.ward_id
    JOIN lga l ON l.id = w.lga_id
    JOIN state st ON st.id = l.state_id
    GROUP BY st.id, gm.owner_group_id;
  `);
}
