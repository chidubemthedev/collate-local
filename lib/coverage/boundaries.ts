"use client";

import { useQuery } from "@tanstack/react-query";

/**
 * Area outlines built from GRID3 by `npm run boundaries:build` (scripts/build-boundaries.mjs).
 * Each shape carries INEC codes: `state` ("04"), `lga` ("17", within the state) and
 * `ward` ("05", within the LGA). A code is null where GRID3 and INEC names could not be matched.
 */
export interface BoundaryProps {
  state: string | null;
  lga?: string | null;
  ward?: string | null;
  name: string;
}

export type BoundaryGeometry = GeoJSON.Polygon | GeoJSON.MultiPolygon;
export type BoundaryFeature = GeoJSON.Feature<BoundaryGeometry, BoundaryProps>;
export type BoundaryCollection = GeoJSON.FeatureCollection<BoundaryGeometry, BoundaryProps>;

export type BoundaryKind = "states" | "lgas" | "wards";

/** null when the files have not been built yet (404), so the map can fall back to points. */
async function fetchBoundaries(kind: BoundaryKind, stateCode?: string | null): Promise<BoundaryCollection | null> {
  const path = kind === "wards" ? `/boundaries/wards/${stateCode}.json` : `/boundaries/${kind}.json`;
  const response = await fetch(path);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
  return (await response.json()) as BoundaryCollection;
}

/** Outlines never change while the app runs, so they are fetched once and kept. */
export function useBoundaries(kind: BoundaryKind, stateCode?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["boundaries", kind, kind === "wards" ? stateCode ?? null : null],
    queryFn: () => fetchBoundaries(kind, stateCode),
    enabled: enabled && (kind !== "wards" || Boolean(stateCode)),
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 1,
  });
}

export type LngLatBounds = [[number, number], [number, number]];

/** Bounding box of one or more shapes, or null for none. */
export function boundsOf(features: BoundaryFeature[]): LngLatBounds | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const feature of features) {
    for (const ring of outerRings(feature.geometry)) {
      for (const [x, y] of ring) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  return Number.isFinite(minX) ? [[minX, minY], [maxX, maxY]] : null;
}

/** The outer ring of each polygon part (holes left out). */
export function outerRings(geometry: BoundaryGeometry): GeoJSON.Position[][] {
  return geometry.type === "Polygon" ? [geometry.coordinates[0]] : geometry.coordinates.map((part) => part[0]);
}
