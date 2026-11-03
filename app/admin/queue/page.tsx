"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Database,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertCircle,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { apiClient, ApiClientError } from "@/lib/api/client";
import type { QueueSummaryRow, RecentJob } from "@/app/api/admin/queue/route";

interface QueueData {
  summary: QueueSummaryRow[];
  recent: RecentJob[];
}

const STATE_STYLES: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  created:   { bg: "bg-blue-50 border-blue-200",   text: "text-blue-800",   icon: <Clock className="w-3 h-3" /> },
  active:    { bg: "bg-amber-50 border-amber-200",  text: "text-amber-800",  icon: <Loader2 className="w-3 h-3 animate-spin" /> },
  completed: { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-800", icon: <CheckCircle className="w-3 h-3" /> },
  failed:    { bg: "bg-red-50 border-red-200",      text: "text-red-800",    icon: <XCircle className="w-3 h-3" /> },
  cancelled: { bg: "bg-slate-50 border-slate-200",  text: "text-slate-600",  icon: <AlertCircle className="w-3 h-3" /> },
};

function StateBadge({ state }: { state: string }) {
  const style = STATE_STYLES[state] ?? STATE_STYLES.cancelled;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${style.bg} ${style.text}`}>
      {style.icon}
      {state}
    </span>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
    timeZoneName: "short",
  });
}

export default function QueueDashboardPage() {
  const {
    data,
    error,
    isError,
    isFetching,
    isLoading,
    dataUpdatedAt,
    refetch,
  } = useQuery<QueueData, ApiClientError>({
    queryKey: ["admin", "queue"],
    queryFn: async () => {
      const response = await apiClient.get<QueueData>("/api/admin/queue");
      return response.data;
    },
    refetchInterval: 10_000,
    retry: false,
  });
  const lastRefresh = dataUpdatedAt ? new Date(dataUpdatedAt) : null;
  const errorMessage = error
    ? error.status === 401
      ? "Not authenticated."
      : error.status === 403
        ? "Admin access required."
        : error.message
    : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="h-6 w-6 text-emerald-700" />
            Queue Dashboard
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Live view of pg-boss job queues. Auto-refreshes every 10 seconds.
            {lastRefresh && (
              <span className="ml-2 text-slate-400">Last updated: {formatDate(lastRefresh.toISOString())}</span>
            )}
          </p>
        </div>
        <Button
          onClick={() => void refetch()}
          disabled={isFetching}
          size="sm"
          variant="outline"
          className="gap-1.5 text-xs"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {isError && errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-800">
          <XCircle className="h-4 w-4 shrink-0" />
          {errorMessage}
        </div>
      )}

      {/* Queue Summary Cards */}
      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.summary.map((queue) => (
              <div key={queue.name} className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-emerald-600" />
                    <span className="text-xs font-semibold text-slate-800 truncate">{queue.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] px-1.5">
                    {queue.total} total
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { label: "Pending", value: queue.created, color: "text-blue-700" },
                    { label: "Active",  value: queue.active,  color: "text-amber-700" },
                    { label: "Done",    value: queue.completed, color: "text-emerald-700" },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="bg-slate-50 rounded p-2">
                      <div className={`text-lg font-bold ${color}`}>{value}</div>
                      <div className="text-[10px] text-slate-500">{label}</div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-slate-500">
                  {queue.failed > 0 && (
                    <span className="text-red-600 font-semibold flex items-center gap-0.5">
                      <XCircle className="w-3 h-3" /> {queue.failed} failed
                    </span>
                  )}
                  {queue.cancelled > 0 && (
                    <span>{queue.cancelled} cancelled</span>
                  )}
                  {queue.failed === 0 && queue.cancelled === 0 && (
                    <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                      <CheckCircle className="w-3 h-3" /> No failures
                    </span>
                  )}
                </div>
              </div>
            ))}
            {data.summary.length === 0 && !isLoading && (
              <div className="col-span-full text-center py-8 text-sm text-slate-400">
                No jobs found. Create a broadcast to see jobs here.
              </div>
            )}
          </div>

          {/* Recent Jobs Table */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-xs overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Recent Jobs (last 50)</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    {["Queue", "State", "Created", "Started", "Completed", "Retries", "Output"].map((col) => (
                      <th key={col} className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.recent.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2 font-medium text-slate-700 whitespace-nowrap">{job.name}</td>
                      <td className="px-3 py-2 whitespace-nowrap"><StateBadge state={job.state} /></td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(job.createdOn)}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(job.startedOn)}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{formatDate(job.completedOn)}</td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">
                        {job.retryCount}/{job.retryLimit}
                      </td>
                      <td className="px-3 py-2 text-slate-400 max-w-xs truncate font-mono text-[10px]">
                        {job.output ?? "—"}
                      </td>
                    </tr>
                  ))}
                  {data.recent.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-slate-400">
                        No recent jobs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {isLoading && !data && (
        <div className="flex items-center justify-center py-16 text-slate-400 gap-2 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading queue data…
        </div>
      )}
    </div>
  );
}
