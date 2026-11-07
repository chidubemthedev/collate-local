"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { WF } from "@/components/ui/wf";

interface PagedList<T> {
  data?: { pages: Array<{ items: T[]; total: number }> };
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  fetchNextPage: () => Promise<unknown>;
}

/**
 * Page-by-page view of a keyset-paged list: page N is the Nth page the API returned, fetched when
 * first opened and kept for going back. Changing `resetKey` (the filters) goes back to page 1.
 */
export function usePages<T>(list: PagedList<T>, resetKey: string) {
  const [state, setState] = useState({ key: resetKey, page: 1 });
  const page = state.key === resetKey ? state.page : 1;
  const pages = list.data?.pages ?? [];
  const loadingPage = pages.length > 0 && pages.length < page;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = list;
  useEffect(() => {
    if (loadingPage && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [loadingPage, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return {
    page,
    setPage: (next: number) => setState({ key: resetKey, page: next }),
    /** This page's rows; while the next page loads, the last loaded page stays on screen. */
    items: (pages[page - 1] ?? pages[pages.length - 1])?.items ?? [],
    total: pages[0]?.total ?? 0,
    loadingPage,
  };
}

/** "Showing 1–25 of 120 candidates" with Previous, "Page 1 of 5" and Next, as on the other tables. */
export function Pager({
  page,
  pageSize,
  total,
  loading,
  noun,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  loading: boolean;
  noun: [singular: string, plural: string];
  onPage: (page: number) => void;
}) {
  if (total <= 0) return null;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[12px] text-[#737373]">
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()} {total === 1 ? noun[0] : noun[1]}
      </span>
      {/* Always shown, so it's clear where paging lives; greyed out when there's one page. */}
      <span className="flex items-center gap-1.5">
        <button type="button" className={WF.btnOutline} disabled={page <= 1 || loading} onClick={() => onPage(page - 1)}>
          Previous
        </button>
        <span className="px-1 text-[12px] text-[#737373]">
          Page {page} of {totalPages}
        </span>
        <button
          type="button"
          className={WF.btnOutline}
          disabled={page >= totalPages || loading}
          onClick={() => onPage(page + 1)}
        >
          Next
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        </button>
      </span>
    </div>
  );
}
