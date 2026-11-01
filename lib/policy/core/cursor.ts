import { z } from "zod";
import { InvalidFilterError } from "../errors";

const cursorPayloadSchema = z.object({
  pollingUnitCode: z.string().min(1).max(128),
  slotNumber: z.number().int().min(0),
  assignmentId: z.string().uuid(),
}).strict();

export type AgentCursor = z.infer<typeof cursorPayloadSchema>;

export function encodeCursor(cursor: AgentCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeCursor(value: string): AgentCursor {
  if (value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new InvalidFilterError();
  }

  try {
    const json = Buffer.from(value, "base64url").toString("utf8");
    if (Buffer.from(json, "utf8").toString("base64url") !== value) {
      throw new InvalidFilterError();
    }
    return cursorPayloadSchema.parse(JSON.parse(json));
  } catch {
    throw new InvalidFilterError();
  }
}

export function isValidCursor(value: string): boolean {
  try {
    decodeCursor(value);
    return true;
  } catch {
    return false;
  }
}
