"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type {
  SessionData,
  PermissionsData,
  ViewAsOptionsData,
  OtpRequestPayload,
  OtpVerifyPayload,
  OtpVerifyResponse,
} from "@/types/api";

export const AUTH_KEYS = {
  session: ["auth", "session"] as const,
  permissions: ["auth", "permissions"] as const,
  viewAs: ["auth", "view-as"] as const,
};

/** Shown on actions that are turned off while "View as" is on. */
export const READ_ONLY_TITLE = "Read-only while viewing as someone else. Exit the view to make changes.";

/**
 * Hook to retrieve the current auth session from /api/auth/session.
 */
export function useSession() {
  return useQuery<SessionData, ApiClientError>({
    queryKey: AUTH_KEYS.session,
    queryFn: async () => {
      const res = await apiClient.get<SessionData>("/api/auth/session");
      return res.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Hook to retrieve current user permissions from /api/auth/permissions.
 */
export function usePermissions() {
  const { data: session } = useSession();

  return useQuery<PermissionsData["permissions"] | null, ApiClientError>({
    queryKey: AUTH_KEYS.permissions,
    queryFn: async () => {
      const res = await apiClient.get<PermissionsData>("/api/auth/permissions");
      return res.data.permissions;
    },
    enabled: Boolean(session?.authenticated),
    staleTime: 1000 * 60 * 5,
  });
}

/** True while "View as" is on, so actions that change data are turned off. */
export function useReadOnly(): boolean {
  const { data: permissions } = usePermissions();
  return permissions?.readOnly === true;
}

/** The choices for the "View as" dropdown (only fetched once the dropdown is wanted). */
export function useViewAsOptions(enabled: boolean) {
  return useQuery<ViewAsOptionsData, ApiClientError>({
    queryKey: AUTH_KEYS.viewAs,
    queryFn: async () => (await apiClient.get<ViewAsOptionsData>("/api/auth/view-as")).data,
    enabled,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Turns a view on (a value from the dropdown) or off (null). Everything on screen was loaded
 * with the old access, so all other data is dropped and loaded again.
 */
export function useSetViewAs() {
  const queryClient = useQueryClient();

  return useMutation<{ viewAs: string | null }, ApiClientError, string | null>({
    mutationFn: async (value) => {
      const res =
        value === null
          ? await apiClient.delete<{ viewAs: string | null }>("/api/auth/view-as")
          : await apiClient.put<{ viewAs: string | null }>("/api/auth/view-as", { value });
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== "auth" });
      await queryClient.invalidateQueries({ queryKey: AUTH_KEYS.permissions });
      await queryClient.invalidateQueries({ queryKey: AUTH_KEYS.viewAs });
    },
  });
}

/**
 * Mutation to request a 6-digit OTP code via email.
 */
export function useRequestOtp() {
  return useMutation<{ ok: boolean }, ApiClientError, OtpRequestPayload>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<{ ok: boolean }>("/api/auth/otp/request", payload);
      return res.data;
    },
  });
}

/**
 * Mutation to verify the 6-digit OTP code and establish a session.
 */
export function useVerifyOtp() {
  const queryClient = useQueryClient();

  return useMutation<OtpVerifyResponse, ApiClientError, OtpVerifyPayload>({
    mutationFn: async (payload) => {
      const res = await apiClient.post<OtpVerifyResponse>("/api/auth/otp/verify", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.session });
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.permissions });
    },
  });
}

/**
 * Mutation to terminate the current session and log out.
 */
export function useLogout() {
  const queryClient = useQueryClient();

  return useMutation<{ ok: boolean }, ApiClientError, void>({
    mutationFn: async () => {
      const res = await apiClient.post<{ ok: boolean }>("/api/auth/logout");
      return res.data;
    },
    onSuccess: () => {
      queryClient.setQueryData(AUTH_KEYS.session, { authenticated: false });
      queryClient.setQueryData(AUTH_KEYS.permissions, null);
      queryClient.invalidateQueries();
    },
  });
}

/** Who a sign-in link is for (masked email). Not retried: an expired or used link stays that way. */
export function useSignInLinkDetails(token: string) {
  return useQuery<{ email: string | null }, ApiClientError>({
    queryKey: ["auth", "sign-in-link", token],
    queryFn: async () =>
      (await apiClient.get<{ email: string | null }>("/api/auth/otp/verify-link", { token })).data,
    enabled: token.length > 0,
    retry: false,
    staleTime: Infinity,
  });
}

/** Signs in with the link from a sign-in email. */
export function useSignInWithLink(token: string) {
  const queryClient = useQueryClient();
  return useMutation<{ ok: boolean }, ApiClientError, void>({
    mutationFn: async () => (await apiClient.post<{ ok: boolean }>("/api/auth/otp/verify-link", { token })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.session });
      queryClient.invalidateQueries({ queryKey: AUTH_KEYS.permissions });
    },
  });
}
