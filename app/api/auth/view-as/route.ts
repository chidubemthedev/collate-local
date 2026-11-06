import "server-only";
import { connection } from "next/server";
import { requireApiAuth, type ApiAuthContext } from "@/lib/auth/api";
import { assertSameOrigin } from "@/lib/auth/request";
import { chooseViewAs, listViewAsOptions, PARTY_LABEL } from "@/lib/auth/view-as";
import { failure, internalError, success } from "@/lib/api/response";

/** The list value of the view that is on, or of the person's own access. */
function currentValue(context: ApiAuthContext, selfValue: string): string {
  if (!context.viewAs) return selfValue;
  return context.viewAs.seatId === null ? "party" : `seat:${context.viewAs.seatId}`;
}

/** The choices for the "View as" dropdown: the person's own access and everything below it. */
export async function GET() {
  await connection();

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    const { self, groups } = await listViewAsOptions(
      auth.context.dataSource,
      auth.context.own,
      auth.context.ownLabel,
    );
    return success({ current: currentValue(auth.context, self.value), self, groups });
  } catch (error) {
    console.error("[/api/auth/view-as] GET failed", error);
    return internalError();
  }
}

/** Turns a view on (or back to the person's own access). Body: { value: "party" | "seat:<id>" | … }. */
export async function PUT(request: Request) {
  await connection();
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "Request origin is not allowed");
  }

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return failure("validation_failed", "Invalid JSON request body");
    }
    const value = (body as { value?: unknown } | null)?.value;
    if (typeof value !== "string" || value.length > 64) {
      return failure("validation_failed", "Invalid view");
    }

    const choice = await chooseViewAs(auth.context.dataSource, auth.context.own, value);
    if (choice === "forbidden") {
      return failure("forbidden", "You can only view as access at or below your own");
    }

    await auth.context.dataSource.query(`UPDATE auth_session SET view_as = $1::jsonb WHERE id = $2;`, [
      choice === null ? null : JSON.stringify(choice),
      auth.context.sessionId,
    ]);
    return success({ viewAs: choice === null ? null : choice.kind === "party" ? PARTY_LABEL : choice.label });
  } catch (error) {
    console.error("[/api/auth/view-as] PUT failed", error);
    return internalError();
  }
}

/** Exits the view, back to the person's own access. */
export async function DELETE(request: Request) {
  await connection();
  try {
    assertSameOrigin(request);
  } catch {
    return failure("invalid_origin", "Request origin is not allowed");
  }

  try {
    const auth = await requireApiAuth();
    if (!auth.ok) return auth.response;

    await auth.context.dataSource.query(`UPDATE auth_session SET view_as = NULL WHERE id = $1;`, [
      auth.context.sessionId,
    ]);
    return success({ viewAs: null });
  } catch (error) {
    console.error("[/api/auth/view-as] DELETE failed", error);
    return internalError();
  }
}
