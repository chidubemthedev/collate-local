import type { ObjectLiteral, SelectQueryBuilder } from "typeorm";
import type { EntityManager } from "typeorm";
import type { PolicyUser } from "./policy-user";

export interface Scope {
  kind: "all" | "none" | "restricted";
  apply<T extends ObjectLiteral>(
    queryBuilder: SelectQueryBuilder<T>,
    pollingUnitColumn: string,
  ): void;
}

let scopeSequence = 0;

export function getScope(user: PolicyUser, _manager?: EntityManager): Scope {
  void _manager;
  // Admins and party (national) accounts see every polling unit.
  if (user.isAdmin || user.hasNationalAccess) {
    return { kind: "all", apply: () => undefined };
  }

  const hasScope = user.seatId !== null ||
    user.scopeUnits.stateIds.length > 0 ||
    user.scopeUnits.lgaIds.length > 0 ||
    user.scopeUnits.wardIds.length > 0 ||
    user.scopeUnits.politicalUnitIds.length > 0;

  if (!hasScope) {
    return {
      kind: "none",
      apply: (queryBuilder) => {
        queryBuilder.andWhere("FALSE");
      },
    };
  }

  const scopeId = ++scopeSequence;
  let applySequence = 0;

  return {
    kind: "restricted",
    apply: (queryBuilder, pollingUnitColumn) => {
      const parameterPrefix = `policyScope${scopeId}Apply${++applySequence}`;
      const parameters: Record<string, number> = {};
      const sources: string[] = [];

      if (user.seatId !== null) {
        const parameter = `${parameterPrefix}SeatId`;
        parameters[parameter] = user.seatId;
        // A seat maps to its political unit; a country-level unit maps every polling unit.
        sources.push(
          `SELECT seat_mapping.polling_unit_id
           FROM pu_political_unit seat_mapping
           JOIN seat user_seat ON user_seat.political_unit_id = seat_mapping.political_unit_id
           WHERE user_seat.id = :${parameter}`,
        );
      }

      addScopeSources(
        sources,
        parameters,
        user.scopeUnits.stateIds,
        parameterPrefix,
        "state",
      );
      addScopeSources(
        sources,
        parameters,
        user.scopeUnits.lgaIds,
        parameterPrefix,
        "lga",
      );
      addScopeSources(
        sources,
        parameters,
        user.scopeUnits.wardIds,
        parameterPrefix,
        "ward",
      );

      for (const [index, politicalUnitId] of user.scopeUnits.politicalUnitIds.entries()) {
        const parameter = `${parameterPrefix}PoliticalUnit${index}`;
        parameters[parameter] = politicalUnitId;
        sources.push(
          `SELECT political_mapping.polling_unit_id
           FROM pu_political_unit political_mapping
           WHERE political_mapping.political_unit_id = :${parameter}`,
        );
      }

      queryBuilder.andWhere(
        `${pollingUnitColumn} IN (${sources.join("\nUNION\n")})`,
        parameters,
      );
    },
  };
}

function addScopeSources(
  sources: string[],
  parameters: Record<string, number>,
  ids: number[],
  parameterPrefix: string,
  level: "state" | "lga" | "ward",
): void {
  for (const [index, id] of ids.entries()) {
    const parameter = `${parameterPrefix}${level}${index}`;
    parameters[parameter] = id;

    if (level === "state") {
      sources.push(
        `SELECT state_polling_unit.id
         FROM polling_unit state_polling_unit
         JOIN ward state_ward ON state_ward.id = state_polling_unit.ward_id
         JOIN lga state_lga ON state_lga.id = state_ward.lga_id
         WHERE state_lga.state_id = :${parameter}`,
      );
    } else if (level === "lga") {
      sources.push(
        `SELECT lga_polling_unit.id
         FROM polling_unit lga_polling_unit
         JOIN ward lga_ward ON lga_ward.id = lga_polling_unit.ward_id
         WHERE lga_ward.lga_id = :${parameter}`,
      );
    } else {
      sources.push(
        `SELECT ward_polling_unit.id
         FROM polling_unit ward_polling_unit
         WHERE ward_polling_unit.ward_id = :${parameter}`,
      );
    }
  }
}
