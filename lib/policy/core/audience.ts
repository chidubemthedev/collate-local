import type { EntityManager, SelectQueryBuilder } from "typeorm";
import { AgentAssignment } from "../../db/entities/agent-assignment.entity";
import { Broadcast } from "../../db/entities/broadcast.entity";
import { InvalidFilterError } from "../../policy/errors";
import { resolveManager } from "../../policy/core/database";
import { getScope } from "../../policy/core/scope";
import { getVisibleOwners } from "../../policy/core/owners";
import { loadPolicyUser as loadPolicyUserCore } from "../../policy/core/policy-user";
import type { PolicyUser } from "../../policy/core/policy-user";
import { audienceFilterSchema } from "../../broadcast/schemas";
import type { AudienceFilter, AudienceFilterInput } from "../../broadcast/schemas";

export interface AudienceCounts {
  officialCount: number;
  extraCount: number;
}

const LATEST_CONSENT_DECLINED = (personColumn: string) => `
  NOT EXISTS (
    SELECT 1
    FROM (
      SELECT DISTINCT ON (latest_consent.person_id)
        latest_consent.person_id,
        latest_consent.is_accepted
      FROM consent latest_consent
      ORDER BY latest_consent.person_id, latest_consent.created_at DESC, latest_consent.id DESC
    ) newest_consent
    WHERE newest_consent.person_id = ${personColumn}
      AND newest_consent.is_accepted = FALSE
  )
`;

export function validateAudienceFilter(
  user: PolicyUser,
  filter: AudienceFilter,
): void {
  // ASSUMPTION: non-admin candidates cannot use LGA filters; they can filter by political unit or ward.
  if (user.candidateId !== null && !user.isAdmin && filter.lgaId !== undefined) {
    throw new InvalidFilterError();
  }
}

function applyAudienceFilter(
  query: SelectQueryBuilder<AgentAssignment>,
  filter: AudienceFilter,
): void {
  if (filter.stateId !== undefined) {
    query.andWhere("state.id = :audienceStateId", {
      audienceStateId: filter.stateId,
    });
  }
  if (filter.lgaId !== undefined) {
    query.andWhere("lga.id = :audienceLgaId", {
      audienceLgaId: filter.lgaId,
    });
  }
  if (filter.wardId !== undefined) {
    query.andWhere("ward.id = :audienceWardId", {
      audienceWardId: filter.wardId,
    });
  }
  if (filter.pollingUnitId !== undefined) {
    query.andWhere("pollingUnit.id = :audiencePollingUnitId", {
      audiencePollingUnitId: filter.pollingUnitId,
    });
  }
  if (filter.verificationStatus !== undefined) {
    query.andWhere("person.verificationStatus = :audienceVerificationStatus", {
      audienceVerificationStatus: filter.verificationStatus,
    });
  }
  if (filter.politicalUnitId !== undefined) {
    query.andWhere(
      `EXISTS (
        SELECT 1
        FROM pu_political_unit audience_political_mapping
        WHERE audience_political_mapping.polling_unit_id = pollingUnit.id
          AND audience_political_mapping.political_unit_id = :audiencePoliticalUnitId
      )`,
      { audiencePoliticalUnitId: filter.politicalUnitId },
    );
  }
  if (filter.ownerGroupId !== undefined) {
    query.andWhere("assignment.ownerGroupId = :audienceOwnerGroupId", {
      audienceOwnerGroupId: filter.ownerGroupId,
    });
  }
  if (filter.agentKind !== "all") {
    query.andWhere("assignment.agentKind = :audienceAgentKind", {
      audienceAgentKind: filter.agentKind,
    });
  }
  if (filter.officeId !== undefined) {
    query
      .innerJoin("assignment.ownerCandidate", "audienceOwnerCandidate")
      .innerJoin("audienceOwnerCandidate.seat", "audienceSeat")
      .andWhere("audienceSeat.officeId = :audienceOfficeId", {
        audienceOfficeId: filter.officeId,
      });
  }
}

