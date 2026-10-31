import dataSource from "../data-source";
import { Group } from "../entities/group.entity";
import { GroupVisibilityGrant } from "../entities/group-visibility-grant.entity";
import { Office } from "../entities/office.entity";
import { PoliticalUnitType } from "../entities/political-unit.entity";

export async function seedOffices(): Promise<void> {
  const officeRepository = dataSource.manager.getRepository(Office);

  const offices = [
    {
      officeName: "President",
      hierarchyLevel: 1,
      politicalUnitType: PoliticalUnitType.COUNTRY,
    },
    {
      officeName: "Governor",
      hierarchyLevel: 2,
      politicalUnitType: PoliticalUnitType.STATE,
    },
    {
      officeName: "Senate",
      hierarchyLevel: 3,
      politicalUnitType: PoliticalUnitType.SENATORIAL_DISTRICT,
    },
    {
      officeName: "House of Reps",
      hierarchyLevel: 4,
      politicalUnitType: PoliticalUnitType.FEDERAL_CONSTITUENCY,
    },
    {
      officeName: "State Assembly",
      hierarchyLevel: 5,
      politicalUnitType: PoliticalUnitType.STATE_CONSTITUENCY,
    },
  ];

  for (const office of offices) {
    const existing = await officeRepository.findOne({ where: { officeName: office.officeName } });
    if (existing) {
      existing.hierarchyLevel = office.hierarchyLevel;
      existing.politicalUnitType = office.politicalUnitType;
      await officeRepository.save(existing);
    } else {
      await officeRepository.insert(office);
    }
  }
}

export async function seedAllowAllGrants(): Promise<void> {
  const groupRepository = dataSource.manager.getRepository(Group);
  const grantRepository = dataSource.manager.getRepository(GroupVisibilityGrant);
  const groups = await groupRepository.find();

  if (groups.length === 0) {
    return;
  }

  for (const viewer of groups) {
    for (const owner of groups) {
      const existing = await grantRepository.findOne({
        where: { viewerGroupId: viewer.id, ownerGroupId: owner.id },
      });
      if (!existing) {
        await grantRepository.insert({
          viewerGroupId: viewer.id,
          ownerGroupId: owner.id,
          isAllowed: true,
        });
      }
    }
  }
}

export async function seedAll(): Promise<void> {
  await seedOffices();
  await seedAllowAllGrants();
}

async function main(): Promise<void> {
  await dataSource.initialize();
  try {
    await seedAll();
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  void main();
}
