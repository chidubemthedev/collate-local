"use client";

import type { CoverageMapPoint } from "@/types/api";
import { CoverageCoordinateMap } from "@/components/coverage/coverage-coordinate-map";

interface CoverageMapProps {
  stateCode: string;
  lgaCode: string;
  wardCode: string;
  stateName?: string;
  lgaName?: string;
  wardName?: string;
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
  stateCode,
  lgaCode,
  wardCode,
  stateName,
  lgaName,
  wardName,
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

  return (
    <CoverageCoordinateMap
      points={coordinatePoints}
      isLoading={coordinatesLoading}
      error={coordinatesError}
      viewKey={coordinateViewKey}
      onRetry={onRetryCoordinates}
      scope={scope}
    />
  );
}
