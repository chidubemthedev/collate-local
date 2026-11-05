import type { QueryRunner } from "typeorm";
import { GroupType } from "../../entities/group.entity";
import { seedAllowAllGrants } from "../index";
import { demoEmail, demoPhone, makeDemoName, slug } from "./utils";

export async function seedGroupsAndPeople(
  queryRunner: QueryRunner,
  stateIds: Record<string, number>,
  politicalUnits: Record<string, number>,
): Promise<{ personIds: string[]; candidateIds: number[]; groupIds: Record<string, number>; }> {
  const groupData = [
    { group_name: "Collate Admins", group_type: GroupType.ADMIN },
    { group_name: "NDC", group_type: GroupType.PARTY },
    { group_name: "NDC Lagos", group_type: GroupType.PARTY, parent_group_name: "NDC" },
    { group_name: "NDC Anambra", group_type: GroupType.PARTY, parent_group_name: "NDC" },
    { group_name: "NDC Kano", group_type: GroupType.PARTY, parent_group_name: "NDC" },
    { group_name: "Party Presidential Campaign", group_type: GroupType.CAMPAIGN },
    { group_name: "Independent Presidential Campaign", group_type: GroupType.CAMPAIGN },
    { group_name: "Obedient Movement", group_type: GroupType.SUPPORT_GROUP },
    { group_name: "Kwankwasiyya", group_type: GroupType.SUPPORT_GROUP },
    { group_name: "OK Movement", group_type: GroupType.SUPPORT_GROUP },
    { group_name: "Obedient Movement Youth Wing", group_type: GroupType.SUPPORT_GROUP, parent_group_name: "Obedient Movement" },
    { group_name: "Obedient Movement Ward Coordinators", group_type: GroupType.SUPPORT_GROUP, parent_group_name: "Obedient Movement" },
  ];

  const createdGroups = await queryRunner.query(`
    INSERT INTO groups (group_name, group_type, parent_group_id)
    VALUES ${groupData
      .map((group) => {
        return `('${group.group_name.replace("'", "''")}', '${group.group_type}', NULL)`;
      })
      .join(", ")}
    RETURNING id, group_name;
  `) as Array<{ id: number; group_name: string }>;

  const groupIds: Record<string, number> = {};
  for (const row of createdGroups) {
    groupIds[row.group_name] = row.id;
  }

  for (const group of groupData) {
    if (!group.parent_group_name) continue;
    await queryRunner.query(`UPDATE groups SET parent_group_id = ${groupIds[group.parent_group_name]} WHERE group_name = '${group.group_name.replace("'", "''")}'`);
    groupIds[group.group_name] = groupIds[group.group_name];
  }

  await seedAllowAllGrants();

  const adminPeople = [
    { name: makeDemoName("Ada"), role: "level_2" },
    { name: makeDemoName("Bamidele"), role: "level_2" },
    { name: makeDemoName("Chioma"), role: "level_1" },
    { name: makeDemoName("Danjuma"), role: "level_1" },
  ];

  const insertedPeople: Array<{ id: string; full_name: string }> = [];

  const personValues: string[] = [];
  for (const admin of adminPeople) {
    personValues.push(`('${demoEmail(slug(admin.name))}', '${admin.name.replace("'", "''")}', NULL, NULL, 'unverified')`);
  }

  const stateChairNames = ["Nneka", "Musa", "Aisha"];
  for (let i = 0; i < stateChairNames.length; i += 1) {
    const code = ["90", "91", "92"][i];
    personValues.push(`('${demoEmail(slug(`${stateChairNames[i]} ${code}`))}', '${makeDemoName(stateChairNames[i]).replace("'", "''")}', NULL, NULL, 'verified')`);
  }

  const lgaCoordinatorNames = ["Ifeanyi", "Bola", "Kehinde", "Mira", "Khalid", "Ngozi"];
  for (const name of lgaCoordinatorNames) {
    personValues.push(`('${demoEmail(slug(`${name} lga`))}', '${makeDemoName(name).replace("'", "''")}', NULL, NULL, 'verified')`);
  }

  const campaignDirectorNames = ["Lilian", "Tunde"];
  for (const name of campaignDirectorNames) {
    personValues.push(`('${demoEmail(slug(`${name} campaign`))}', '${makeDemoName(name).replace("'", "''")}', NULL, NULL, 'verified')`);
  }

  const supportCoordinatorNames = ["Ayo", "Kemi", "Zainab", "Femi", "Jude", "Ruth"];
  for (const name of supportCoordinatorNames) {
    personValues.push(`('${demoEmail(slug(`${name} support`))}', '${makeDemoName(name).replace("'", "''")}', NULL, NULL, 'verified')`);
  }

  const baseCandidateNames = [
    "Adamu Bello", "Mariam Okafor", "Obinna Umeh", "Ifeyinwa Ado", "Sani Lawal", "Grace Eze",
    "Amina Yusuf", "Emeka Okoye", "Hauwa Umar", "Chinwe Nwosu", "Musa Sani", "Aisha Bala",
    "Daniel Agbo", "Tina Raji", "Kelechi Nwosu", "Nafisa Danjuma", "Babatunde Igho", "Rose Ojo",
    "Ifeoma Ugwu", "Bello Yaro", "Kingsley Ede", "Sabrina Abba", "Kehinde Oseni", "Tobiloba Adebayo",
  ];

  for (const name of baseCandidateNames) {
    personValues.push(`('${demoEmail(slug(name))}', '${name.replace("'", "''")}', NULL, NULL, 'verified')`);
  }

  const insertedPersonRows = await queryRunner.query(`
    INSERT INTO person (email_address, full_name, home_polling_unit_id, voter_card_number, verification_status)
    VALUES ${personValues.join(", ")}
    RETURNING id, full_name, email_address, verification_status;
  `) as Array<{ id: string; full_name: string; email_address: string; verification_status: string }>;

  for (const row of insertedPersonRows) {
    insertedPeople.push({ id: row.id, full_name: row.full_name });
  }

  const personMap = new Map(insertedPersonRows.map((person) => [person.full_name, person.id]));

  const phoneValues: string[] = [];
  for (let i = 0; i < insertedPersonRows.length; i += 1) {
    const row = insertedPersonRows[i];
    const phoneNumber = demoPhone(i + 1);
    const telegram = i % 6 === 0 ? (9000000000 + i) : null;
    phoneValues.push(`('${row.id}', '${phoneNumber}', true, ${telegram === null ? "NULL" : telegram})`);
  }

  await queryRunner.query(`
    INSERT INTO phone_number (person_id, e164_number, is_confirmed, telegram_chat_id)
    VALUES ${phoneValues.join(", ")};
  `);

  const membershipRows: Array<{ id: number; membership_role: string; person_id: string; group_id: number }> = [];
  const membershipValues: string[] = [];

  const adminMembers = adminPeople.map((admin, index) => [insertedPeople[index], admin.role] as const);
  for (const [person, role] of adminMembers) {
    membershipValues.push(`('${person.id}', ${groupIds["Collate Admins"]}, '${role}')`);
  }

  const stateChairPeople = insertedPersonRows.slice(adminPeople.length, adminPeople.length + stateChairNames.length);
  for (let i = 0; i < stateChairPeople.length; i += 1) {
    const person = stateChairPeople[i];
    const groupName = `NDC ${["Lagos", "Anambra", "Kano"][i]}`;
    membershipValues.push(`('${person.id}', ${groupIds[groupName]}, 'chair')`);
  }

  const lgaCoordinatorPeople = insertedPersonRows.slice(adminPeople.length + stateChairNames.length, adminPeople.length + stateChairNames.length + lgaCoordinatorNames.length);
  for (let i = 0; i < lgaCoordinatorPeople.length; i += 1) {
    const person = lgaCoordinatorPeople[i];
    const groupName = `NDC ${["Lagos", "Anambra", "Kano"][i % 3]}`;
    membershipValues.push(`('${person.id}', ${groupIds[groupName]}, 'lga_coordinator')`);
  }

  const campaignPeople = insertedPersonRows.slice(adminPeople.length + stateChairNames.length + lgaCoordinatorNames.length, adminPeople.length + stateChairNames.length + lgaCoordinatorNames.length + campaignDirectorNames.length);
  for (let i = 0; i < campaignPeople.length; i += 1) {
    const person = campaignPeople[i];
    const groupName = ["Party Presidential Campaign", "Independent Presidential Campaign"][i];
    membershipValues.push(`('${person.id}', ${groupIds[groupName]}, 'director')`);
  }

  const supportPeople = insertedPersonRows.slice(adminPeople.length + stateChairNames.length + lgaCoordinatorNames.length + campaignDirectorNames.length, adminPeople.length + stateChairNames.length + lgaCoordinatorNames.length + campaignDirectorNames.length + supportCoordinatorNames.length);
  for (let i = 0; i < supportPeople.length; i += 1) {
    const person = supportPeople[i];
    const groupName = ["Obedient Movement", "Kwankwasiyya", "OK Movement", "Obedient Movement Youth Wing", "Obedient Movement Ward Coordinators", "Kwankwasiyya"][i % 6];
    membershipValues.push(`('${person.id}', ${groupIds[groupName]}, 'coordinator')`);
  }

  const insertedMemberships = await queryRunner.query(`
    INSERT INTO membership (person_id, group_id, membership_role)
    VALUES ${membershipValues.join(", ")}
    RETURNING id, person_id, group_id, membership_role;
  `) as Array<{ id: number; person_id: string; group_id: number; membership_role: string }>;

  for (const row of insertedMemberships) {
    membershipRows.push(row);
  }

  const scopeValues: string[] = [];
  for (const row of insertedMemberships) {
    if (row.group_id === groupIds["Collate Admins"]) {
      scopeValues.push(`(${row.id}, ${stateIds["90"]}, NULL, NULL, NULL)`);
      continue;
    }
    if (row.group_id === groupIds["NDC Lagos"] || row.group_id === groupIds["NDC Anambra"] || row.group_id === groupIds["NDC Kano"]) {
      const stateCode = row.group_id === groupIds["NDC Lagos"] ? "90" : row.group_id === groupIds["NDC Anambra"] ? "91" : "92";
      scopeValues.push(`(${row.id}, ${stateIds[stateCode]}, NULL, NULL, NULL)`);
    }
  }

  if (scopeValues.length > 0) {
    await queryRunner.query(`INSERT INTO membership_scope_unit (membership_id, scope_state_id, scope_lga_id, scope_ward_id, scope_political_unit_id) VALUES ${scopeValues.join(", ")};`);
  }

  const candidateNames = [
    ["Emmanuel Okoh", "President", "country"],
    ["Amina Okoh", "Vice President", "running_mate"],
    ["Nneka Anya", "Governor", "90"],
    ["Ifenna Uche", "Governor", "90"],
    ["Chike Ozo", "Governor", "91"],
    ["Maimuna Sani", "Governor", "92"],
    ["Folarin Kola", "Senate", "90"],
    ["Bose Ojo", "Senate", "90"],
    ["Tunde Adebayo", "Senate", "90"],
    ["Musa Gambo", "Senate", "91"],
    ["Hajara Abdullahi", "Senate", "91"],
    ["Awka Chibuike", "Senate", "92"],
    ["Jide Aina", "House of Reps", "90"],
    ["Davida Nwokolo", "House of Reps", "90"],
    ["Zainab Usman", "House of Reps", "91"],
    ["Wale Oyetola", "House of Reps", "92"],
    ["Ruth Okoliko", "State Assembly", "90"],
    ["Ayo Bassey", "State Assembly", "90"],
    ["Kelechi Ude", "State Assembly", "91"],
    ["Abdullahi Fati", "State Assembly", "91"],
    ["Binta Makama", "State Assembly", "92"],
    ["Sadiq Dogo", "State Assembly", "92"],
  ];

  const candidatePersonValues: string[] = [];
  for (const [name] of candidateNames) {
    candidatePersonValues.push(`('${demoEmail(slug(name))}', '${name.replace("'", "''")}', NULL, NULL, 'verified')`);
  }

  const candidatePersonRows = await queryRunner.query(`
    INSERT INTO person (email_address, full_name, home_polling_unit_id, voter_card_number, verification_status)
    VALUES ${candidatePersonValues.join(", ")}
    RETURNING id, full_name;
  `) as Array<{ id: string; full_name: string }>;

  const officeRows = await queryRunner.query(`SELECT id, office_name FROM office;`) as Array<{ id: number; office_name: string }>;
  const officeMap = new Map(officeRows.map((office) => [office.office_name, office.id]));

  const seatMap: Record<string, number> = {};
  const seatRows = await queryRunner.query(`
    INSERT INTO seat (office_id, political_unit_id)
    VALUES 
      (${officeMap.get("President")}, ${politicalUnits["country"]}),
      (${officeMap.get("Governor")}, ${politicalUnits["state:90"]}),
      (${officeMap.get("Governor")}, ${politicalUnits["state:91"]}),
      (${officeMap.get("Governor")}, ${politicalUnits["state:92"]}),
      (${officeMap.get("Senate")}, ${politicalUnits["senatorial:90:1"]}),
      (${officeMap.get("Senate")}, ${politicalUnits["senatorial:90:2"]}),
      (${officeMap.get("Senate")}, ${politicalUnits["senatorial:90:3"]}),
      (${officeMap.get("Senate")}, ${politicalUnits["senatorial:91:1"]}),
      (${officeMap.get("Senate")}, ${politicalUnits["senatorial:91:2"]}),
      (${officeMap.get("Senate")}, ${politicalUnits["senatorial:91:3"]}),
      (${officeMap.get("Senate")}, ${politicalUnits["senatorial:92:1"]}),
      (${officeMap.get("Senate")}, ${politicalUnits["senatorial:92:2"]}),
      (${officeMap.get("Senate")}, ${politicalUnits["senatorial:92:3"]}),
      (${officeMap.get("House of Reps")}, ${politicalUnits["federal:90:1"]}),
      (${officeMap.get("House of Reps")}, ${politicalUnits["federal:90:2"]}),
      (${officeMap.get("House of Reps")}, ${politicalUnits["federal:91:1"]}),
      (${officeMap.get("House of Reps")}, ${politicalUnits["federal:91:2"]}),
      (${officeMap.get("House of Reps")}, ${politicalUnits["federal:92:1"]}),
      (${officeMap.get("House of Reps")}, ${politicalUnits["federal:92:2"]}),
      (${officeMap.get("State Assembly")}, ${politicalUnits["state_constituency:90:1"]}),
      (${officeMap.get("State Assembly")}, ${politicalUnits["state_constituency:90:2"]}),
      (${officeMap.get("State Assembly")}, ${politicalUnits["state_constituency:90:3"]}),
      (${officeMap.get("State Assembly")}, ${politicalUnits["state_constituency:91:1"]}),
      (${officeMap.get("State Assembly")}, ${politicalUnits["state_constituency:91:2"]}),
      (${officeMap.get("State Assembly")}, ${politicalUnits["state_constituency:91:3"]}),
      (${officeMap.get("State Assembly")}, ${politicalUnits["state_constituency:92:1"]}),
      (${officeMap.get("State Assembly")}, ${politicalUnits["state_constituency:92:2"]}),
      (${officeMap.get("State Assembly")}, ${politicalUnits["state_constituency:92:3"]})
    RETURNING id, office_id, political_unit_id;
  `) as Array<{ id: number; office_id: number; political_unit_id: number }>;

  for (const row of seatRows) {
    seatMap[`${row.office_id}:${row.political_unit_id}`] = row.id;
  }

  const candidateValues: string[] = [];
  for (let index = 0; index < candidatePersonRows.length; index += 1) {
    const person = candidatePersonRows[index];
    const officeName = candidateNames[index][1];
    const scope = candidateNames[index][2];

    if (scope === "running_mate") {
      candidateValues.push(`('${person.id}', NULL, NULL)`);
      continue;
    }

    const seatKey = `${officeMap.get(officeName)}:${politicalUnits[scope === "country" ? "country" : scope.includes(":") ? scope : `state:${scope}`]}`;
    const seatId = seatMap[seatKey];
    candidateValues.push(`('${person.id}', ${seatId ?? "NULL"}, NULL)`);
  }

  const insertedCandidates = await queryRunner.query(`
    INSERT INTO candidate (person_id, seat_id, principal_candidate_id)
    VALUES ${candidateValues.join(", ")}
    RETURNING id, person_id, seat_id, principal_candidate_id;
  `) as Array<{ id: number; person_id: string; seat_id: number | null; principal_candidate_id: number | null }>;

  const candidateMap = new Map(insertedCandidates.map((row) => [row.person_id, row.id]));
  const runningMatePersonId = personMap.get("Amina Okoh");
  if (runningMatePersonId) {
    const presidentCandidateId = candidateMap.get(personMap.get("Emmanuel Okoh") ?? "");
    if (presidentCandidateId) {
      await queryRunner.query(`UPDATE candidate SET principal_candidate_id = ${presidentCandidateId} WHERE person_id = '${runningMatePersonId}'`);
    }
  }

  const candidateIds = insertedCandidates.map((row) => row.id);

  const consentValues: string[] = [];
  for (const person of insertedPersonRows) {
    consentValues.push(`('${person.id}', 'v1', true)`);
  }

  await queryRunner.query(`INSERT INTO consent (person_id, consent_text_version, is_accepted) VALUES ${consentValues.join(", ")};`);

  return { personIds: insertedPersonRows.map((row) => row.id), candidateIds, groupIds };
}
