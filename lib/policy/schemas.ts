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
  agentKind: z.nativeEnum(AgentKind).optional(),
  cursor: z.string().max(512).refine(isValidCursor).optional(),
  // Candidates must not get bulk export; this cap applies to every caller.
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export type AgentFilters = z.infer<typeof agentFiltersSchema>;
