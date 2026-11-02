import { toE164 } from "../../../phone/normalize";

export type ContactDecision =
  | { action: "ignore" }
  | { action: "lookup"; e164: string };

export interface ContactInput {
  contactUserId?: string | number | null;
  contactPhone?: string | null;
  senderId?: string | number | null;
  senderChatType?: string | null;
}

/**
 * Only a private chat can link a number, and only when the shared contact
 * belongs to the sender. Anything else is ignored without a reply.
 */
export function decideContact({
  contactUserId,
  contactPhone,
  senderId,
  senderChatType,
}: ContactInput): ContactDecision {
  if (senderChatType !== "private") {
    return { action: "ignore" };
  }

  if (!contactPhone || contactUserId === null || contactUserId === undefined) {
    return { action: "ignore" };
  }

  if (senderId === null || senderId === undefined) {
    return { action: "ignore" };
  }

  if (String(contactUserId) !== String(senderId)) {
    return { action: "ignore" };
  }

  const e164 = toE164(contactPhone);
  if (!e164) {
    return { action: "ignore" };
  }

  return { action: "lookup", e164 };
}
