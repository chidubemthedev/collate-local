"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AlertCircle, LoaderCircle, MapPinned } from "lucide-react";
import type { CoverageMapPoint } from "@/types/api";

const mapHeightClass = "h-[min(55svh,440px)] min-h-[260px] sm:h-[480px]";

const InteractiveCoordinateMap = dynamic(
  () =>
    import("./interactive-coordinate-map").then(
      (module) => module.InteractiveCoordinateMap,
    ),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        className={`flex ${mapHeightClass} items-center justify-center rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground`}
      >
        <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
        Loading interactive map…
      </div>
    ),
  },
);

interface CoverageCoordinateMapProps {
  points: CoverageMapPoint[];
  isLoading: boolean;
  error: Error | null;
  viewKey: string;
  onRetry: () => void;
}

type MarkerCategory = "covered" | "gap" | "mixed";

const markerCategories: Array<{
  key: MarkerCategory;
  label: string;
  description: string;
  colorClass: string;
}> = [
  {
    key: "covered",
    label: "Covered",
    description: "All polling units at this coordinate have an official agent.",
    colorClass: "bg-emerald-500",
  },
  {
    key: "gap",
    label: "Gap",
    description: "No polling units at this coordinate have an official agent.",
    colorClass: "bg-amber-500",
  },
  {
    key: "mixed",
    label: "Mixed",
    description: "Some polling units have an official agent and some do not.",
    colorClass: "bg-indigo-500",
  },
];

function getMarkerCategory(point: CoverageMapPoint): MarkerCategory {
  if (point.coveredPUs <= 0) return "gap";
  if (point.coveredPUs >= point.totalPUs) return "covered";
  return "mixed";
}

export function CoverageCoordinateMap({
  points,
  isLoading,
  error,
  viewKey,
  onRetry,
}: CoverageCoordinateMapProps) {
  const totalPUs = points.reduce((sum, point) => sum + point.totalPUs, 0);
  const [visibleCategories, setVisibleCategories] = useState<
    Record<MarkerCategory, boolean>
  >({
    covered: true,
    gap: true,
    mixed: true,
  });
  const visiblePoints = useMemo(
    () => points.filter((point) => visibleCategories[getMarkerCategory(point)]),
    [points, visibleCategories],
  );

  return (
    <div className="space-y-3 px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPinned aria-hidden="true" className="h-4 w-4 text-primary" />
          <span role="status" aria-live="polite" aria-atomic="true">
            {isLoading
              ? "Loading available coordinates…"
              : `${totalPUs.toLocaleString()} polling units at ${points.length.toLocaleString()} mapped locations`}
          </span>
        </div>
        <div
          role="group"
          aria-label="Toggle map marker categories"
          className="flex flex-wrap items-center gap-1.5"
        >
          {markerCategories.map((category) => {
            const isVisible = visibleCategories[category.key];
            return (
              <button
                key={category.key}
                type="button"
                aria-pressed={isVisible}
                aria-label={`${category.label} markers. ${category.description} Currently ${isVisible ? "shown" : "hidden"}. Click to ${isVisible ? "hide" : "show"} them.`}
                title={`${category.description} Click to ${isVisible ? "hide" : "show"} these markers.`}
                onClick={() =>
                  setVisibleCategories((current) => ({
                    ...current,
                    [category.key]: !current[category.key],
                  }))
                }
                className={`flex min-h-11 items-center gap-1.5 rounded-full border px-3 py-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                  isVisible
                    ? "border-border bg-background text-foreground"
                    : "border-transparent text-muted-foreground opacity-50"
                }`}
              >
                <span className={`h-2.5 w-2.5 rounded-full ${category.colorClass}`} />
                {category.label}
              </button>
            );
          })}
        </div>
      </div>

      {error ? (
        <div role="alert" className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 text-center">
          <AlertCircle aria-hidden="true" className="h-5 w-5 text-amber-600" />
          <p className="text-sm font-medium">Could not load map coordinates</p>
          <p className="text-xs text-muted-foreground">{error.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-11 rounded-md border border-border px-4 py-2 text-xs font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div
          role="status"
          className={`flex ${mapHeightClass} items-center justify-center rounded-lg border border-border bg-muted/20 text-xs text-muted-foreground`}
        >
          <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          Loading coordinate data…
        </div>
      ) : (
        <>
          <InteractiveCoordinateMap
            key={viewKey}
            points={visiblePoints}
            viewKey={viewKey}
          />
          {points.length === 0 && (
            <div role="status" className="rounded-lg border border-dashed border-border px-4 py-3 text-center">
              <p className="text-sm font-medium">No polling-unit coordinates were returned for this area</p>
              <p className="mt-1 text-xs text-muted-foreground">
                The map is centered on Nigeria. Coordinate markers appear when this area has
                latitude and longitude data.
              </p>
            </div>
          )}
          {points.length > 0 && visiblePoints.length === 0 && (
            <div role="status" className="rounded-lg border border-dashed border-border px-4 py-3 text-center text-sm text-muted-foreground">
              All marker categories are hidden. Turn one back on to show map locations.
            </div>
          )}
        </>
      )}
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        The map is limited to Nigeria&apos;s approximate coordinate bounds. Multiple polling units
        may share one mapped location. Coordinates are approximate; verify a location before
        relying on it for directions. Map © OpenFreeMap, © OpenMapTiles, data © OpenStreetMap contributors.
      </p>
    </div>
  );
}
