import type { EntityManager } from "typeorm";
import { AuditLog } from "../../../db/entities/audit-log.entity";
import { Consent } from "../../../db/entities/consent.entity";
import { PhoneNumber } from "../../../db/entities/phone-number.entity";
import { resolveManager } from "../../../policy/core/database";
import { CONSENT_TEXT_VERSION } from "../consent-text";

export type LinkResult =
  | { result: "no_match" }
  | { result: "already_linked"; personId: string }
  | { result: "conflict" }
  | { result: "linked"; personId: string };

async function inTransaction<T>(
  manager: EntityManager | undefined,
  run: (entityManager: EntityManager) => Promise<T>,
): Promise<T> {
  const entityManager = await resolveManager(manager);
  if (entityManager.queryRunner?.isTransactionActive) {
    return run(entityManager);
  }
  return entityManager.transaction(run);
}

export async function linkChatToPerson(
  { e164, chatId }: { e164: string; chatId: string | number },
  manager?: EntityManager,
): Promise<LinkResult> {
  const chatIdValue = String(chatId);

  return inTransaction(manager, async (entityManager) => {
    const phoneRepository = entityManager.getRepository(PhoneNumber);
    const phone = await phoneRepository.findOne({
      where: { e164Number: e164 },
      lock: { mode: "pessimistic_write" },
    });

    if (!phone) {
      return { result: "no_match" };
    }

    const personId = phone.personId;
    const existingChat = await phoneRepository.findOne({
      where: { telegramChatId: chatIdValue },
    });

    if (existingChat) {
      if (existingChat.personId === personId) {
        return { result: "already_linked", personId };
      }

      await entityManager.getRepository(AuditLog).insert({
        actorPersonId: personId,
        actionType: "telegram_link_conflict",
        targetEntityType: "person",
        targetEntityId: personId,
        ipAddress: null,
      });
      return { result: "conflict" };
    }

    const linkedElsewhere =
      (phone.telegramChatId !== null && phone.telegramChatId !== chatIdValue) ||
      (await phoneRepository
        .createQueryBuilder("phone")
        .where("phone.personId = :personId", { personId })
        .andWhere("phone.telegramChatId IS NOT NULL")
        .andWhere("phone.telegramChatId <> :chatIdValue", { chatIdValue })
        .getExists());

    if (linkedElsewhere) {
      await entityManager.getRepository(AuditLog).insert({
        actorPersonId: personId,
        actionType: "telegram_link_conflict",
        targetEntityType: "person",
        targetEntityId: personId,
        ipAddress: null,
      });
      return { result: "conflict" };
    }

    await phoneRepository.update(phone.id, {
      telegramChatId: chatIdValue,
      // ASSUMPTION: a number shared through Telegram's verified contact counts as confirmed.
      isConfirmed: true,
    });

    await entityManager.getRepository(AuditLog).insert({
      actorPersonId: personId,
      actionType: "telegram_linked",
      targetEntityType: "person",
      targetEntityId: personId,
      ipAddress: null,
    });

    return { result: "linked", personId };
  });
}

export async function findPersonByChatId(
  chatId: string | number,
  manager?: EntityManager,
): Promise<string | null> {
  const entityManager = await resolveManager(manager);
  const phone = await entityManager.getRepository(PhoneNumber).findOne({
    where: { telegramChatId: String(chatId) },
  });
  return phone?.personId ?? null;
}

async function newestConsent(
  personId: string,
  entityManager: EntityManager,
): Promise<Consent | null> {
  return entityManager
    .getRepository(Consent)
    .createQueryBuilder("consent")
    .where("consent.personId = :personId", { personId })
    .orderBy("consent.createdAt", "DESC")
    .addOrderBy("consent.id", "DESC")
    .getOne();
}

export async function hasAcceptedConsent(
  personId: string,
  manager?: EntityManager,
): Promise<boolean> {
  const entityManager = await resolveManager(manager);
  const consent = await newestConsent(personId, entityManager);
  return consent?.consentTextVersion === CONSENT_TEXT_VERSION && consent.isAccepted;
}

export async function recordConsent(
  { personId, accepted }: { personId: string; accepted: boolean },
  manager?: EntityManager,
): Promise<void> {
  await inTransaction(manager, async (entityManager) => {
    const newest = await newestConsent(personId, entityManager);
    if (
      newest?.consentTextVersion === CONSENT_TEXT_VERSION &&
      newest.isAccepted === accepted
    ) {
      return;
    }

    await entityManager.query(
      `
        INSERT INTO consent (person_id, consent_text_version, is_accepted, created_at)
        VALUES ($1::uuid, $2, $3, clock_timestamp());
      `,
      [personId, CONSENT_TEXT_VERSION, accepted],
    );

    await entityManager.getRepository(AuditLog).insert({
      actorPersonId: personId,
      actionType: "consent_recorded",
      targetEntityType: "person",
      targetEntityId: personId,
      ipAddress: null,
    });
  });
}
