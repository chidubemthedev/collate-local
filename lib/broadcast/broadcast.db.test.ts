import "dotenv/config";
import { randomUUID } from "node:crypto";
import type { DataSource, EntityManager, QueryRunner } from "typeorm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  findPersonByChatId,
  hasAcceptedConsent,
  linkChatToPerson,
  recordConsent,
} from "../channels/telegram/link/link";
import { applyOk } from "../channels/telegram/ok";
import { NotConfiguredSmsChannel } from "../channels/sms/not-configured";
import type { SmsChannel } from "../channels/sms/channel";
import {
  TelegramBlockedError,
  TelegramRateLimitedError,
} from "../channels/telegram/errors";
import { loadPolicyUser } from "../policy/core/policy-user";
import {
  materializeDeliveries,
  previewAudience,
} from "../policy/core/audience";
import { InvalidFilterError } from "../policy/errors";
import { sendDelivery } from "../../worker/jobs/delivery-send";

vi.setConfig({ hookTimeout: 60_000, testTimeout: 60_000 });

const requested = process.env.RUN_DB_TESTS === "true";
if (requested && process.env.NODE_ENV === "production") {
  throw new Error("Broadcast database tests cannot run in production.");
}
const shouldRun = requested && Boolean(process.env.DATABASE_URL);

interface Fixtures {
  adminPersonId: string;
  senderPersonId: string;
  linkAgentPersonId: string;
  extraAgentPersonId: string;
  candidatePersonId: string;
  runningMatePersonId: string;
  declinedAgentPersonId: string;
  noConsentAgentPersonId: string;
  kanoAgentPersonId: string;
  hiddenOwnerAgentPersonId: string;
  consentAgentPersonId: string;
  officialAgentPersonId: string;
  lagosStateId: number;
  kanoStateId: number;
  lagosWardId: number;
  kanoWardId: number;
  lagosPu1: number;
  kanoPu1: number;
  kanoStateIdForFilter: number;
  ownerLagosGroupId: number;
  linkPhone: string;
  officialPhone: string;
  extraPhone: string;
  candidatePhone: string;
  runningMatePhone: string;
  kanoPhone: string;
  hiddenOwnerPhone: string;
  declinedPhone: string;
  noConsentPhone: string;
  consentPhone: string;
  officialChatId: string;
  extraChatId: string;
  candidateChatId: string;
  runningMateChatId: string;
  kanoChatId: string;
  hiddenOwnerChatId: string;
}

let dataSource: DataSource | undefined;
let queryRunner: QueryRunner | undefined;
let manager: EntityManager | undefined;
let fixtures: Fixtures | undefined;

