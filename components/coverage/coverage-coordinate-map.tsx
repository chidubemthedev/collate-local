"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import type { CoverageMapPoint } from "@/types/api";

const mapHeightClass = "h-[min(55svh,440px)] min-h-[260px] sm:h-[480px] max-h-[600px]";

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
        className={`flex ${mapHeightClass} items-center justify-center rounded-[10px] bg-[#FAFAFA] text-[12px] text-[#737373]`}
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
  /** Area shown, for the chip next to the title. */
  scope: string;
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
    colorClass: "bg-[#10b981]",
  },
  {
    key: "gap",
    label: "Gap",
    description: "No polling units at this coordinate have an official agent.",
    colorClass: "bg-[#f59e0b]",
  },
  {
    key: "mixed",
    label: "Mixed",
    description: "Some polling units have an official agent and some do not.",
    colorClass: "bg-[#6366f1]",
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
  scope,
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
    <figure className="m-0 flex flex-col gap-2 rounded-[14px] border border-[#E5E5E5] bg-white p-3 sm:px-4 sm:py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-[#0A0A0A]">Geographic Coverage Visualizer</span>
          <span className="rounded-full border border-[#E5E5E5] px-2 py-px text-[12px] text-[#0A0A0A]">{scope}</span>
        </figcaption>
        <div role="group" aria-label="Toggle map marker categories" className="flex flex-wrap gap-1.5">
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
                className={`inline-flex min-h-[26px] items-center gap-1.5 rounded-full border border-[#E5E5E5] bg-white px-2.5 text-[12px] text-[#525252] transition-opacity ${
                  isVisible ? "" : "opacity-45 line-through"
                }`}
              >
                <span className={`h-2.5 w-2.5 flex-none rounded-full ${category.colorClass}`} />
                {category.label}
              </button>
            );
          })}
        </div>
      </div>
      <span role="status" aria-live="polite" aria-atomic="true" className="text-[12px] text-[#737373]">
        {isLoading
          ? "Loading available coordinates…"
          : `Showing ${totalPUs.toLocaleString()} polling units at ${points.length.toLocaleString()} mapped locations, coloured by official coverage`}
      </span>

      {error ? (
        <div role="alert" className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-[10px] bg-[#FAFAFA] px-4 text-center">
          <AlertCircle aria-hidden="true" className="h-5 w-5 text-amber-600" />
          <p className="text-[13px] font-semibold">Could not load map coordinates</p>
          <p className="text-[12px] text-[#737373]">{error.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex min-h-8 items-center rounded-[10px] border border-[#E5E5E5] bg-white px-3 text-[12px] font-medium text-[#0A0A0A] hover:bg-[#FAFAFA]"
          >
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div
          role="status"
          className={`flex ${mapHeightClass} items-center justify-center rounded-[10px] bg-[#FAFAFA] text-[12px] text-[#737373]`}
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
            <div role="status" className="rounded-[10px] border border-dashed border-[#E5E5E5] px-4 py-3 text-center">
              <p className="text-[13px] font-semibold">No polling-unit coordinates were returned for this area</p>
              <p className="mt-1 text-[12px] text-[#737373]">
                The map is centered on Nigeria. Coordinate markers appear when this area has
                latitude and longitude data.
              </p>
            </div>
          )}
          {points.length > 0 && visiblePoints.length === 0 && (
            <div role="status" className="rounded-[10px] border border-dashed border-[#E5E5E5] px-4 py-3 text-center text-[13px] text-[#737373]">
              All marker categories are hidden. Turn one back on to show map locations.
            </div>
          )}
        </>
      )}
      <p className="m-0 text-[12px] text-[#737373]">
        The map is limited to Nigeria&apos;s approximate coordinate bounds. Multiple polling units
        may share one mapped location. Coordinates are approximate; verify a location before
        relying on it for directions. Map © OpenFreeMap, © OpenMapTiles, data © OpenStreetMap contributors.
      </p>
    </figure>
  );
}
