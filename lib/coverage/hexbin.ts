import type { CoverageMapPoint } from "@/types/api";

export interface HexBin {
  /** Centre of the hexagon, [longitude, latitude]. */
  position: [number, number];
  totalPUs: number;
  coveredPUs: number;
  /** Mapped locations that fell in this hexagon. */
  locations: number;
}

const METRES_PER_DEGREE_LAT = 110_540;
const METRES_PER_DEGREE_LON_AT_EQUATOR = 111_320;
const SQRT3 = Math.sqrt(3);

/**
 * Groups points into pointy-top hexagons `radius` metres across (centre to corner).
 * Longitude is scaled at the data's middle latitude, which is close enough across Nigeria (4–14°N).
 */
export function hexBin(points: CoverageMapPoint[], radius: number): HexBin[] {
  if (points.length === 0 || radius <= 0) return [];
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const point of points) {
    if (point.latitude < minLat) minLat = point.latitude;
    if (point.latitude > maxLat) maxLat = point.latitude;
  }
  const lonScale = METRES_PER_DEGREE_LON_AT_EQUATOR * Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);

  const bins = new Map<string, HexBin & { q: number; r: number }>();
  for (const point of points) {
    const x = point.longitude * lonScale;
    const y = point.latitude * METRES_PER_DEGREE_LAT;
    // Pixel → axial coordinates for pointy-top hexagons, then cube rounding.
    const qf = ((SQRT3 / 3) * x - y / 3) / radius;
    const rf = ((2 / 3) * y) / radius;
    const [q, r] = cubeRound(qf, rf);
    const key = `${q},${r}`;
    let bin = bins.get(key);
    if (!bin) {
      const cx = radius * SQRT3 * (q + r / 2);
      const cy = radius * 1.5 * r;
      bin = { q, r, position: [cx / lonScale, cy / METRES_PER_DEGREE_LAT], totalPUs: 0, coveredPUs: 0, locations: 0 };
      bins.set(key, bin);
    }
    bin.totalPUs += point.totalPUs;
    bin.coveredPUs += point.coveredPUs;
    bin.locations += 1;
  }
  return [...bins.values()].map(({ position, totalPUs, coveredPUs, locations }) => ({
    position,
    totalPUs,
    coveredPUs,
    locations,
  }));
}

function cubeRound(qf: number, rf: number): [number, number] {
  const sf = -qf - rf;
  let q = Math.round(qf);
  let r = Math.round(rf);
  const s = Math.round(sf);
  const dq = Math.abs(q - qf);
  const dr = Math.abs(r - rf);
  const ds = Math.abs(s - sf);
  if (dq > dr && dq > ds) q = -r - s;
  else if (dr > ds) r = -q - s;
  // -0 and 0 are the same hexagon.
  return [q + 0, r + 0];
}

/** Hexagon size for each level: about 30 across Nigeria, a few hundred metres inside a ward. */
export const HEX_RADIUS_METRES = { national: 22_000, state: 5_000, lga: 1_200, ward: 250 } as const;

export type CoverageTier = "high" | "medium" | "low" | "none";

/** Same bands as the map legend: 70%+, 40–69%, under 40%. */
export function coverageTier(covered: number, total: number): CoverageTier {
  if (total <= 0) return "none";
  const pct = (covered / total) * 100;
  if (pct >= 70) return "high";
  if (pct >= 40) return "medium";
  return "low";
}

export const TIER_RGB: Record<CoverageTier, [number, number, number]> = {
  high: [34, 160, 107],
  medium: [143, 211, 168],
  low: [232, 137, 43],
  none: [212, 212, 212],
};
