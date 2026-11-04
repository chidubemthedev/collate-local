"use client";

import type { CoverageMapPoint } from "@/types/api";
import { Badge } from "@/components/ui/badge";
import { MapPin } from "lucide-react";
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
  return (
    <div className="border border-border/60 bg-card rounded-xl overflow-hidden shadow-none">
      <div className="py-2.5 px-4 bg-muted/20 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-primary/10 text-primary">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs sm:text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Geographic Coverage Visualizer</span>
              <Badge
                variant="outline"
                className="max-w-[45vw] truncate text-[10px] font-mono font-normal sm:max-w-none"
              >
                <span className="truncate">
                  {wardCode !== "all"
                    ? `Ward · ${wardName ?? wardCode}`
                    : lgaCode !== "all"
                    ? lgaName ?? lgaCode
                    : stateCode !== "all"
                    ? stateName ?? stateCode
                    : "Nigeria"}
                </span>
              </Badge>
            </div>
          </div>
        </div>

      </div>

      <CoverageCoordinateMap
        points={coordinatePoints}
        isLoading={coordinatesLoading}
        error={coordinatesError}
        viewKey={coordinateViewKey}
        onRetry={onRetryCoordinates}
      />
    </div>
  );
}
