"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type {
  SessionData,
  PermissionsData,
  OtpRequestPayload,
  OtpVerifyPayload,
  OtpVerifyResponse,
} from "@/types/api";

export const AUTH_KEYS = {
  session: ["auth", "session"] as const,
  permissions: ["auth", "permissions"] as const,
};

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
