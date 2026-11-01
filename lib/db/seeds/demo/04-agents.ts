import type { QueryRunner } from "typeorm";
import { AgentAssignment, AgentKind } from "../../entities/agent-assignment.entity";
import { Person } from "../../entities/person.entity";
import { demoEmail, demoFaker, demoPhone, demoIp, slug, makeDemoName } from "./utils";

export async function seedAgents(
  queryRunner: QueryRunner,
  groupIds: Record<string, number>,
  stateIds: Record<string, number>,
  politicalUnits: Record<string, number>,
): Promise<{ agentCount: number; }> {
  const stateNames = ["Lagos", "Anambra", "Kano"];
  const statePollingUnitRows = await queryRunner.query(`
    SELECT id, inec_polling_unit_code, ward_id FROM polling_unit WHERE inec_polling_unit_code LIKE '90-%' OR inec_polling_unit_code LIKE '91-%' OR inec_polling_unit_code LIKE '92-%';
  `) as Array<{ id: number; inec_polling_unit_code: string; ward_id: number }>;

  const agentPersons: Array<{ id: string }> = [];
  const insertedPeople = await queryRunner.query(`SELECT p.id FROM person p WHERE p.email_address LIKE '%@demo.collate.test%' LIMIT 1;`) as Array<{ id: string }>;

  const personValues: string[] = [];
  for (let i = 0; i < 430; i += 1) {
    const name = makeDemoName();
    const email = demoEmail(`agent-${i + 1}`);
    const stateName = stateNames[i % stateNames.length];
    const homePollingUnit = statePollingUnitRows[i % statePollingUnitRows.length];
    personValues.push(`('${email}', '${name.replace("'", "''")}', ${homePollingUnit?.id ?? 1}, NULL, 'unverified')`);
  }

  const insertedAgents = await queryRunner.query(`
    INSERT INTO person (email_address, full_name, home_polling_unit_id, voter_card_number, verification_status)
    VALUES ${personValues.join(", ")}
    RETURNING id;
  `) as Array<{ id: string }>;

  for (const row of insertedAgents) agentPersons.push(row);

  const phoneValues: string[] = [];
  let phoneIndex = 2000;
  for (const person of agentPersons) {
    phoneValues.push(`('${person.id}', '${demoPhone(phoneIndex)}', true, ${9000000000 + phoneIndex})`);
    phoneIndex += 1;
    if (person.id && (phoneIndex % 7 === 0)) {
      phoneValues.push(`('${person.id}', '${demoPhone(phoneIndex + 1)}', false, NULL)`);
      phoneIndex += 2;
    }
  }

  await queryRunner.query(`INSERT INTO phone_number (person_id, e164_number, is_confirmed, telegram_chat_id) VALUES ${phoneValues.join(", ")};`);

  const consentValues: string[] = [];
  for (const person of agentPersons) {
    const accepted = (phoneIndex + Number(person.id.slice(0, 1))) % 10 !== 0;
    consentValues.push(`('${person.id}', 'v1', ${accepted})`);
  }

  await queryRunner.query(`INSERT INTO consent (person_id, consent_text_version, is_accepted) VALUES ${consentValues.join(", ")};`);

  const officialAssignments: string[] = [];
  const extraAssignments: string[] = [];

  const officialOwnerMap: Record<string, number> = {
    "90": groupIds["NDC Lagos"],
    "91": groupIds["NDC Anambra"],
    "92": groupIds["NDC Kano"],
  };

  const candidateIds = await queryRunner.query(`SELECT id FROM candidate;`) as Array<{ id: number }>;
  const candidateOwnerIds = candidateIds.map((row) => row.id);

  for (let index = 0; index < statePollingUnitRows.length; index += 1) {
    const unit = statePollingUnitRows[index];
    const stateCode = unit.inec_polling_unit_code.split("-")[0];
    const ownerGroupId = officialOwnerMap[stateCode];
    const person = agentPersons[index % agentPersons.length];
    officialAssignments.push(`('${person.id}', ${unit.id}, ${ownerGroupId}, NULL, 'official', 0)`);
  }

  const extraOwnerGroups = [groupIds["Party Presidential Campaign"], groupIds["Independent Presidential Campaign"], groupIds["Obedient Movement"], groupIds["Kwankwasiyya"], groupIds["OK Movement"]];
  for (let unitIndex = 0; unitIndex < statePollingUnitRows.length; unitIndex += 1) {
    if (unitIndex % 4 !== 0) continue;
    const unit = statePollingUnitRows[unitIndex];
    const agent = agentPersons[(unitIndex * 2) % agentPersons.length];
    const ownerGroupId = extraOwnerGroups[unitIndex % extraOwnerGroups.length];
    extraAssignments.push(`('${agent.id}', ${unit.id}, ${ownerGroupId}, NULL, 'extra', ${1 + (unitIndex % 3)})`);
  }

  for (let i = 0; i < 6; i += 1) {
    const unit = statePollingUnitRows[(i * 17) % statePollingUnitRows.length];
    const person = agentPersons[(i * 33) % agentPersons.length];
    const candidateId = candidateOwnerIds[i % candidateOwnerIds.length];
    extraAssignments.push(`('${person.id}', ${unit.id}, NULL, ${candidateId}, 'extra', ${2 + (i % 4)})`);
  }

  const assignmentValues = [...officialAssignments, ...extraAssignments];
  await queryRunner.query(`
    INSERT INTO agent_assignment (person_id, polling_unit_id, owner_group_id, owner_candidate_id, agent_kind, slot_number)
    VALUES ${assignmentValues.join(", ")};
  `);

  const count = await queryRunner.query(`SELECT COUNT(*)::int AS count FROM agent_assignment;`) as Array<{ count: string }>;
  return { agentCount: Number(count[0].count) };
}
