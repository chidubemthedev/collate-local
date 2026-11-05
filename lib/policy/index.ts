import "server-only";
import { getDataSource } from "@/lib/db";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { EntityManager } from "typeorm";
import { loadPolicyUser as loadPolicyUserCore } from "./core/policy-user";
import { getScope as getScopeCore } from "./core/scope";
import { getVisibleOwners as getVisibleOwnersCore } from "./core/owners";
import {
  canAccessPollingUnit as canAccessPollingUnitCore,
  describeScope as describeScopeCore,
} from "./core/scope-queries";
import { listAgents as listAgentsCore, summarizeAgents as summarizeAgentsCore } from "./core/list-agents";
import { listOwnerGroups as listOwnerGroupsCore } from "./core/owner-groups";
import type { OwnerGroupDto } from "./core/owner-groups";
import type { AgentListContext, AgentPage, AgentSummary } from "./core/list-agents";
import type { PolicyUser } from "./core/policy-user";
import type { Scope } from "./core/scope";
import type { VisibleOwners } from "./core/owners";
import type { AgentFilters, AgentSummaryFilters } from "./schemas";

export { agentFiltersSchema, agentSummaryFiltersSchema } from "./schemas";
export { ForbiddenError, InvalidFilterError } from "./errors";
export { maskPhoneNumber } from "./core/list-agents";
export { decodeCursor, encodeCursor } from "./core/cursor";
export type { AgentFilters, AgentSummaryFilters } from "./schemas";
export type { AgentDto, AgentPage, AgentListContext, AgentSummary } from "./core/list-agents";
export type { PolicyUser } from "./core/policy-user";
export type { Scope } from "./core/scope";
export type { VisibleOwners } from "./core/owners";
export type { OwnerGroupDto } from "./core/owner-groups";

async function getManager(): Promise<EntityManager> {
  return (await getDataSource()).manager;
}

export async function loadPolicyUser(personId: string): Promise<PolicyUser> {
  return loadPolicyUserCore(personId, await getManager());
}

export async function policyUserFromCurrentUser(
  currentUser: CurrentUser,
): Promise<PolicyUser> {
  return loadPolicyUser(currentUser.personId);
}

export function getScope(user: PolicyUser): Scope {
  return getScopeCore(user);
}

export function getVisibleOwners(user: PolicyUser): VisibleOwners {
  return getVisibleOwnersCore(user);
}

export async function describeScope(user: PolicyUser) {
  return describeScopeCore(user, await getManager());
}

export async function canAccessPollingUnit(
  user: PolicyUser,
  pollingUnitId: number,
): Promise<boolean> {
  return canAccessPollingUnitCore(user, pollingUnitId, await getManager());
}

export async function listAgents(
  user: PolicyUser,
  filters: AgentFilters,
  context?: AgentListContext,
): Promise<AgentPage> {
  return listAgentsCore(user, filters, context, await getManager());
}

export async function listOwnerGroups(user: PolicyUser): Promise<OwnerGroupDto[]> {
  return listOwnerGroupsCore(user, await getManager());
}

export async function summarizeAgents(
  user: PolicyUser,
  filters: AgentSummaryFilters,
): Promise<AgentSummary> {
  return summarizeAgentsCore(user, filters, await getManager());
}
