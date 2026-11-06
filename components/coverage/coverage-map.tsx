"use client";

import { useMemo } from "react";
import type { CoverageMapPoint } from "@/types/api";
import { CoverageCoordinateMap } from "@/components/coverage/coverage-coordinate-map";
import { useBoundaries, type BoundaryFeature } from "@/lib/coverage/boundaries";
import type { AreaStat, MapLevel } from "@/components/coverage/coverage-deck-map";

interface CoverageMapProps {
  level: MapLevel;
  /** INEC codes of the selected areas ("all" when none). */
  stateCode: string;
  lgaCode: string;
  wardCode: string;
  stateName?: string;
  lgaName?: string;
  wardName?: string;
  /** Coverage of the areas one level down (states, LGAs of the state, or wards of the LGA). */
  areaStats: AreaStat[];
  onPickArea?: (code: string) => void;
  coordinatePoints: CoverageMapPoint[];
  coordinatesLoading: boolean;
  coordinatesError: Error | null;
  coordinateViewKey: string;
  onRetryCoordinates: () => void;
}

function toTitleCase(name: string) {
  return name
    .toLowerCase()
    .replace(/(^|[\s\-'(/])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bFct\b/g, "FCT");
}

export function CoverageMap({
  level,
  stateCode,
  lgaCode,
  wardCode,
  stateName,
  lgaName,
  wardName,
  areaStats,
  onPickArea,
  coordinatePoints,
  coordinatesLoading,
  coordinatesError,
  coordinateViewKey,
  onRetryCoordinates,
}: CoverageMapProps) {
  const scope =
    wardCode !== "all"
      ? `${toTitleCase(wardName ?? wardCode)} ward`
      : lgaCode !== "all"
      ? `${toTitleCase(lgaName ?? lgaCode)} LGA`
      : stateCode !== "all"
      ? `${toTitleCase(stateName ?? stateCode)} State`
      : "All of Nigeria";

  const hasState = stateCode !== "all";
  const hasLga = lgaCode !== "all";
  const states = useBoundaries("states");
  const lgas = useBoundaries("lgas", null, hasState);
  const wards = useBoundaries("wards", stateCode, hasState && hasLga);

  const { areaShapes, focusShape, areaCodeKey } = useMemo(() => {
    const stateShapes = states.data?.features ?? [];
    const lgaShapes = (lgas.data?.features ?? []).filter((f) => f.properties.state === stateCode);
    const wardShapes = (wards.data?.features ?? []).filter((f) => f.properties.lga === lgaCode);
    // GRID3 can split one INEC area into several shapes, so the focus is all of them together.
    const find = (list: BoundaryFeature[], key: "state" | "lga" | "ward", code: string): BoundaryFeature | null => {
      const parts = list.filter((f) => f.properties[key] === code);
      if (parts.length <= 1) return parts[0] ?? null;
      return {
        type: "Feature",
        properties: parts[0].properties,
        geometry: {
          type: "MultiPolygon",
          coordinates: parts.flatMap((f) =>
            f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
          ),
        },
      };
    };

    if (level === "ward") {
      return { areaShapes: wardShapes, focusShape: find(wardShapes, "ward", wardCode), areaCodeKey: "ward" as const };
    }
    if (level === "lga") {
      return { areaShapes: wardShapes, focusShape: find(lgaShapes, "lga", lgaCode), areaCodeKey: "ward" as const };
    }
    if (level === "state") {
      return { areaShapes: lgaShapes, focusShape: find(stateShapes, "state", stateCode), areaCodeKey: "lga" as const };
    }
    // Nationally, Nigeria itself is the focus, so neighbouring countries and the sea are faded too.
    const nigeria: BoundaryFeature | null = stateShapes.length
      ? {
          type: "Feature",
          properties: { state: null, name: "Nigeria" },
          geometry: {
            type: "MultiPolygon",
            coordinates: stateShapes.flatMap((f) =>
              f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates,
            ),
          },
        }
      : null;
    return { areaShapes: stateShapes, focusShape: nigeria, areaCodeKey: "state" as const };
  }, [level, states.data, lgas.data, wards.data, stateCode, lgaCode, wardCode]);

  // null = the outline files were never built (404), so the map falls back to points only.
  const boundariesMissing = states.data === null;

  return (
    <CoverageCoordinateMap
      level={level}
      points={coordinatePoints}
      isLoading={coordinatesLoading}
      error={coordinatesError}
      viewKey={coordinateViewKey}
      onRetry={onRetryCoordinates}
      scope={scope}
      areaShapes={areaShapes}
      areaStats={areaStats}
      areaCodeKey={areaCodeKey}
      focusShape={focusShape}
      boundariesMissing={boundariesMissing}
      onPickArea={level === "ward" ? undefined : onPickArea}
    />
  );
}