function baseRecipientQuery(
  manager: EntityManager,
  user: PolicyUser,
  filter: AudienceFilter,
): SelectQueryBuilder<AgentAssignment> {
  const query = manager
    .getRepository(AgentAssignment)
    .createQueryBuilder("assignment")
    .innerJoin("assignment.person", "person")
    .innerJoin("assignment.pollingUnit", "pollingUnit")
    .innerJoin("pollingUnit.ward", "ward")
    .innerJoin("ward.lga", "lga")
    .innerJoin("lga.state", "state")
    .leftJoin("assignment.ownerGroup", "ownerGroup")
    .leftJoin("assignment.ownerCandidate", "ownerCandidate")
    .where(LATEST_CONSENT_DECLINED("person.id"));

  getScope(user, manager).apply(query, "pollingUnit.id");
  getVisibleOwners(user, manager).apply(query, "assignment.ownerGroupId");
  applyAudienceFilter(query, filter);

  return query;
}

function shiftParameters(sql: string, offset: number): string {
  return sql.replace(/\$(\d+)/g, (_match, index: string) => `$${Number(index) + offset}`);
}

export async function previewAudience(
  user: PolicyUser,
  filter: AudienceFilterInput,
  manager?: EntityManager,
): Promise<AudienceCounts> {
  const parsed = audienceFilterSchema.safeParse(filter);
  if (!parsed.success) {
    throw new InvalidFilterError();
  }
  validateAudienceFilter(user, parsed.data);

  const entityManager = await resolveManager(manager);
  const query = baseRecipientQuery(entityManager, user, parsed.data)
    .select("person.id", "personId")
    .addSelect(
      "MIN(CASE WHEN assignment.agentKind = 'official' THEN 0 ELSE 1 END)",
      "agentRank",
    )
    .groupBy("person.id");
  const [recipientSql, recipientParameters] = query.getQueryAndParameters();

  const rows = await entityManager.query<Array<{
    officialCount: number | string;
    extraCount: number | string;
  }>>(
    `
      SELECT
        COUNT(*) FILTER (WHERE recipients."agentRank" = 0)::int AS "officialCount",
        COUNT(*) FILTER (WHERE recipients."agentRank" = 1)::int AS "extraCount"
      FROM (${recipientSql}) AS recipients;
    `,
    recipientParameters,
  );
  const row = rows[0];

  return {
    officialCount: Number(row?.officialCount ?? 0),
    extraCount: Number(row?.extraCount ?? 0),
  };
}

export async function materializeDeliveries(
  broadcastId: string,
  manager?: EntityManager,
): Promise<number> {
  const entityManager = await resolveManager(manager);

  const run = async (transactionManager: EntityManager): Promise<number> => {
    const broadcast = await transactionManager.getRepository(Broadcast).findOne({
      where: { id: broadcastId },
    });
    if (!broadcast) {
      return 0;
    }

    const parsed = audienceFilterSchema.safeParse(broadcast.audienceFilter);
    if (!parsed.success) {
      throw new InvalidFilterError();
    }

    const user = await loadPolicyUserCore(
      broadcast.senderPersonId,
      transactionManager,
    );
    validateAudienceFilter(user, parsed.data);

    // TODO(decision): candidate recipients.
    const recipients = baseRecipientQuery(
      transactionManager,
      user,
      parsed.data,
    ).select("DISTINCT person.id", "personId");
    const [recipientSql, recipientParameters] = recipients.getQueryAndParameters();

    await transactionManager.query(
      `
        INSERT INTO delivery (broadcast_id, person_id, delivery_channel, delivery_status)
        SELECT DISTINCT $1::uuid, recipients.person_id, 'telegram'::delivery_channel, 'pending'::delivery_status
        FROM (${shiftParameters(recipientSql, 1)}) AS recipients(person_id)
        ON CONFLICT (broadcast_id, person_id) DO NOTHING;
      `,
      [broadcastId, ...recipientParameters],
    );

    const countRow = (await transactionManager.query(
      `SELECT COUNT(*)::int AS count FROM delivery WHERE broadcast_id = $1::uuid;`,
      [broadcastId],
    )) as Array<{ count: number | string }>;

    return Number(countRow[0]?.count ?? 0);
  };

  if (entityManager.queryRunner?.isTransactionActive) {
    return run(entityManager);
  }
  return entityManager.transaction(run);
}
