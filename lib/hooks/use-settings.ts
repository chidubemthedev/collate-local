"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type {
  AdminListItem,
  AuditLogItem,
  CandidateInviteItem,
  CreateAdminPayload,
  CreateGroupTypePayload,
  GroupAccessRule,
  GroupTypeImpact,
} from "@/types/api";

export const SETTINGS_KEYS = {
  groupAccess: ["settings", "group-access"] as const,
  admins: ["settings", "admins"] as const,
  adminList: (q: string) => [...SETTINGS_KEYS.admins, { q }] as const,
  candidates: ["settings", "candidates"] as const,
  auditLog: (filters: AuditLogFilters) => ["settings", "audit-log", filters] as const,
  candidateList: (filters: CandidateInviteFilters) => [...SETTINGS_KEYS.candidates, filters] as const,
};

export interface CandidateInviteFilters {
  q: string;
  office: string;
  status: string;
}

/** Rows per page on the Settings lists (admins, candidates). */
export const SETTINGS_PAGE_SIZE = 25;
const ADMINS_PAGE_SIZE = SETTINGS_PAGE_SIZE;

/** Settings · Groups and access: every group type and what it can do (admins only). */
export function useGroupAccess(enabled = true) {
  return useQuery<GroupAccessRule[], ApiClientError>({
    queryKey: SETTINGS_KEYS.groupAccess,
    queryFn: async () => (await apiClient.get<GroupAccessRule[]>("/api/settings/groups")).data,
    enabled,
    staleTime: 1000 * 60 * 10,
  });
}

/** Creates a group type, then reloads the list. */
export function useCreateGroupType() {
  const queryClient = useQueryClient();
  return useMutation<GroupAccessRule, ApiClientError, CreateGroupTypePayload>({
    mutationFn: async (payload) => (await apiClient.post<GroupAccessRule>("/api/settings/groups", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.groupAccess }),
  });
}

/** Settings · Admins: everyone who is an admin, searched by name or email, a page at a time. */
export function useAdmins(q: string) {
  return useInfiniteQuery<{ items: AdminListItem[]; nextCursor: string | null; total: number }, ApiClientError>({
    queryKey: SETTINGS_KEYS.adminList(q),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<AdminListItem[]>("/api/settings/admins", {
        q,
        limit: ADMINS_PAGE_SIZE,
        cursor: pageParam as string | null,
      });
      return { items: res.data, nextCursor: res.meta?.nextCursor ?? null, total: res.meta?.total ?? res.data.length };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** Adds an admin, then reloads the list. */
export function useCreateAdmin() {
  const queryClient = useQueryClient();
  return useMutation<AdminListItem, ApiClientError, CreateAdminPayload>({
    mutationFn: async (payload) => (await apiClient.post<AdminListItem>("/api/settings/admins", payload)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.admins }),
  });
}

/** Removes an admin (by person id), then reloads the list. */
export function useRemoveAdmin() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, ApiClientError, string>({
    mutationFn: async (personId) =>
      (await apiClient.delete<{ ok: boolean }>(`/api/settings/admins/${encodeURIComponent(personId)}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.admins }),
  });
}

/** Settings · Candidates: candidates and running mates with their invite status, a page at a time. */
export function useCandidateInvites(filters: CandidateInviteFilters) {
  return useInfiniteQuery<{ items: CandidateInviteItem[]; nextCursor: string | null; total: number }, ApiClientError>({
    queryKey: SETTINGS_KEYS.candidateList(filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<CandidateInviteItem[]>("/api/settings/candidates", {
        ...filters,
        limit: SETTINGS_PAGE_SIZE,
        cursor: pageParam as string | null,
      });
      return { items: res.data, nextCursor: res.meta?.nextCursor ?? null, total: res.meta?.total ?? res.data.length };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
  });
}

/** Sends a candidate an invite (a new one cancels the old link), then reloads the list. */
export function useInviteCandidate() {
  const queryClient = useQueryClient();
  return useMutation<CandidateInviteItem, ApiClientError, { candidateId: number; email: string }>({
    mutationFn: async ({ candidateId, email }) =>
      (await apiClient.post<CandidateInviteItem>(`/api/settings/candidates/${candidateId}/invite`, { email })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.candidates }),
  });
}

/** Cancels a candidate's invite, then reloads the list. */
export function useCancelInvite() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, ApiClientError, number>({
    mutationFn: async (candidateId) =>
      (await apiClient.delete<{ ok: boolean }>(`/api/settings/candidates/${candidateId}/invite`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.candidates }),
  });
}

/** What deleting a group type would affect; loaded when the "Are you sure?" dialog opens. */
export function useGroupTypeImpact(groupTypeId: number | null) {
  return useQuery<GroupTypeImpact, ApiClientError>({
    queryKey: [...SETTINGS_KEYS.groupAccess, "impact", groupTypeId],
    queryFn: async () => (await apiClient.get<GroupTypeImpact>(`/api/settings/groups/${groupTypeId}`)).data,
    enabled: groupTypeId !== null,
    // Always fresh: groups may have been given this type since the dialog last opened.
    staleTime: 0,
    gcTime: 0,
  });
}

/** Deletes a group type, then reloads the list. */
export function useDeleteGroupType() {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, ApiClientError, number>({
    mutationFn: async (groupTypeId) =>
      (await apiClient.delete<{ ok: boolean }>(`/api/settings/groups/${groupTypeId}`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEYS.groupAccess }),
  });
}

export interface AuditLogFilters {
  kind: "changes" | "views" | "all";
  q: string;
  /** YYYY-MM-DD, or "" for no limit. */
  from: string;
  to: string;
}

/** Settings · Audit log: who did what, newest first, a page at a time (admins only). */
export function useAuditLog(filters: AuditLogFilters) {
  return useInfiniteQuery<{ items: AuditLogItem[]; nextCursor: string | null; total: number }, ApiClientError>({
    queryKey: SETTINGS_KEYS.auditLog(filters),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const res = await apiClient.get<AuditLogItem[]>("/api/settings/audit-log", {
        ...filters,
        limit: SETTINGS_PAGE_SIZE,
        cursor: pageParam as string | null,
      });
      return { items: res.data, nextCursor: res.meta?.nextCursor ?? null, total: res.meta?.total ?? 0 };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    placeholderData: keepPreviousData,
  });
}
