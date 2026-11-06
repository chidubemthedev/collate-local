"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { AlertCircle, LoaderCircle } from "lucide-react";
import type { CoverageMapPoint } from "@/types/api";
import type { BoundaryFeature, BoundaryProps } from "@/lib/coverage/boundaries";
import type { AreaStat, MapLevel, MapMode, MarkerCategory } from "./coverage-deck-map";

// Same as MAP_HEIGHT in coverage-deck-map (not imported, so the map code stays in its own chunk).
const MAP_HEIGHT = "clamp(280px, 60svh, 520px)";


const CoverageDeckMap = dynamic(() => import("./coverage-deck-map").then((module) => module.CoverageDeckMap), {
  ssr: false,
  loading: () => (
    <div
      role="status"
      className="flex items-center justify-center text-[12px] text-[#737373]"
      style={{ height: MAP_HEIGHT, borderRadius: 10, background: "#FAFAFA" }}
    >
      <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
      Loading interactive map…
    </div>
  ),
});

interface CoverageCoordinateMapProps {
  level: MapLevel;
  points: CoverageMapPoint[];
  isLoading: boolean;
  error: Error | null;
  viewKey: string;
  onRetry: () => void;
  /** Area shown, for the chip next to the title. */
  scope: string;
  areaShapes: BoundaryFeature[];
  areaStats: AreaStat[];
  areaCodeKey: keyof Pick<BoundaryProps, "state" | "lga" | "ward">;
  focusShape: BoundaryFeature | null;
  /** The outline files have not been built, so only points can be shown. */
  boundariesMissing: boolean;
  onPickArea?: (code: string) => void;
}

const modes: Array<{ key: MapMode; label: string; description: string }> = [
  { key: "areas", label: "Areas", description: "Each area coloured by its official coverage." },
  { key: "hexagons", label: "Hexagons", description: "3D columns: height is polling units, colour is coverage." },
  { key: "points", label: "Points", description: "One dot per mapped location." },
];

const markerCategories: Array<{
  key: MarkerCategory;
  label: string;
  description: string;
  color: string;
}> = [
  {
    key: "covered",
    label: "Covered",
    description: "All polling units at this coordinate have an official agent.",
    color: "#10b981",
  },
  {
    key: "gap",
    label: "Gap",
    description: "No polling units at this coordinate have an official agent.",
    color: "#f59e0b",
  },
  {
    key: "mixed",
    label: "Mixed",
    description: "Some polling units have an official agent and some do not.",
    color: "#6366f1",
  },
];

const tiers = [
  { label: "70%+ covered", color: "#22A06B" },
  { label: "40–69%", color: "#8FD3A8" },
  { label: "Under 40%", color: "#E8892B" },
  { label: "No data", color: "#D4D4D4" },
];

function getMarkerCategory(point: CoverageMapPoint): MarkerCategory {
  if (point.coveredPUs <= 0) return "gap";
  if (point.coveredPUs >= point.totalPUs) return "covered";
  return "mixed";
}

