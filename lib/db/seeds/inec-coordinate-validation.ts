import { normalizeLocationName } from "./inec-coordinates";

export const GEOBOUNDARIES_ADM1_URL =
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM1/geoBoundaries-NGA-ADM1.geojson";
export const GEOBOUNDARIES_ADM2_URL =
  "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/NGA/ADM2/geoBoundaries-NGA-ADM2.geojson";

// Boundary data is generalised, so points a little outside the line are not treated as errors.
export const STATE_TOLERANCE_KM = 2;
// LGAs are small; a point this far outside its own LGA is a homonym or fallback geocode, not noise.
export const LGA_TOLERANCE_KM = 25;

type Ring = number[][];

export interface BoundaryShape {
  name: string;
  polygons: Ring[][];
  bbox: [number, number, number, number];
}

export interface CoordinateBoundaries {
  states: Map<string, BoundaryShape>;
  lgas: Map<string, BoundaryShape[]>;
}

export type CoordinateCheck =
  | { ok: true }
  | { ok: false; reason: "outside_state" | "far_from_lga"; distanceKm: number };

interface GeoJsonCollection {
  features: Array<{
    properties: { shapeName: string };
    geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Ring[] | Ring[][] };
  }>;
}

export function normalizeStateName(value: string): string {
  const normalized = normalizeLocationName(value);
  return normalized.includes("federal capital") || normalized === "fct" || normalized.includes("abuja")
    ? "fct"
    : normalized;
}

function toShapes(geoJson: string): BoundaryShape[] {
  const collection = JSON.parse(geoJson) as GeoJsonCollection;
  return collection.features.map((feature) => {
    const polygons =
      feature.geometry.type === "Polygon"
        ? [feature.geometry.coordinates as Ring[]]
        : (feature.geometry.coordinates as Ring[][]);
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const polygon of polygons) {
      for (const [x, y] of polygon[0]) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    return { name: feature.properties.shapeName, polygons, bbox: [minX, minY, maxX, maxY] };
  });
}

function inRing(x: number, y: number, ring: Ring): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function contains(shape: BoundaryShape, longitude: number, latitude: number): boolean {
  const [minX, minY, maxX, maxY] = shape.bbox;
  if (longitude < minX || longitude > maxX || latitude < minY || latitude > maxY) return false;
  return shape.polygons.some(
    (polygon) =>
      inRing(longitude, latitude, polygon[0]) &&
      !polygon.slice(1).some((hole) => inRing(longitude, latitude, hole)),
  );
}

function segmentDistanceKm(px: number, py: number, a: number[], b: number[]): number {
  const scale = Math.cos((py * Math.PI) / 180);
  const ax = (a[0] - px) * scale;
  const ay = a[1] - py;
  const dx = (b[0] - px) * scale - ax;
  const dy = b[1] - py - ay;
  const length = dx * dx + dy * dy;
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / length));
  return Math.hypot(ax + t * dx, ay + t * dy) * 111.32;
}

function distanceKm(shape: BoundaryShape, longitude: number, latitude: number): number {
  let best = Infinity;
  for (const polygon of shape.polygons) {
    for (const ring of polygon) {
      for (let i = 1; i < ring.length; i += 1) {
        const distance = segmentDistanceKm(longitude, latitude, ring[i - 1], ring[i]);
        if (distance < best) best = distance;
      }
    }
  }
  return best;
}

// The ADM2 file has no parent state, so each LGA is assigned the state holding most of its vertices.
function parentStateKey(lga: BoundaryShape, states: Map<string, BoundaryShape>): string | null {
  const ring = lga.polygons.reduce((longest, polygon) => (polygon[0].length > longest.length ? polygon[0] : longest), [] as Ring);
  const step = Math.max(1, Math.floor(ring.length / 40));
  const votes = new Map<string, number>();
  for (let i = 0; i < ring.length; i += step) {
    for (const [key, state] of states) {
      if (contains(state, ring[i][0], ring[i][1])) votes.set(key, (votes.get(key) ?? 0) + 1);
    }
  }
  let winner: string | null = null;
  let top = 0;
  for (const [key, count] of votes) {
    if (count > top) {
      winner = key;
      top = count;
    }
  }
  return winner;
}

export function buildBoundaries(adm1GeoJson: string, adm2GeoJson: string): CoordinateBoundaries {
  const states = new Map(toShapes(adm1GeoJson).map((shape) => [normalizeStateName(shape.name), shape]));
  const lgas = new Map<string, BoundaryShape[]>();
  for (const lga of toShapes(adm2GeoJson)) {
    const stateKey = parentStateKey(lga, states);
    if (!stateKey) continue;
    const key = `${stateKey}\u001f${normalizeLocationName(lga.name)}`;
    lgas.set(key, [...(lgas.get(key) ?? []), lga]);
  }
  return { states, lgas };
}

/**
 * Checks a stored point against its own state, and its own LGA when the LGA name
 * matches a boundary. LGAs without a name match are only checked at state level.
 */
export function checkCoordinate(
  boundaries: CoordinateBoundaries,
  place: { stateName: string; lgaName: string },
  longitude: number,
  latitude: number,
): CoordinateCheck {
  const stateKey = normalizeStateName(place.stateName);
  const state = boundaries.states.get(stateKey);
  if (!state) return { ok: true };

  if (!contains(state, longitude, latitude)) {
    const distance = distanceKm(state, longitude, latitude);
    if (distance > STATE_TOLERANCE_KM) return { ok: false, reason: "outside_state", distanceKm: distance };
  }

  const lgas = boundaries.lgas.get(`${stateKey}\u001f${normalizeLocationName(place.lgaName)}`);
  if (lgas && !lgas.some((lga) => contains(lga, longitude, latitude))) {
    const distance = Math.min(...lgas.map((lga) => distanceKm(lga, longitude, latitude)));
    if (distance > LGA_TOLERANCE_KM) return { ok: false, reason: "far_from_lga", distanceKm: distance };
  }

  return { ok: true };
}