describe.skipIf(!shouldRun)("broadcast database integration", () => {
  beforeAll(async () => {
    const database = await import("../db/data-source");
    dataSource = database.default;
    dataSource.setOptions({ logging: false, migrations: [] });
    await dataSource.initialize();
    queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    manager = queryRunner.manager;
    fixtures = await createFixtures(manager);
  });

  afterAll(async () => {
    try {
      if (queryRunner?.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
    } finally {
      if (queryRunner && !queryRunner.isReleased) {
        await queryRunner.release();
      }
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    }
  });

  it("links a matched number, confirms it and is idempotent", async () => {
    const { linkAgentPersonId, linkPhone } = requireFixtures();
    const first = await linkChatToPerson(
      { e164: linkPhone, chatId: "910001" },
      requireManager(),
    );
    expect(first).toEqual({ result: "linked", personId: linkAgentPersonId });

    const rows = (await requireManager().query(
      "SELECT telegram_chat_id, is_confirmed FROM phone_number WHERE e164_number = $1",
      [linkPhone],
    )) as Array<{ telegram_chat_id: string | null; is_confirmed: boolean }>;
    expect(rows[0]).toEqual({
      telegram_chat_id: "910001",
      is_confirmed: true,
    });
    expect(await findPersonByChatId("910001", requireManager())).toBe(
      linkAgentPersonId,
    );

    const repeat = await linkChatToPerson(
      { e164: linkPhone, chatId: "910001" },
      requireManager(),
    );
    expect(repeat).toEqual({
      result: "already_linked",
      personId: linkAgentPersonId,
    });

    const audits = (await requireManager().query(
      "SELECT COUNT(*)::int AS count FROM audit_log WHERE action_type = 'telegram_linked' AND target_entity_id = $1",
      [linkAgentPersonId],
    )) as Array<{ count: number }>;
    expect(Number(audits[0]?.count)).toBe(1);
  });

  it("writes nothing for an unknown number and nothing on a chat conflict", async () => {
    const { linkAgentPersonId, extraPhone, linkPhone } = requireFixtures();
    const unknown = await linkChatToPerson(
      { e164: "+2340000009999", chatId: "910002" },
      requireManager(),
    );
    expect(unknown.result).toBe("no_match");

    const conflict = await linkChatToPerson(
      { e164: linkPhone, chatId: "920001" },
      requireManager(),
    );
    expect(conflict.result).toBe("conflict");

    const linkRow = (await requireManager().query(
      "SELECT telegram_chat_id FROM phone_number WHERE e164_number = $1",
      [linkPhone],
    )) as Array<{ telegram_chat_id: string | null }>;
    expect(linkRow[0]?.telegram_chat_id).toBe("910001");

    const extraRow = (await requireManager().query(
      "SELECT telegram_chat_id FROM phone_number WHERE e164_number = $1",
      [extraPhone],
    )) as Array<{ telegram_chat_id: string | null }>;
    expect(extraRow[0]?.telegram_chat_id).toBe("920001");

    const conflicts = (await requireManager().query(
      "SELECT COUNT(*)::int AS count FROM audit_log WHERE action_type = 'telegram_link_conflict' AND target_entity_id = $1",
      [linkAgentPersonId],
    )) as Array<{ count: number }>;
    expect(Number(conflicts[0]?.count)).toBe(1);
  });

  it("records consent once per version and answer, and uses the newest row", async () => {
    const { consentAgentPersonId } = requireFixtures();
    expect(
      await hasAcceptedConsent(consentAgentPersonId, requireManager()),
    ).toBe(false);

    await recordConsent(
      { personId: consentAgentPersonId, accepted: true },
      requireManager(),
    );
    await recordConsent(
      { personId: consentAgentPersonId, accepted: true },
      requireManager(),
    );
    expect(
      await hasAcceptedConsent(consentAgentPersonId, requireManager()),
    ).toBe(true);

    const afterAccept = (await requireManager().query(
      "SELECT COUNT(*)::int AS count FROM consent WHERE person_id = $1",
      [consentAgentPersonId],
    )) as Array<{ count: number }>;
    expect(Number(afterAccept[0]?.count)).toBe(1);

    await recordConsent(
      { personId: consentAgentPersonId, accepted: false },
      requireManager(),
    );
    expect(
      await hasAcceptedConsent(consentAgentPersonId, requireManager()),
    ).toBe(false);

    const afterDecline = (await requireManager().query(
      "SELECT COUNT(*)::int AS count FROM consent WHERE person_id = $1",
      [consentAgentPersonId],
    )) as Array<{ count: number }>;
    expect(Number(afterDecline[0]?.count)).toBe(2);
  });

  it("counts the sender's visible audience with official and extra kept separate", async () => {
    const {
      adminPersonId,
      senderPersonId,
      kanoStateIdForFilter,
      ownerLagosGroupId,
      lagosStateId,
    } = requireFixtures();
    const sender = await loadPolicyUser(senderPersonId, requireManager());
    const admin = await loadPolicyUser(adminPersonId, requireManager());

    expect(await previewAudience(sender, {}, requireManager())).toEqual({
      officialCount: 1,
      extraCount: 3,
    });
    expect(
      await previewAudience(admin, { stateId: lagosStateId }, requireManager()),
    ).toEqual({
      officialCount: 1,
      extraCount: 4,
    });
    expect(
      await previewAudience(sender, { agentKind: "official" }, requireManager()),
    ).toEqual({ officialCount: 1, extraCount: 0 });
    expect(
      await previewAudience(
        sender,
        { ownerGroupId: ownerLagosGroupId },
        requireManager(),
      ),
    ).toEqual({ officialCount: 1, extraCount: 3 });
    expect(
      await previewAudience(sender, { stateId: kanoStateIdForFilter }, requireManager()),
    ).toEqual({ officialCount: 0, extraCount: 0 });
  });

  it("rejects an LGA filter for a candidate-only user", async () => {
    const { candidatePersonId } = requireFixtures();
    const candidate = await loadPolicyUser(candidatePersonId, requireManager());
    await expect(
      previewAudience(candidate, { lgaId: 1 }, requireManager()),
    ).rejects.toBeInstanceOf(InvalidFilterError);
  });

  it("applies polling unit and verification filters without revealing out-of-scope units", async () => {
    const {
      adminPersonId,
      senderPersonId,
      extraAgentPersonId,
      lagosPu1,
      kanoPu1,
      kanoWardId,
    } = requireFixtures();
    const admin = await loadPolicyUser(adminPersonId, requireManager());
    const sender = await loadPolicyUser(senderPersonId, requireManager());

    expect(
      await previewAudience(admin, { pollingUnitId: lagosPu1 }, requireManager()),
    ).toEqual({ officialCount: 1, extraCount: 3 });
    expect(
      await previewAudience(sender, { pollingUnitId: kanoPu1 }, requireManager()),
    ).toEqual({ officialCount: 0, extraCount: 0 });
    expect(
      await previewAudience(sender, { wardId: kanoWardId }, requireManager()),
    ).toEqual({ officialCount: 0, extraCount: 0 });

    await requireManager().query(
      "UPDATE person SET verification_status = 'rejected' WHERE id = $1::uuid",
      [extraAgentPersonId],
    );
    expect(
      await previewAudience(
        admin,
        { stateId: requireFixtures().lagosStateId, verificationStatus: "rejected" },
        requireManager(),
      ),
    ).toEqual({ officialCount: 0, extraCount: 1 });
    expect(
      await previewAudience(
        admin,
        {
          stateId: requireFixtures().lagosStateId,
          wardId: requireFixtures().lagosWardId,
          pollingUnitId: lagosPu1,
          verificationStatus: "rejected",
        },
        requireManager(),
      ),
    ).toEqual({ officialCount: 0, extraCount: 1 });
    await requireManager().query(
      "UPDATE person SET verification_status = 'verified' WHERE id = $1::uuid",
      [extraAgentPersonId],
    );
  });

  it("materializes only eligible agent recipients and matches the preview count", async () => {
    const {
      senderPersonId,
      officialAgentPersonId,
      extraAgentPersonId,
      candidatePersonId,
      runningMatePersonId,
      declinedAgentPersonId,
      noConsentAgentPersonId,
      kanoAgentPersonId,
      hiddenOwnerAgentPersonId,
    } = requireFixtures();
    const preview = await previewAudience(
      await loadPolicyUser(senderPersonId, requireManager()),
      {},
      requireManager(),
    );
    const broadcastId = await createBroadcastFixture(
      senderPersonId,
      {},
      requireManager(),
    );

    const count = await materializeDeliveries(broadcastId, requireManager());
    expect(count).toBe(4);
    expect(count).toBe(preview.officialCount + preview.extraCount);

    const rows = (await requireManager().query(
      "SELECT person_id FROM delivery WHERE broadcast_id = $1::uuid",
      [broadcastId],
    )) as Array<{ person_id: string }>;
    const personIds = rows.map((row) => row.person_id);
    expect(new Set(personIds)).toEqual(
      new Set([
        officialAgentPersonId,
        extraAgentPersonId,
        candidatePersonId,
        noConsentAgentPersonId,
      ]),
    );
    expect(personIds.filter((id) => id === extraAgentPersonId)).toHaveLength(1);
    expect(personIds).not.toContain(declinedAgentPersonId);
    expect(personIds).not.toContain(kanoAgentPersonId);
    expect(personIds).not.toContain(hiddenOwnerAgentPersonId);
    expect(personIds).not.toContain(runningMatePersonId);

    const repeat = await materializeDeliveries(broadcastId, requireManager());
    expect(repeat).toBe(4);
  });

  it("sends successfully, marks the broadcast completed and skips terminal rows", async () => {
    const { candidatePersonId, candidateChatId } = requireFixtures();
    const broadcastId = await createBroadcastFixture(
      requireFixtures().senderPersonId,
      {},
      requireManager(),
    );
    const deliveryId = await createDeliveryFixture(
      broadcastId,
      candidatePersonId,
      requireManager(),
    );
    const telegramSend = vi.fn(async () => ({ providerMessageId: "1" }));
    const limiter = createLimiter();

    await sendDelivery(deliveryId, {
      manager: requireManager(),
      telegram: { send: telegramSend },
      sms: new NotConfiguredSmsChannel(),
      limiter,
      attempt: { retryCount: 0, retryLimit: 5 },
    });

    expect(telegramSend).toHaveBeenCalledTimes(1);
    const delivery = await readDelivery(deliveryId, requireManager());
    expect(delivery.delivery_status).toBe("delivered");
    expect(delivery.sent_at).not.toBeNull();
    expect(delivery.delivered_at).not.toBeNull();
    expect(delivery.delivery_channel).toBe("telegram");

    const broadcast = await readBroadcast(broadcastId, requireManager());
    expect(broadcast.broadcast_status).toBe("completed");

    const secondSend = vi.fn(async () => ({ providerMessageId: "2" }));
    await sendDelivery(deliveryId, {
      manager: requireManager(),
      telegram: { send: secondSend },
      sms: new NotConfiguredSmsChannel(),
      limiter,
      attempt: { retryCount: 0, retryLimit: 5 },
    });
    expect(secondSend).not.toHaveBeenCalled();
    expect(candidateChatId).toBe("940001");
  });

  it("falls back to SMS when Telegram is blocked, and fails when SMS is not configured", async () => {
    const { kanoAgentPersonId } = requireFixtures();
    const broadcastId = await createBroadcastFixture(
      requireFixtures().senderPersonId,
      {},
      requireManager(),
    );
    const deliveryId = await createDeliveryFixture(
      broadcastId,
      kanoAgentPersonId,
      requireManager(),
    );

    await sendDelivery(deliveryId, {
      manager: requireManager(),
      telegram: {
        send: async () => {
          throw new TelegramBlockedError();
        },
      },
      sms: new NotConfiguredSmsChannel(),
      limiter: createLimiter(),
      attempt: { retryCount: 0, retryLimit: 5 },
    });

    const delivery = await readDelivery(deliveryId, requireManager());
    expect(delivery.delivery_status).toBe("failed");
    expect(delivery.delivery_channel).toBe("sms");
    expect(delivery.failed_at).not.toBeNull();

    const broadcast = await readBroadcast(broadcastId, requireManager());
    expect(broadcast.broadcast_status).toBe("failed");
  });

  it("uses SMS successfully and records delivered_by_sms", async () => {
    const { hiddenOwnerAgentPersonId } = requireFixtures();
    const broadcastId = await createBroadcastFixture(
      requireFixtures().senderPersonId,
      {},
      requireManager(),
    );
    const deliveryId = await createDeliveryFixture(
      broadcastId,
      hiddenOwnerAgentPersonId,
      requireManager(),
    );
    const sms: SmsChannel = {
      send: async () => ({ providerMessageId: "sms-1" }),
    };

    await sendDelivery(deliveryId, {
      manager: requireManager(),
      telegram: {
        send: async () => {
          throw new TelegramBlockedError();
        },
      },
      sms,
      limiter: createLimiter(),
      attempt: { retryCount: 0, retryLimit: 5 },
    });

    const delivery = await readDelivery(deliveryId, requireManager());
    expect(delivery.delivery_status).toBe("delivered_by_sms");
    expect(delivery.delivery_channel).toBe("sms");
    expect(delivery.delivered_at).not.toBeNull();
  });

  it("pauses the limiter and rethrows on a rate limit", async () => {
    const { runningMatePersonId } = requireFixtures();
    const broadcastId = await createBroadcastFixture(
      requireFixtures().senderPersonId,
      {},
      requireManager(),
    );
    const deliveryId = await createDeliveryFixture(
      broadcastId,
      runningMatePersonId,
      requireManager(),
    );
    const limiter = createLimiter();

    await expect(
      sendDelivery(deliveryId, {
        manager: requireManager(),
        telegram: {
          send: async () => {
            throw new TelegramRateLimitedError(2);
          },
        },
        sms: new NotConfiguredSmsChannel(),
        limiter,
        attempt: { retryCount: 0, retryLimit: 5 },
      }),
    ).rejects.toBeInstanceOf(TelegramRateLimitedError);

    expect(limiter.pause).toHaveBeenCalledWith(2);
    const delivery = await readDelivery(deliveryId, requireManager());
    expect(delivery.delivery_status).toBe("sent");
    const broadcast = await readBroadcast(broadcastId, requireManager());
    expect(broadcast.broadcast_status).toBe("sending");
  });

  it("applies OK only from the recipient's linked chat", async () => {
    const { officialAgentPersonId } = requireFixtures();
    const broadcastId = await createBroadcastFixture(
      requireFixtures().senderPersonId,
      {},
      requireManager(),
    );
    const deliveryId = await createDeliveryFixture(
      broadcastId,
      officialAgentPersonId,
      requireManager(),
    );
    await requireManager().query(
      "UPDATE delivery SET delivery_status = 'delivered', delivered_at = NOW() WHERE id = $1::uuid",
      [deliveryId],
    );

    expect(
      await applyOk({ deliveryId, chatId: "999999" }, requireManager()),
    ).toBe(false);
    expect((await readDelivery(deliveryId, requireManager())).delivery_status).toBe(
      "delivered",
    );

    expect(
      await applyOk({ deliveryId, chatId: "930001" }, requireManager()),
    ).toBe(true);
    expect((await readDelivery(deliveryId, requireManager())).delivery_status).toBe(
      "tapped_ok",
    );

    expect(
      await applyOk({ deliveryId, chatId: "930001" }, requireManager()),
    ).toBe(true);

    const failedId = await createDeliveryFixture(
      broadcastId,
      requireFixtures().consentAgentPersonId,
      requireManager(),
    );
    await requireManager().query(
      "UPDATE delivery SET delivery_status = 'failed', failed_at = NOW() WHERE id = $1::uuid",
      [failedId],
    );
    await requireManager().query(
      "UPDATE phone_number SET telegram_chat_id = '930003' WHERE e164_number = $1",
      [requireFixtures().consentPhone],
    );
    expect(
      await applyOk({ deliveryId: failedId, chatId: "930003" }, requireManager()),
    ).toBe(false);
    expect((await readDelivery(failedId, requireManager())).delivery_status).toBe(
      "failed",
    );
  });
});

async function createFixtures(entityManager: EntityManager): Promise<Fixtures> {
  const key = randomUUID().slice(0, 8);

  const states = await insertRows<{ id: number }>(
    entityManager,
    "state",
    ["inec_state_code", "state_name"],
    [
      [`80${key}`, `Broadcast Lagos ${key}`],
      [`82${key}`, `Broadcast Kano ${key}`],
    ],
  );
  const lagosStateId = Number(states[0].id);
  const kanoStateId = Number(states[1].id);

  const lgas = await insertRows<{ id: number }>(
    entityManager,
    "lga",
    ["state_id", "inec_lga_code", "lga_name"],
    [
      [lagosStateId, `80${key}1`, `Broadcast Lagos LGA ${key}`],
      [kanoStateId, `82${key}1`, `Broadcast Kano LGA ${key}`],
    ],
  );
  const lagosLgaId = Number(lgas[0].id);
  const kanoLgaId = Number(lgas[1].id);

  const wards = await insertRows<{ id: number }>(
    entityManager,
    "ward",
    ["lga_id", "inec_ward_code", "ward_name"],
    [
      [lagosLgaId, `W${key}L`, `Broadcast Lagos Ward ${key}`],
      [kanoLgaId, `W${key}K`, `Broadcast Kano Ward ${key}`],
    ],
  );
  const lagosWardId = Number(wards[0].id);
  const kanoWardId = Number(wards[1].id);

  const pollingUnits = await insertRows<{ id: number }>(
    entityManager,
    "polling_unit",
    ["inec_polling_unit_code", "polling_unit_name", "ward_id"],
    [
      [`P${key}L1`, `Broadcast Lagos PU 1 ${key}`, lagosWardId],
      [`P${key}L2`, `Broadcast Lagos PU 2 ${key}`, lagosWardId],
      [`P${key}K1`, `Broadcast Kano PU 1 ${key}`, kanoWardId],
    ],
  );
  const lagosPu1 = Number(pollingUnits[0].id);
  const lagosPu2 = Number(pollingUnits[1].id);
  const kanoPu1 = Number(pollingUnits[2].id);

  const politicalUnits = await insertRows<{ id: number }>(
    entityManager,
    "political_unit",
    ["political_unit_name", "political_unit_type", "parent_political_unit_id"],
    [
      [`Broadcast Lagos PU ${key}`, "state", null],
      [`Broadcast Kano PU ${key}`, "state", null],
    ],
  );
  const lagosPoliticalUnitId = Number(politicalUnits[0].id);
  const kanoPoliticalUnitId = Number(politicalUnits[1].id);

  await insertRows(
    entityManager,
    "pu_political_unit",
    ["political_unit_id", "polling_unit_id"],
    [
      [lagosPoliticalUnitId, lagosPu1],
      [lagosPoliticalUnitId, lagosPu2],
      [kanoPoliticalUnitId, kanoPu1],
    ],
    "",
  );

  const offices = await insertRows<{ id: number }>(
    entityManager,
    "office",
    ["office_name", "hierarchy_level", "political_unit_type"],
    [[`Broadcast Office ${key}`, 1, "state"]],
  );
  const seats = await insertRows<{ id: number }>(
    entityManager,
    "seat",
    ["office_id", "political_unit_id"],
    [[Number(offices[0].id), lagosPoliticalUnitId]],
  );

  const typeId = await groupTypeIds(entityManager);
  const groups = await insertRows<{ id: number }>(
    entityManager,
    "groups",
    ["group_name", "group_type_id"],
    [
      [`Broadcast Admin ${key}`, typeId.admin],
      // Limited to an area: a campaign group, since a Party-type group sees the whole country.
      [`Broadcast Viewer ${key}`, typeId.campaign],
      [`Broadcast Owner Lagos ${key}`, typeId.party],
      [`Broadcast Owner Kano ${key}`, typeId.party],
      [`Broadcast Hidden Owner ${key}`, typeId.party],
    ],
  );
  const adminGroupId = Number(groups[0].id);
  const viewerGroupId = Number(groups[1].id);
  const ownerLagosGroupId = Number(groups[2].id);
  const ownerKanoGroupId = Number(groups[3].id);
  const hiddenOwnerGroupId = Number(groups[4].id);

  const people = await insertRows<{ id: string }>(
    entityManager,
    "person",
    ["email_address", "full_name", "verification_status"],
    [
      [`broadcast-admin-${key}@demo.collate.test`, `Broadcast Admin ${key}`, "verified"],
      [`broadcast-sender-${key}@demo.collate.test`, `Broadcast Sender ${key}`, "verified"],
      [`broadcast-link-${key}@demo.collate.test`, `Broadcast Link ${key}`, "verified"],
      [`broadcast-extra-${key}@demo.collate.test`, `Broadcast Extra ${key}`, "verified"],
      [`broadcast-candidate-${key}@demo.collate.test`, `Broadcast Candidate ${key}`, "verified"],
      [`broadcast-mate-${key}@demo.collate.test`, `Broadcast Mate ${key}`, "verified"],
      [`broadcast-declined-${key}@demo.collate.test`, `Broadcast Declined ${key}`, "verified"],
      [`broadcast-noconsent-${key}@demo.collate.test`, `Broadcast No Consent ${key}`, "verified"],
      [`broadcast-kano-${key}@demo.collate.test`, `Broadcast Kano ${key}`, "verified"],
      [`broadcast-hidden-${key}@demo.collate.test`, `Broadcast Hidden ${key}`, "verified"],
      [`broadcast-consent-${key}@demo.collate.test`, `Broadcast Consent ${key}`, "verified"],
      [`broadcast-official-${key}@demo.collate.test`, `Broadcast Official ${key}`, "verified"],
    ],
  );
  const [
    adminPersonId,
    senderPersonId,
    linkAgentPersonId,
    extraAgentPersonId,
    candidatePersonId,
    runningMatePersonId,
    declinedAgentPersonId,
    noConsentAgentPersonId,
    kanoAgentPersonId,
    hiddenOwnerAgentPersonId,
    consentAgentPersonId,
    officialAgentPersonId,
  ] = people.map((person) => person.id);

  const candidates = await insertRows<{ id: number }>(
    entityManager,
    "candidate",
    ["person_id", "seat_id", "principal_candidate_id"],
    [[candidatePersonId, Number(seats[0].id), null]],
  );
  const principalCandidateId = Number(candidates[0].id);
  await insertRows(
    entityManager,
    "candidate",
    ["person_id", "seat_id", "principal_candidate_id"],
    [[runningMatePersonId, null, principalCandidateId]],
  );

  const memberships = await insertRows<{ id: number }>(
    entityManager,
    "membership",
    ["person_id", "group_id", "membership_role"],
    [
      [adminPersonId, adminGroupId, "admin"],
      [senderPersonId, viewerGroupId, "coordinator"],
    ],
  );
  await insertRows(
    entityManager,
    "membership_scope_unit",
    ["membership_id", "scope_state_id", "scope_lga_id", "scope_ward_id", "scope_political_unit_id"],
    [[Number(memberships[1].id), lagosStateId, null, null, null]],
    "",
  );
  await insertRows(
    entityManager,
    "group_visibility_grant",
    ["viewer_group_id", "owner_group_id", "is_allowed"],
    [[viewerGroupId, ownerLagosGroupId, true]],
    "",
  );

  const phoneRows: Array<Array<string | number | boolean | null>> = [
    [linkAgentPersonId, `+2340000002001`, false, null],
    [officialAgentPersonId, `+2340000002002`, true, "930001"],
    [extraAgentPersonId, `+2340000002003`, true, "920001"],
    [candidatePersonId, `+2340000002004`, true, "940001"],
    [runningMatePersonId, `+2340000002005`, true, "950001"],
    [kanoAgentPersonId, `+2340000002006`, true, "960001"],
    [hiddenOwnerAgentPersonId, `+2340000002007`, true, "970001"],
    [declinedAgentPersonId, `+2340000002008`, false, null],
    [noConsentAgentPersonId, `+2340000002009`, true, "980001"],
    [consentAgentPersonId, `+2340000002010`, false, null],
  ];
  await insertRows(
    entityManager,
    "phone_number",
    ["person_id", "e164_number", "is_confirmed", "telegram_chat_id"],
    phoneRows,
    "",
  );

  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const now = new Date();
  const acceptedPeople = [
    officialAgentPersonId,
    extraAgentPersonId,
    candidatePersonId,
    runningMatePersonId,
    kanoAgentPersonId,
    hiddenOwnerAgentPersonId,
  ];
  await insertRows(
    entityManager,
    "consent",
    ["person_id", "consent_text_version", "is_accepted", "created_at"],
    [
      ...acceptedPeople.map((personId) => [
        personId,
        "v0-draft",
        true,
        yesterday,
      ]),
      [declinedAgentPersonId, "v0-draft", true, yesterday],
      [declinedAgentPersonId, "v0-draft", false, now],
    ],
    "",
  );

  const assignments: Array<Array<string | number | null>> = [
    [officialAgentPersonId, lagosPu1, ownerLagosGroupId, null, "official", 0],
    [extraAgentPersonId, lagosPu1, ownerLagosGroupId, null, "extra", 1],
    [extraAgentPersonId, lagosPu2, ownerLagosGroupId, null, "extra", 2],
    [candidatePersonId, lagosPu1, ownerLagosGroupId, null, "extra", 3],
    [declinedAgentPersonId, lagosPu2, ownerLagosGroupId, null, "extra", 4],
    [noConsentAgentPersonId, lagosPu2, ownerLagosGroupId, null, "extra", 5],
    [kanoAgentPersonId, kanoPu1, ownerKanoGroupId, null, "official", 0],
    [hiddenOwnerAgentPersonId, lagosPu1, hiddenOwnerGroupId, null, "extra", 6],
  ];
  await insertRows(
    entityManager,
    "agent_assignment",
    ["person_id", "polling_unit_id", "owner_group_id", "owner_candidate_id", "agent_kind", "slot_number"],
    assignments,
    "",
  );

  return {
    adminPersonId,
    senderPersonId,
    linkAgentPersonId,
    extraAgentPersonId,
    candidatePersonId,
    runningMatePersonId,
    declinedAgentPersonId,
    noConsentAgentPersonId,
    kanoAgentPersonId,
    hiddenOwnerAgentPersonId,
    consentAgentPersonId,
    officialAgentPersonId,
    lagosStateId,
    kanoStateId,
    lagosWardId,
    kanoStateIdForFilter: kanoStateId,
    kanoWardId,
    lagosPu1,
    kanoPu1,
    ownerLagosGroupId,
    linkPhone: `+2340000002001`,
    officialPhone: `+2340000002002`,
    extraPhone: `+2340000002003`,
    candidatePhone: `+2340000002004`,
    runningMatePhone: `+2340000002005`,
    kanoPhone: `+2340000002006`,
    hiddenOwnerPhone: `+2340000002007`,
    declinedPhone: `+2340000002008`,
    noConsentPhone: `+2340000002009`,
    consentPhone: `+2340000002010`,
    officialChatId: "930001",
    extraChatId: "920001",
    candidateChatId: "940001",
    runningMateChatId: "950001",
    kanoChatId: "960001",
    hiddenOwnerChatId: "970001",
  };
}

function createLimiter() {
  return {
    acquire: vi.fn(async () => undefined),
    pause: vi.fn(),
  };
}

async function createBroadcastFixture(
  senderPersonId: string,
  audienceFilter: Record<string, unknown>,
  entityManager: EntityManager,
): Promise<string> {
  const rows = (await entityManager.query(
    `
      INSERT INTO broadcast (sender_person_id, audience_filter, message_text, broadcast_status)
      VALUES ($1::uuid, $2::jsonb, $3, 'sending')
      RETURNING id;
    `,
    [senderPersonId, JSON.stringify(audienceFilter), "Polling unit update"],
  )) as Array<{ id: string }>;
  return rows[0].id;
}

async function createDeliveryFixture(
  broadcastId: string,
  personId: string,
  entityManager: EntityManager,
): Promise<string> {
  const rows = (await entityManager.query(
    `
      INSERT INTO delivery (broadcast_id, person_id, delivery_channel, delivery_status)
      VALUES ($1::uuid, $2::uuid, 'telegram', 'pending')
      RETURNING id;
    `,
    [broadcastId, personId],
  )) as Array<{ id: string }>;
  return rows[0].id;
}

async function readDelivery(
  deliveryId: string,
  entityManager: EntityManager,
): Promise<{
  delivery_status: string;
  delivery_channel: string;
  sent_at: Date | null;
  delivered_at: Date | null;
  failed_at: Date | null;
}> {
  const rows = (await entityManager.query(
    "SELECT delivery_status, delivery_channel, sent_at, delivered_at, failed_at FROM delivery WHERE id = $1::uuid",
    [deliveryId],
  )) as Array<{
    delivery_status: string;
    delivery_channel: string;
    sent_at: Date | null;
    delivered_at: Date | null;
    failed_at: Date | null;
  }>;
  return rows[0];
}

async function readBroadcast(
  broadcastId: string,
  entityManager: EntityManager,
): Promise<{ broadcast_status: string }> {
  const rows = (await entityManager.query(
    "SELECT broadcast_status FROM broadcast WHERE id = $1::uuid",
    [broadcastId],
  )) as Array<{ broadcast_status: string }>;
  return rows[0];
}

/** Ids of the built-in group types, by key. */
async function groupTypeIds(entityManager: EntityManager): Promise<Record<string, number>> {
  const rows = await entityManager.query<Array<{ id: number; type_key: string }>>(
    `SELECT id, type_key FROM group_type WHERE type_key IS NOT NULL`,
  );
  return Object.fromEntries(rows.map((row) => [row.type_key, Number(row.id)]));
}

async function insertRows<T>(
  entityManager: EntityManager,
  table: string,
  columns: string[],
  rows: unknown[][],
  returning = "id",
): Promise<T[]> {
  const parameters: unknown[] = [];
  const values = rows.map(
    (row) =>
      `(${row
        .map((value) => {
          parameters.push(value);
          return `$${parameters.length}`;
        })
        .join(", ")})`,
  );
  const result = await entityManager.query(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES ${values.join(", ")}${returning ? ` RETURNING ${returning}` : ""}`,
    parameters,
  );
  return result as T[];
}

function requireManager(): EntityManager {
  if (!manager) {
    throw new Error("Database test manager is not initialized.");
  }
  return manager;
}

function requireFixtures(): Fixtures {
  if (!fixtures) {
    throw new Error("Database test fixtures are not initialized.");
  }
  return fixtures;
}
