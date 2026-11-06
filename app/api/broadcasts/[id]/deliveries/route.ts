import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";
import { policyErrorResponse } from "@/lib/policy/http";
import { policyUserFromCurrentUser } from "@/lib/policy";
import { listBroadcastDeliveries } from "@/lib/broadcast/queries";
import { DELIVERY_STATUSES, RECIPIENT_GROUPS, broadcastIdSchema } from "@/lib/broadcast/schemas";

const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    cursor: z.string().max(512).optional(),
    status: z.enum(DELIVERY_STATUSES).optional(),
    group: z.enum(RECIPIENT_GROUPS).optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
    const currentUser = await requireUser();
    const { id } = await params;
    if (!broadcastIdSchema.safeParse(id).success) {
      return failure("validation_failed", "Invalid broadcast ID");
    }
    const parsedQuery = listQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!parsedQuery.success) {
      return failure("validation_failed", "Invalid request parameters");
    }

    const user = await policyUserFromCurrentUser(currentUser);
    const page = await listBroadcastDeliveries(user, id, {
      limit: parsedQuery.data.limit,
      cursor: parsedQuery.data.cursor,
      ipAddress: getClientIp(request),
      filters: {
        status: parsedQuery.data.status,
        group: parsedQuery.data.group,
        search: parsedQuery.data.search || undefined,
      },
    });
    if (!page) {
      return failure("not_found", "Broadcast not found");
    }

    return success(page.items, {
      nextCursor: page.nextCursor,
      limit: parsedQuery.data.limit,
      ...(page.total === null ? {} : { total: page.total }),
    });
  } catch (error) {
    const policyResponse = policyErrorResponse(error);
    if (policyResponse) {
      return policyResponse;
    }
    return internalError();
  }
}
