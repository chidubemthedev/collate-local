import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { assertSameOrigin, getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";
import { policyErrorResponse } from "@/lib/policy/http";
import { policyUserFromCurrentUser } from "@/lib/policy";
import { createBroadcastSchema } from "@/lib/broadcast/schemas";
import { createBroadcast } from "@/lib/broadcast/service";
import { listBroadcasts } from "@/lib/broadcast/queries";

const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(512).optional(),
  })
  .strict();

export async function GET(request: Request): Promise<Response> {
  try {
    const currentUser = await requireUser();
    const parsedQuery = listQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!parsedQuery.success) {
      return failure("validation_failed", "Invalid request parameters");
    }

    const user = await policyUserFromCurrentUser(currentUser);
    const page = await listBroadcasts(user, {
      ...parsedQuery.data,
      ipAddress: getClientIp(request),
    });
    return success(page.items, {
      nextCursor: page.nextCursor,
      limit: parsedQuery.data.limit,
    });
  } catch (error) {
    const policyResponse = policyErrorResponse(error);
    if (policyResponse) {
      return policyResponse;
    }
    return internalError();
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "The request origin is not allowed");
  }

  try {
    const currentUser = await requireUser();
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure("validation_failed", "Invalid request body");
    }

    const parsed = createBroadcastSchema.safeParse(body);
    if (!parsed.success) {
      return failure("validation_failed", "Invalid request body");
    }

    const user = await policyUserFromCurrentUser(currentUser);
    const broadcast = await createBroadcast(user, parsed.data);
    return success(broadcast, undefined, 201);
  } catch (error) {
    const policyResponse = policyErrorResponse(error);
    if (policyResponse) {
      return policyResponse;
    }
    return internalError();
  }
}
