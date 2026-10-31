import type { QueryRunner } from "typeorm";
import { BroadcastStatus } from "../../entities/broadcast.entity";
import { DeliveryChannel, DeliveryStatus } from "../../entities/delivery.entity";

export async function seedBroadcasts(queryRunner: QueryRunner): Promise<void> {
  const senderRows = await queryRunner.query<{ id: string }>(`
    SELECT p.id FROM person p
    WHERE p.email_address LIKE '%@demo.collate.test%'
    ORDER BY p.created_at DESC
    LIMIT 10;
  `);

  const agentRows = await queryRunner.query<{ id: string }>(`
    SELECT p.id FROM person p
    WHERE p.email_address LIKE '%@demo.collate.test%'
    ORDER BY p.full_name;
  `);

  const messages = [
    {
      senderId: senderRows[0]?.id,
      audienceFilter: { state_id: 1 },
      messageText: "Agents in Lagos, please check the latest PU coverage and flag any unfilled wards before close of business.",
      scheduledSendAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      broadcastStatus: BroadcastStatus.COMPLETED,
      statuses: [
        { status: DeliveryStatus.TAPPED_OK, channel: DeliveryChannel.TELEGRAM, ratio: 0.55 },
        { status: DeliveryStatus.DELIVERED, channel: DeliveryChannel.TELEGRAM, ratio: 0.25 },
        { status: DeliveryStatus.DELIVERED_BY_SMS, channel: DeliveryChannel.SMS, ratio: 0.08 },
        { status: DeliveryStatus.SENT, channel: DeliveryChannel.TELEGRAM, ratio: 0.07 },
        { status: DeliveryStatus.FAILED, channel: DeliveryChannel.TELEGRAM, ratio: 0.05 },
      ],
    },
    {
      senderId: senderRows[1]?.id,
      audienceFilter: { state_id: 2 },
      messageText: "These are the PUs in your area with no agent.",
      scheduledSendAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      broadcastStatus: BroadcastStatus.COMPLETED,
      statuses: [
        { status: DeliveryStatus.DELIVERED, channel: DeliveryChannel.TELEGRAM, ratio: 0.5 },
        { status: DeliveryStatus.SENT, channel: DeliveryChannel.TELEGRAM, ratio: 0.25 },
        { status: DeliveryStatus.PENDING, channel: DeliveryChannel.TELEGRAM, ratio: 0.15 },
        { status: DeliveryStatus.FAILED, channel: DeliveryChannel.TELEGRAM, ratio: 0.1 },
      ],
    },
    {
      senderId: senderRows[2]?.id,
      audienceFilter: { state_id: 3 },
      messageText: "Please confirm the latest turnout and any late-arriving agents before the morning briefing.",
      scheduledSendAt: new Date(),
      broadcastStatus: BroadcastStatus.SENDING,
      statuses: [
        { status: DeliveryStatus.DELIVERED, channel: DeliveryChannel.TELEGRAM, ratio: 0.35 },
        { status: DeliveryStatus.SENT, channel: DeliveryChannel.TELEGRAM, ratio: 0.25 },
        { status: DeliveryStatus.PENDING, channel: DeliveryChannel.TELEGRAM, ratio: 0.4 },
      ],
    },
    {
      senderId: senderRows[3]?.id,
      audienceFilter: { state_id: 1 },
      messageText: "Tomorrow's briefing is scheduled for 8am. Share any field updates before then.",
      scheduledSendAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      broadcastStatus: BroadcastStatus.SCHEDULED,
      statuses: [{ status: DeliveryStatus.PENDING, channel: DeliveryChannel.TELEGRAM, ratio: 1 }],
    },
    {
      senderId: senderRows[4]?.id,
      audienceFilter: { office_id: 1 },
      messageText: "Draft note: keep all field updates in the shared tracker before the next campaign window.",
      scheduledSendAt: null,
      broadcastStatus: BroadcastStatus.DRAFT,
      statuses: [{ status: DeliveryStatus.PENDING, channel: DeliveryChannel.TELEGRAM, ratio: 1 }],
    },
  ];

  for (const message of messages) {
    const insertedBroadcast = await queryRunner.query<{ id: string }>(`
      INSERT INTO broadcast (sender_person_id, audience_filter, message_text, scheduled_send_at, broadcast_status)
      VALUES ('${message.senderId}', '${JSON.stringify(message.audienceFilter)}'::jsonb, '${message.messageText.replace("'", "''")}', ${message.scheduledSendAt ? `'${message.scheduledSendAt.toISOString()}'` : "NULL"}, '${message.broadcastStatus}')
      RETURNING id;
    `);

    const broadcastId = insertedBroadcast[0].id;
    const recipients = agentRows.slice(0, Math.min(agentRows.length, 80));

    for (let index = 0; index < recipients.length; index += 1) {
      const recipient = recipients[index];
      const deliveryStatus = message.statuses[0] && index < recipients.length * message.statuses[0].ratio ? message.statuses[0].status :
        message.statuses[1] && index < recipients.length * (message.statuses[0].ratio + message.statuses[1].ratio) ? message.statuses[1].status :
        message.statuses[2] && index < recipients.length * (message.statuses[0].ratio + message.statuses[1].ratio + message.statuses[2].ratio) ? message.statuses[2].status :
        message.statuses[3] && index < recipients.length * (message.statuses[0].ratio + message.statuses[1].ratio + message.statuses[2].ratio + message.statuses[3].ratio) ? message.statuses[3].status :
        message.statuses[4] ? message.statuses[4].status : DeliveryStatus.PENDING;

      const channel = deliveryStatus === DeliveryStatus.DELIVERED_BY_SMS ? DeliveryChannel.SMS : DeliveryChannel.TELEGRAM;
      const sentAt = message.broadcastStatus === BroadcastStatus.COMPLETED || message.broadcastStatus === BroadcastStatus.SENDING ? new Date(Date.now() - (recipients.length - index) * 60 * 1000) : null;
      const deliveredAt = deliveryStatus === DeliveryStatus.DELIVERED || deliveryStatus === DeliveryStatus.TAPPED_OK || deliveryStatus === DeliveryStatus.DELIVERED_BY_SMS ? new Date(Date.now() - (recipients.length - index) * 60 * 1000 + 5 * 60 * 1000) : null;
      const tappedAt = deliveryStatus === DeliveryStatus.TAPPED_OK ? new Date(Date.now() - (recipients.length - index) * 60 * 1000 + 8 * 60 * 1000) : null;
      const failedAt = deliveryStatus === DeliveryStatus.FAILED ? new Date(Date.now() - (recipients.length - index) * 60 * 1000 + 3 * 60 * 1000) : null;

      await queryRunner.query(`
        INSERT INTO delivery (broadcast_id, person_id, delivery_channel, delivery_status, sent_at, delivered_at, tapped_ok_at, failed_at)
        VALUES (
          '${broadcastId}',
          '${recipient.id}',
          '${channel}',
          '${deliveryStatus}',
          ${sentAt ? `'${sentAt.toISOString()}'` : "NULL"},
          ${deliveredAt ? `'${deliveredAt.toISOString()}'` : "NULL"},
          ${tappedAt ? `'${tappedAt.toISOString()}'` : "NULL"},
          ${failedAt ? `'${failedAt.toISOString()}'` : "NULL"}
        );
      `);
    }
  }
}
