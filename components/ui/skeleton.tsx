import * as React from "react"
import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse motion-reduce:animate-none rounded-md bg-muted/70", className)}
      {...props}
    />
  )
}

function TableSkeleton({
  columns,
  rows = 8,
}: {
  columns: Array<string | { label: string; className?: string }>;
  rows?: number;
}) {
  return (
    <div aria-busy="true" className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-left text-xs">
        <thead className="sticky top-0 z-10 border-b bg-muted/50 text-muted-foreground">
          <tr>
            {columns.map((column, index) => (
              <th key={typeof column === "string" ? column : column.label} className={`px-3 py-3 font-medium ${typeof column === "string" ? "" : column.className ?? ""}`}>
                {typeof column === "string" ? column : column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {Array.from({ length: rows }).map((_, row) => (
            <tr key={row} className="h-12">
              {columns.map((column, index) => (
                <td key={`${typeof column === "string" ? column : column.label}-${index}`} className={`px-3 py-2.5 ${typeof column === "string" ? "" : column.className ?? ""}`}>
                  <Skeleton className={`h-4 ${index === 0 ? "w-3/4" : "w-2/3"}`} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCardSkeleton({
  count = 1,
  className = "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={`grid gap-3 ${className}`}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="h-[106px] space-y-3 rounded-xl border bg-card p-3.5">
          <Skeleton className="h-3.5 w-24" />
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

function CardListSkeleton({
  count = 4,
  className = "space-y-3",
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div aria-busy="true" className={className}>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="space-y-3 rounded-xl border bg-card p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3 max-w-md" />
              <Skeleton className="h-3.5 w-1/2 max-w-sm" />
            </div>
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
          <div className="flex flex-wrap gap-3 border-t pt-3">
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-3.5 w-28" />
          </div>
        </div>
      ))}
    </div>
  );
}

export { Skeleton, TableSkeleton, StatCardSkeleton, CardListSkeleton };
