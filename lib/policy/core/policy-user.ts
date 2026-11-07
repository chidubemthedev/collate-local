import type { EntityManager } from "typeorm";
import { Candidate } from "../../db/entities/candidate.entity";
import { Membership } from "../../db/entities/membership.entity";
import { resolveManager } from "./database";

export interface PolicyUser {
  personId: string;
  isAdmin: boolean;
  /**
   * Their group type sees national coverage: every polling unit, like admins, without admin
   * rights. Otherwise they see only the areas set on their memberships.
   */
  hasNationalAccess?: boolean;
  /**
   * Their group type may message agents. Left out (as for candidates with no group), sending is
   * decided by their area alone, as before.
   */
  canMessage?: boolean;
  candidateId: number | null;
  seatId: number | null;
  groupIds: number[];
  scopeUnits: {
    stateIds: number[];
    lgaIds: number[];
    wardIds: number[];
    politicalUnitIds: number[];
  };
}

export async function loadPolicyUser(
  personId: string,
  manager?: EntityManager,
): Promise<PolicyUser> {
  const entityManager = await resolveManager(manager);
  // The two lookups are independent, so they run together.
  const membershipQuery = entityManager
    .getRepository(Membership)
    .createQueryBuilder("membership")
    .innerJoin("membership.group", "group")
    .innerJoin("group.groupType", "groupType")
    .leftJoin("membership.membershipScopeUnits", "scopeUnit")
    .select("membership.groupId", "groupId")
    .addSelect("groupType.typeKey", "typeKey")
    .addSelect("groupType.canMessage", "canMessage")
    .addSelect("groupType.seesCoverage", "seesCoverage")
    .addSelect("scopeUnit.scopeStateId", "scopeStateId")
    .addSelect("scopeUnit.scopeLgaId", "scopeLgaId")
    .addSelect("scopeUnit.scopeWardId", "scopeWardId")
    .addSelect("scopeUnit.scopePoliticalUnitId", "scopePoliticalUnitId")
    .where("membership.personId = :policyPersonId", { policyPersonId: personId })
    .getRawMany<{
      groupId: number;
      typeKey: string | null;
      canMessage: string;
      seesCoverage: string;
      scopeStateId: number | null;
      scopeLgaId: number | null;
      scopeWardId: number | null;
      scopePoliticalUnitId: number | null;
    }>();

  const candidateQuery = entityManager
    .getRepository(Candidate)
    .createQueryBuilder("candidate")
    .leftJoinAndSelect("candidate.principalCandidate", "principalCandidate")
    .where("candidate.personId = :policyCandidatePersonId", {
      policyCandidatePersonId: personId,
    })
    .orderBy("candidate.id", "ASC")
    .getOne();

  const [membershipRows, candidate] = await Promise.all([membershipQuery, candidateQuery]);

  return {
    personId,
    isAdmin: membershipRows.some((row) => row.typeKey === "admin"),
    // The rules come from each group's type (group_type).
    hasNationalAccess: membershipRows.some((row) => row.seesCoverage === "national"),
    ...(membershipRows.length
      ? { canMessage: membershipRows.some((row) => row.canMessage !== "none") }
      : {}),
    candidateId: candidate?.id ?? null,
    seatId: candidate?.seatId ?? candidate?.principalCandidate?.seatId ?? null,
    groupIds: [...new Set(membershipRows.map((row) => Number(row.groupId)))],
    scopeUnits: {
      stateIds: uniqueIds(membershipRows.map((row) => row.scopeStateId)),
      lgaIds: uniqueIds(membershipRows.map((row) => row.scopeLgaId)),
      wardIds: uniqueIds(membershipRows.map((row) => row.scopeWardId)),
      politicalUnitIds: uniqueIds(membershipRows.map((row) => row.scopePoliticalUnitId)),
    },
  };
}

function uniqueIds(values: Array<number | null>): number[] {
  return [...new Set(values.filter((value): value is number => value !== null).map(Number))];
}
