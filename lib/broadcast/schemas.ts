import { z } from "zod";

const idFilter = z.coerce.number().int().positive();
const verificationStatus = z.enum(["unverified", "verified", "rejected"]);

export const broadcastIdSchema = z.uuid();

/** Filters for a broadcast's recipient list. */
export const DELIVERY_STATUSES = [
  "pending",
  "sent",
  "delivered",
  "delivered_by_sms",
  "tapped_ok",
  "failed",
] as const;
export const RECIPIENT_GROUPS = ["candidate", "official_agent", "extra_agent"] as const;

export const audienceFilterSchema = z
  .object({
    stateId: idFilter.optional(),
    lgaId: idFilter.optional(),
    wardId: idFilter.optional(),
    pollingUnitId: idFilter.optional(),
    politicalUnitId: idFilter.optional(),
    officeId: idFilter.optional(),
    ownerGroupId: idFilter.optional(),
    // One person ("Message this agent"). Still limited to the sender's area and visible owners.
    personId: z.uuid().optional(),
    agentKind: z.enum(["official", "extra", "all"]).default("all"),
    verificationStatus: verificationStatus.optional(),
  })
  .strict();

const controlCharacters = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const createBroadcastSchema = z
  .object({
    audienceFilter: audienceFilterSchema,
    messageText: z
      .string()
      .trim()
      .min(1)
      .max(1000)
      .refine((value) => !controlCharacters.test(value), {
        message: "Message text must not contain control characters",
      }),
    scheduledSendAt: z.iso
      .datetime({ offset: true })
      .refine(
        (value) => {
          const scheduled = Date.parse(value);
          const now = Date.now();
          return scheduled > now && scheduled <= now + 90 * 24 * 60 * 60 * 1000;
        },
        { message: "Scheduled send time must be in the next 90 days" },
      )
      .optional(),
  })
  .strict();

export type AudienceFilter = z.infer<typeof audienceFilterSchema>;
export type AudienceFilterInput = z.input<typeof audienceFilterSchema>;
export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;
