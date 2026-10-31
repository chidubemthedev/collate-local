import "dotenv/config";
import dataSource from "../data-source";

const tables = [
  "coverage_count",
  "delivery",
  "import_batch",
  "access_link",
  "broadcast",
  "audit_log",
  "agent_assignment",
  "group_visibility_grant",
  "membership_scope_unit",
  "membership",
  "candidate",
  "seat",
  "election_day_off_cycle_state",
  "election_day_office",
  "groups",
  "phone_number",
  "consent",
  "person",
  "pu_political_unit",
  "polling_unit",
  "ward",
  "lga",
  "state",
  "political_unit",
  "office",
];

export async function clearSeedData(): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await dataSource.initialize();
  await queryRunner.connect();
  try {
    await queryRunner.query(`TRUNCATE TABLE ${tables.join(", ")} CASCADE;`);
  } finally {
    await queryRunner.release();
    await dataSource.destroy();
  }
}

if (require.main === module) {
  void clearSeedData();
}
