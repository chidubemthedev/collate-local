import type { EntityManager } from "typeorm";
import { AuditLog } from "../db/entities/audit-log.entity";
import { Broadcast, BroadcastStatus } from "../db/entities/broadcast.entity";
import { ForbiddenError } from "../policy/errors";
import { resolveManager } from "../policy/core/database";
import { getScope } from "../policy/core/scope";
import type { PolicyUser } from "../policy/core/policy-user";
import { createBroadcastSchema } from "./schemas";
import type { CreateBroadcastInput } from "./schemas";

export interface CreatedBroadcast {
  id: string;
  status: BroadcastStatus;
}

export async function createBroadcast(
  user: PolicyUser,
  input: CreateBroadcastInput,
  manager?: EntityManager,
): Promise<CreatedBroadcast> {
  if (getScope(user).kind === "none") {
    throw new ForbiddenError();
  }

  const parsed = createBroadcastSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Invalid broadcast input");
  }

  const entityManager = await resolveManager(manager);
  const scheduledSendAt = parsed.data.scheduledSendAt
    ? new Date(parsed.data.scheduledSendAt)
    : null;
  const status = scheduledSendAt
    ? BroadcastStatus.SCHEDULED
    : BroadcastStatus.SENDING;

  const created = await entityManager.transaction(async (transactionManager) => {
    const repository = transactionManager.getRepository(Broadcast);
    const broadcast = repository.create({
      senderPersonId: user.personId,
      audienceFilter: parsed.data.audienceFilter,
      messageText: parsed.data.messageText,
      scheduledSendAt,
      broadcastStatus: status,
    });
    await repository.save(broadcast);

    await transactionManager.getRepository(AuditLog).insert({
      actorPersonId: user.personId,
      actionType: "create_broadcast",
      targetEntityType: "broadcast",
      targetEntityId: broadcast.id,
      ipAddress: null,
    });

    return broadcast;
  });

  const { enqueue } = await import("../queue");
  await enqueue(
    "broadcast-resolve",
    { broadcastId: created.id },
    {
      singletonKey: created.id,
      ...(scheduledSendAt ? { startAfter: scheduledSendAt } : {}),
    },
  );

  return { id: created.id, status: created.broadcastStatus };
}
