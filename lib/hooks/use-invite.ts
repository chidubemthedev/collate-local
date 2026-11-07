"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type { InviteDetails } from "@/types/api";

/** What an invite link is for. Not retried: an expired or used link stays that way. */
export function useInviteDetails(token: string) {
  return useQuery<InviteDetails, ApiClientError>({
    queryKey: ["invite", token],
    queryFn: async () => (await apiClient.get<InviteDetails>(`/api/auth/invite/${encodeURIComponent(token)}`)).data,
    retry: false,
    staleTime: Infinity,
  });
}

/** Completes registration from the link; the server signs the candidate in. */
export function useCompleteInvite(token: string) {
  return useMutation<{ ok: boolean }, ApiClientError, void>({
    mutationFn: async () =>
      (await apiClient.post<{ ok: boolean }>(`/api/auth/invite/${encodeURIComponent(token)}`, {})).data,
  });
}
