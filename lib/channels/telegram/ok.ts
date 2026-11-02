import type { EntityManager } from "typeorm";
import { resolveManager } from "../../policy/core/database";

export const OK_CALLBACK_PREFIX = "ok:";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseOkCallback(data: string | undefined | null): string | null {
  if (!data || !data.startsWith(OK_CALLBACK_PREFIX)) {
    return null;
  }

  const deliveryId = data.slice(OK_CALLBACK_PREFIX.length);
  return UUID_PATTERN.test(deliveryId) ? deliveryId : null;
}

/**
 * One atomic update, so a repeated tap is harmless and a tap from any chat
 * other than the recipient's linked chat changes nothing.
 */
export async function applyOk(
  { deliveryId, chatId }: { deliveryId: string; chatId: string | number },
  manager?: EntityManager,
): Promise<boolean> {
  const entityManager = await resolveManager(manager);
  const [, affected] = (await entityManager.query(
    `
      UPDATE delivery
      SET delivery_status = 'tapped_ok',
          tapped_ok_at = NOW()
      WHERE id = $1
        AND EXISTS (
          SELECT 1
          FROM phone_number
          WHERE phone_number.person_id = delivery.person_id
            AND phone_number.telegram_chat_id = $2
        )
        AND delivery_status IN ('delivered', 'sent', 'tapped_ok')
      RETURNING id;
    `,
    [deliveryId, String(chatId)],
  )) as [Array<{ id: string }>, number];

  return affected > 0;
}
