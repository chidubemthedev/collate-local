/**
 * Keyset cursor for /api/coverage/gaps. Gaps are listed by state, LGA and ward name, then polling
 * unit code; the polling unit id breaks any tie, so each row has one place in the order.
 */
export interface GapsCursor {
  stateName: string;
  lgaName: string;
  wardName: string;
  code: string;
  id: number;
}

export function encodeGapsCursor(cursor: GapsCursor): string {
  return Buffer.from(
    JSON.stringify([cursor.stateName, cursor.lgaName, cursor.wardName, cursor.code, cursor.id]),
    "utf8",
  ).toString("base64url");
}

export function decodeGapsCursor(value: string): GapsCursor | null {
  if (value.length > 1024 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      Array.isArray(parsed) &&
      parsed.length === 5 &&
      parsed.slice(0, 4).every((part) => typeof part === "string" && part.length <= 200) &&
      Number.isSafeInteger(parsed[4]) &&
      parsed[4] > 0
    ) {
      return { stateName: parsed[0], lgaName: parsed[1], wardName: parsed[2], code: parsed[3], id: parsed[4] };
    }
  } catch {
    // Falls through to null.
  }
  return null;
}
