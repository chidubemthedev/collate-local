import "dotenv/config";
import dataSource from "../../data-source";
import { ensureDemoDataDoesNotExist } from "./reset";
import { seedGeography } from "./01-geography";
import { seedPoliticalStructure } from "./02-political-structure";
import { seedGroupsAndPeople } from "./03-groups-people";
import { seedAgents } from "./04-agents";
import { seedBroadcasts } from "./05-broadcasts";
import { seedOperations } from "./06-ops";
import { seedCoverageCounts } from "./07-coverage";
import { assertDemoSeedAllowed } from "./utils";

export async function runDemoSeed(): Promise<void> {
  assertDemoSeedAllowed();

  await dataSource.initialize();
  try {
    const demoExists = await ensureDemoDataDoesNotExist(dataSource);
    if (demoExists) {
      console.log("Demo data already exists. Use db:seed:demo:reset before reseeding.");
      return;
    }

    const geography = await seedGeography(dataSource.createQueryRunner());
    const structure = await seedPoliticalStructure(dataSource.createQueryRunner(), geography.states, geography.pollingUnits);
    const groupData = await seedGroupsAndPeople(dataSource.createQueryRunner(), geography.states, structure.politicalUnits);
    await seedAgents(dataSource.createQueryRunner(), groupData.groupIds, geography.states, structure.politicalUnits);
    await seedBroadcasts(dataSource.createQueryRunner());
    await seedOperations(dataSource.createQueryRunner());
    await seedCoverageCounts(dataSource.createQueryRunner());

    const counts = await dataSource.query(`
      SELECT 'person' AS table_name, COUNT(*)::int AS count FROM person
      UNION ALL SELECT 'phone_number', COUNT(*)::int FROM phone_number
      UNION ALL SELECT 'group', COUNT(*)::int FROM groups
      UNION ALL SELECT 'candidate', COUNT(*)::int FROM candidate
      UNION ALL SELECT 'agent_assignment', COUNT(*)::int FROM agent_assignment
      UNION ALL SELECT 'broadcast', COUNT(*)::int FROM broadcast
      UNION ALL SELECT 'delivery', COUNT(*)::int FROM delivery
      UNION ALL SELECT 'coverage_count', COUNT(*)::int FROM coverage_count
      UNION ALL SELECT 'import_batch', COUNT(*)::int FROM import_batch
      UNION ALL SELECT 'access_link', COUNT(*)::int FROM access_link
      UNION ALL SELECT 'audit_log', COUNT(*)::int FROM audit_log;
    `);

    console.log(JSON.stringify(counts.map((row: { table_name: string; count: number }) => ({ [row.table_name]: row.count })), null, 2));
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  void runDemoSeed();
}