export function CoverageCoordinateMap({
  level,
  points,
  isLoading,
  error,
  viewKey,
  onRetry,
  scope,
  areaShapes,
  areaStats,
  areaCodeKey,
  focusShape,
  boundariesMissing,
  onPickArea,
}: CoverageCoordinateMapProps) {
  const totalPUs = points.reduce((sum, point) => sum + point.totalPUs, 0);
  const [chosenMode, setChosenMode] = useState<MapMode | null>(null);
  const [visibleCategories, setVisibleCategories] = useState<Record<MarkerCategory, boolean>>({
    covered: true,
    gap: true,
    mixed: true,
  });

  const defaultMode: MapMode = level === "ward" ? "points" : "areas";
  const mode: MapMode = boundariesMissing && chosenMode !== "hexagons" ? "points" : chosenMode ?? defaultMode;
  const visibleCount = points.filter((point) => visibleCategories[getMarkerCategory(point)]).length;
  const usesMarkers = mode !== "areas";

  return (
    <figure className="m-0 flex flex-col gap-2 rounded-[14px] border border-[#E5E5E5] bg-white p-3 sm:px-4 sm:py-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <figcaption className="flex flex-wrap items-center gap-2">
          <span className="text-[15px] font-bold text-[#0A0A0A]">Geographic Coverage Visualizer</span>
          <span className="rounded-full border border-[#E5E5E5] px-2 py-px text-[12px] text-[#0A0A0A]">{scope}</span>
        </figcaption>
        <div
          role="group"
          aria-label="Map view"
          className="inline-flex rounded-[10px] border border-[#E5E5E5] bg-[#FAFAFA] p-0.5"
        >
          {modes.map((option) => {
            const disabled = option.key === "areas" && boundariesMissing;
            const active = mode === option.key;
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={active}
                disabled={disabled}
                title={disabled ? "Not available yet: area outlines have not been built" : option.description}
                onClick={() => setChosenMode(option.key)}
                className={`min-h-[26px] rounded-[8px] px-2.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${
                  active ? "bg-white text-[#0A0A0A] shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-[#525252] hover:text-[#0A0A0A]"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <span role="status" aria-live="polite" aria-atomic="true" className="text-[12px] text-[#737373]">
          {isLoading
            ? "Loading available coordinates…"
            : mode === "areas"
            ? `${areaStats.length.toLocaleString()} areas coloured by official coverage${onPickArea ? " · click one to open it" : ""}`
            : `Showing ${totalPUs.toLocaleString()} polling units at ${points.length.toLocaleString()} mapped locations`}
        </span>
        {usesMarkers && mode === "points" ? (
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
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: category.color }} />
                  {category.label}
                </button>
              );
            })}
          </div>
        ) : (
          <ul aria-label="Coverage legend" className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-[12px] text-[#525252]">
            {tiers.map((tier) => (
              <li key={tier.label} className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-2.5 w-2.5 flex-none rounded-[3px]" style={{ background: tier.color }} />
                {tier.label}
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && usesMarkers ? (
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
      ) : (
        <div className="relative">
          <CoverageDeckMap
            level={level}
            mode={mode}
            areaShapes={areaShapes}
            areaStats={areaStats}
            areaCodeKey={areaCodeKey}
            focusShape={focusShape}
            points={isLoading ? [] : points}
            visibleCategories={visibleCategories}
            viewKey={viewKey}
            onPickArea={onPickArea}
          />
          {isLoading && usesMarkers ? (
            <div
              role="status"
              className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center text-[12px] text-[#525252]"
            >
              <span className="inline-flex items-center rounded-full border border-[#E5E5E5] bg-white/95 px-3 py-1.5 shadow-sm">
                <LoaderCircle aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
                Loading coordinate data…
              </span>
            </div>
          ) : null}
        </div>
      )}

      {!isLoading && usesMarkers && points.length === 0 && !error ? (
        <div role="status" className="rounded-[10px] border border-dashed border-[#E5E5E5] px-4 py-3 text-center">
          <p className="text-[13px] font-semibold">No polling-unit coordinates were returned for this area</p>
          <p className="mt-1 text-[12px] text-[#737373]">
            Markers appear when this area has latitude and longitude data.
          </p>
        </div>
      ) : null}
      {!isLoading && mode === "points" && points.length > 0 && visibleCount === 0 ? (
        <div role="status" className="rounded-[10px] border border-dashed border-[#E5E5E5] px-4 py-3 text-center text-[13px] text-[#737373]">
          All marker categories are hidden. Turn one back on to show map locations.
        </div>
      ) : null}
      {boundariesMissing ? (
        <p className="m-0 rounded-[10px] bg-[#FFF7ED] px-3 py-2 text-[12px] text-[#9A3412]">
          Area outlines are not built yet. Run <code>npm run boundaries:build</code> to turn on the Areas view and
          the zoom-to-area focus.
        </p>
      ) : null}
      <p className="m-0 text-[12px] text-[#737373]">
        Multiple polling units may share one mapped location. Coordinates are approximate; verify a location before
        relying on it for directions. Boundaries © GRID3 Nigeria. Map © OpenFreeMap, © OpenMapTiles, data ©
        OpenStreetMap contributors.
      </p>
    </figure>
  );
}
