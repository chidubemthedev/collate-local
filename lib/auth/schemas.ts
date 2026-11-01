import { z } from "zod";

export const EmailSchema = z
  .string()
  .trim()
  .min(1)
  .transform((value) => value.toLowerCase());

export const OtpRequestBodySchema = z.object({
  email: EmailSchema,
});

export const OtpVerifyBodySchema = z.object({
  email: EmailSchema,
  code: z.string().trim().regex(/^\d{6}$/),
});

export const OtpRequestResponseSchema = z.object({
  ok: z.boolean(),
  error: z.enum(["too_many_requests"]).optional(),
});

export const OtpVerifyResponseSchema = z.object({
  ok: z.boolean(),
  error: z.enum(["invalid_or_expired_code", "too_many_requests"]).optional(),
});

export const SessionResponseSchema = z.union([
  z.object({ authenticated: z.literal(false) }),
  z.object({
    authenticated: z.literal(true),
    person: z.object({
      id: z.string(),
      fullName: z.string(),
      isAdmin: z.boolean(),
      candidateId: z.number().int().nullable(),
    }),
  }),
]);

export const LogoutResponseSchema = z.object({
  ok: z.literal(true),
});
