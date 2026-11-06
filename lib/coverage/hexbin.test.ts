import { describe, expect, it } from "vitest";
import { coverageTier, hexBin } from "./hexbin";

const point = (latitude: number, longitude: number, totalPUs = 1, coveredPUs = 0) => ({
  latitude,
  longitude,
  totalPUs,
  coveredPUs,
});

describe("hexBin", () => {
  it("returns nothing for no points", () => {
    expect(hexBin([], 1000)).toEqual([]);
  });

  it("puts nearby points in one hexagon and adds their counts", () => {
    const bins = hexBin([point(9.0, 7.0, 3, 1), point(9.0001, 7.0001, 2, 2)], 5000);
    expect(bins).toHaveLength(1);
    expect(bins[0]).toMatchObject({ totalPUs: 5, coveredPUs: 3, locations: 2 });
  });

  it("keeps far-apart points in different hexagons", () => {
    const bins = hexBin([point(6.5, 3.4), point(12.0, 8.5)], 5000);
    expect(bins).toHaveLength(2);
  });

  it("centres each hexagon within its radius of the points in it", () => {
    const [bin] = hexBin([point(9.05, 7.48)], 2000);
    const [lon, lat] = bin.position;
    const dx = (lon - 7.48) * 111_320 * Math.cos((9.05 * Math.PI) / 180);
    const dy = (lat - 9.05) * 110_540;
    expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(2000);
  });

  it("conserves every polling unit across bins", () => {
    const points = Array.from({ length: 200 }, (_, i) => point(5 + (i % 20) * 0.4, 3 + Math.floor(i / 20) * 0.9, i % 7, i % 3));
    const bins = hexBin(points, 20_000);
    const total = points.reduce((sum, p) => sum + p.totalPUs, 0);
    expect(bins.reduce((sum, b) => sum + b.totalPUs, 0)).toBe(total);
  });
});

describe("coverageTier", () => {
  it("uses the legend bands", () => {
    expect(coverageTier(0, 0)).toBe("none");
    expect(coverageTier(7, 10)).toBe("high");
    expect(coverageTier(4, 10)).toBe("medium");
    expect(coverageTier(39, 100)).toBe("low");
  });
});
