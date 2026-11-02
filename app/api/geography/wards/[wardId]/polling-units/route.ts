import "server-only";
import { connection } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { getClientIp } from "@/lib/auth/request";
import { failure, internalError, success } from "@/lib/api/response";
import { InvalidFilterError } from "@/lib/policy/errors";
import { policyErrorResponse } from "@/lib/policy/http";
import {
  listWardPollingUnits,
  wardPollingUnitsQuerySchema,
} from "@/lib/policy/core/list-ward-polling-units";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ wardId: string }> },
): Promise<Response> {
  await connection();

  try {
    const currentUser = await requireUser();
    const { wardId: rawWardId } = await params;
    const parsedWardId = z.coerce.number().int().positive().safeParse(rawWardId);
    if (!parsedWardId.success) {
      return failure("validation_failed", "Invalid ward ID");
    }

    const parsedQuery = wardPollingUnitsQuerySchema.safeParse(
      Object.fromEntries(new URL(request.url).searchParams.entries()),
    );
    if (!parsedQuery.success) {
      return failure("validation_failed", "Invalid request parameters");
    }

    const page = await listWardPollingUnits(
      currentUser.personId,
      parsedWardId.data,
      parsedQuery.data,
      { ipAddress: getClientIp(request) },
    );
    if (!page) {
      return failure("not_found", "Ward not found");
    }

    return success(page.items, {
      nextCursor: page.nextCursor,
      limit: parsedQuery.data.limit,
    });
  } catch (error) {
    const policyResponse = policyErrorResponse(error);
    if (policyResponse) {
      return policyResponse;
    }
    if (error instanceof InvalidFilterError) {
      return failure("validation_failed", "Invalid request parameters");
    }
    console.error("[/api/geography/wards/[wardId]/polling-units] failed");
    return internalError();
  }
}
