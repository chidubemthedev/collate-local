/**
 * Group types, as shown and created on Settings · Groups and access.
 *
 * The rules live in the group_type table and the access checks read them from there
 * (lib/auth/api.ts for coverage, lib/policy for agents and broadcasts). This file only holds
 * the values a new type may take and the words the page uses for them.
 */
export const CAN_MESSAGE_VALUES = ["none", "agents_they_cover", "all_agents"] as const;
export type CanMessage = (typeof CAN_MESSAGE_VALUES)[number];

export const SEES_COVERAGE_VALUES = ["national", "own_area"] as const;
export type SeesCoverage = (typeof SEES_COVERAGE_VALUES)[number];

/** What an admin may pick for a new type. "All agents" stays with the built-in Admin type. */
export const NEW_TYPE_CAN_MESSAGE = ["none", "agents_they_cover"] as const satisfies readonly CanMessage[];
export type NewTypeCanMessage = (typeof NEW_TYPE_CAN_MESSAGE)[number];

export const CAN_MESSAGE_LABEL: Record<CanMessage, string> = {
  none: "No one (view only)",
  agents_they_cover: "Agents they cover",
  all_agents: "All agents",
};

export const SEES_COVERAGE_LABEL: Record<SeesCoverage, string> = {
  national: "National",
  own_area: "Own area only",
};

export const GROUP_TYPE_NAME_MAX = 80;
