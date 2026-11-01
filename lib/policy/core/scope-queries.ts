import type { EntityManager } from "typeorm";
import { PollingUnit } from "../../db/entities/polling-unit.entity";
import { resolveManager } from "./database";
import { getScope } from "./scope";
import type { PolicyUser } from "./policy-user";

export interface ScopeDescription {
  pollingUnitCount: number;
  wardCount: number;
  lgaCount: number;
  stateCount: number;
}

export async function describeScope(
  user: PolicyUser,
  manager?: EntityManager,
): Promise<ScopeDescription> {
  const entityManager = await resolveManager(manager);
  const query = entityManager
    .getRepository(PollingUnit)
    .createQueryBuilder("pollingUnit")
    .innerJoin("pollingUnit.ward", "ward")
    .innerJoin("ward.lga", "lga")
    .innerJoin("lga.state", "state")
    .select("COUNT(DISTINCT pollingUnit.id)::int", "pollingUnitCount")
    .addSelect("COUNT(DISTINCT ward.id)::int", "wardCount")
    .addSelect("COUNT(DISTINCT lga.id)::int", "lgaCount")
    .addSelect("COUNT(DISTINCT state.id)::int", "stateCount");

  getScope(user, entityManager).apply(query, "pollingUnit.id");

  const counts = await query.getRawOne<ScopeDescription>();
  return {
    pollingUnitCount: Number(counts?.pollingUnitCount ?? 0),
    wardCount: Number(counts?.wardCount ?? 0),
    lgaCount: Number(counts?.lgaCount ?? 0),
    stateCount: Number(counts?.stateCount ?? 0),
  };
}

export async function canAccessPollingUnit(
  user: PolicyUser,
  pollingUnitId: number,
  manager?: EntityManager,
): Promise<boolean> {
  const entityManager = await resolveManager(manager);
  const scopedPollingUnits = entityManager
    .createQueryBuilder()
    .select("1")
    .from(PollingUnit, "pollingUnit")
    .where("pollingUnit.id = :policyPollingUnitId", { policyPollingUnitId: pollingUnitId });

  getScope(user, entityManager).apply(scopedPollingUnits, "pollingUnit.id");

  const result = await entityManager
    .createQueryBuilder()
    .select(`EXISTS (${scopedPollingUnits.getQuery()})`, "allowed")
    .setParameters(scopedPollingUnits.getParameters())
    .getRawOne<{ allowed: boolean | string }>();

  return result?.allowed === true || result?.allowed === "true";
}
