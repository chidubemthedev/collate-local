import type { EntityManager } from "typeorm";
import { Candidate } from "../../db/entities/candidate.entity";
import { Membership } from "../../db/entities/membership.entity";
import { resolveManager } from "./database";

export interface PolicyUser {
  personId: string;
  isAdmin: boolean;
  /**
   * A party membership with no area is national: every polling unit, like admins, without admin
   * rights. A party membership with an area (a state coordinator, say) sees only that area.
   */
  hasNationalAccess?: boolean;
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
    .leftJoin("membership.membershipScopeUnits", "scopeUnit")
    .select("membership.groupId", "groupId")
    .addSelect("group.groupType", "groupType")
    .addSelect("scopeUnit.scopeStateId", "scopeStateId")
    .addSelect("scopeUnit.scopeLgaId", "scopeLgaId")
    .addSelect("scopeUnit.scopeWardId", "scopeWardId")
    .addSelect("scopeUnit.scopePoliticalUnitId", "scopePoliticalUnitId")
    .where("membership.personId = :policyPersonId", { policyPersonId: personId })
    .getRawMany<{
      groupId: number;
      groupType: string;
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
    isAdmin: membershipRows.some((row) => row.groupType === "admin"),
    // One row per area of a membership; a membership with no area comes back as one row of NULLs.
    hasNationalAccess: membershipRows.some(
      (row) =>
        row.groupType === "party" &&
        row.scopeStateId === null &&
        row.scopeLgaId === null &&
        row.scopeWardId === null &&
        row.scopePoliticalUnitId === null,
    ),
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
