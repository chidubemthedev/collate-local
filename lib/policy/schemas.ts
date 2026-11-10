import { z } from "zod";
import { AgentKind } from "../db/entities/agent-assignment.entity";
import { isValidCursor } from "./core/cursor";

const idFilter = z.coerce.number().int().positive();

export const agentFiltersSchema = z.object({
  stateId: idFilter.optional(),
  lgaId: idFilter.optional(),
  wardId: idFilter.optional(),
  politicalUnitId: idFilter.optional(),
  ownerGroupId: idFilter.optional(),
  ownerCandidateId: idFilter.optional(),
  // One person's assignments (e.g. who "Message this agent" is for). Scope still applies.
  personId: z.uuid().optional(),
  agentKind: z.nativeEnum(AgentKind).optional(),
  // not_connected = sms_only + not_matched.
  channel: z.enum(["telegram", "not_connected", "sms_only", "not_matched"]).optional(),
  q: z.string().trim().min(1).max(100).optional(),
  cursor: z.string().max(512).refine(isValidCursor).optional(),
  // Candidates must not get bulk export; this cap applies to every caller.
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export const agentSummaryFiltersSchema = agentFiltersSchema.omit({
  cursor: true,
  limit: true,
  channel: true,
  agentKind: true,
});

export type AgentFilters = z.infer<typeof agentFiltersSchema>;
export type AgentSummaryFilters = z.infer<typeof agentSummaryFiltersSchema>;
