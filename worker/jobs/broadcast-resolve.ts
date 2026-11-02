import type { Job } from "pg-boss";
import { materializeDeliveries } from "../../lib/policy/core/audience";
import {
  BROADCAST_RESOLVE,
  DELIVERY_SEND,
  defaultJobOptions,
} from "../../lib/queue/names";
import { getWorkerBoss } from "../lib/boss";
import { getWorkerDataSource } from "../lib/database";

export interface BroadcastResolveJobData {
  broadcastId: string;
}

const DELIVERY_INSERT_BATCH_SIZE = 500;

export async function handleBroadcastResolve(
  jobs: Job<BroadcastResolveJobData>[],
): Promise<void> {
  void BROADCAST_RESOLVE;
  const dataSource = await getWorkerDataSource();

  for (const job of jobs) {
    const { broadcastId } = job.data;
    const recipientCount = await dataSource.transaction(async (manager) => {
      const [, affected] = (await manager.query(
        `
          UPDATE broadcast
          SET broadcast_status = 'sending'
          WHERE id = $1::uuid
            AND broadcast_status IN ('scheduled', 'sending')
          RETURNING id;
        `,
        [broadcastId],
      )) as [Array<{ id: string }>, number];

      if (affected === 0) {
        return null;
      }

      const count = await materializeDeliveries(broadcastId, manager);
      if (count === 0) {
        await manager.query(
          `
            UPDATE broadcast
            SET broadcast_status = 'completed'
            WHERE id = $1::uuid AND broadcast_status = 'sending';
          `,
          [broadcastId],
        );
      }
      return count;
    });

    if (recipientCount === null || recipientCount === 0) {
      continue;
    }

    const deliveries = (await dataSource.query(
      `SELECT id FROM delivery WHERE broadcast_id = $1::uuid;`,
      [broadcastId],
    )) as Array<{ id: string }>;

    const boss = getWorkerBoss();
    for (let index = 0; index < deliveries.length; index += DELIVERY_INSERT_BATCH_SIZE) {
      const batch = deliveries.slice(index, index + DELIVERY_INSERT_BATCH_SIZE);
      await boss.insert(
        DELIVERY_SEND,
        batch.map((delivery) => ({
          data: { deliveryId: delivery.id },
          singletonKey: delivery.id,
          ...defaultJobOptions,
        })),
      );
    }
  }
}
