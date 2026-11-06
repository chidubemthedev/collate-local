"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Map, { NavigationControl, useControl, type MapRef } from "react-map-gl/maplibre";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import { ColumnLayer, GeoJsonLayer, PolygonLayer, ScatterplotLayer } from "@deck.gl/layers";
import type { Layer, PickingInfo } from "@deck.gl/core";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { CoverageMapPoint } from "@/types/api";
import {
  boundsOf,
  outerRings,
  type BoundaryFeature,
  type BoundaryProps,
  type LngLatBounds,
} from "@/lib/coverage/boundaries";
import { coverageTier, HEX_RADIUS_METRES, hexBin, TIER_RGB, type HexBin } from "@/lib/coverage/hexbin";

export type MapLevel = "national" | "state" | "lga" | "ward";
export type MapMode = "areas" | "hexagons" | "points";
export type MarkerCategory = "covered" | "gap" | "mixed";

/** Coverage of one child area (a state, LGA or ward), keyed by its INEC code. */
export interface AreaStat {
  code: string;
  name: string;
  totalPUs: number;
  coveredPUs: number;
}

interface CoverageDeckMapProps {
  level: MapLevel;
  mode: MapMode;
  /** Child areas to colour: the states, the LGAs of the state, or the wards of the LGA. */
  areaShapes: BoundaryFeature[];
  areaStats: AreaStat[];
  /** Which property of an area shape holds its code at this level. */
  areaCodeKey: keyof Pick<BoundaryProps, "state" | "lga" | "ward">;
  /** The area picked in the filters; everything outside it is dimmed and blurred. */
  focusShape: BoundaryFeature | null;
  points: CoverageMapPoint[];
  visibleCategories: Record<MarkerCategory, boolean>;
  viewKey: string;
  onPickArea?: (code: string) => void;
}

const NIGERIA_BOUNDS: LngLatBounds = [
  [2.6, 4.2],
  [14.7, 13.9],
];
const NIGERIA_MAX_BOUNDS: [number, number, number, number] = [0, 1, 18, 16];
const mapStyle = "https://tiles.openfreemap.org/styles/positron";
/** Inline so the map never collapses to 0 px if a stylesheet is stale. */
export const MAP_HEIGHT = "clamp(280px, 60svh, 520px)";

const CATEGORY_RGB: Record<MarkerCategory, [number, number, number]> = {
  covered: [16, 185, 129],
  gap: [245, 158, 11],
  mixed: [99, 102, 241],
};

function categoryOf(point: CoverageMapPoint): MarkerCategory {
  if (point.coveredPUs <= 0) return "gap";
  if (point.coveredPUs >= point.totalPUs) return "covered";
  return "mixed";
}

type RGBA = [number, number, number, number];

function rgba([r, g, b]: [number, number, number], a: number): RGBA {
  return [r, g, b, a];
}

function pct(covered: number, total: number) {
  return total > 0 ? Math.round((covered / total) * 100) : 0;
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[\s\-'(/])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bFct\b/g, "FCT");
}

/** deck.gl drawn on top of MapLibre, sharing its camera. */
function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  useEffect(() => {
    overlay.setProps(props);
  }, [overlay, props]);
  return null;
}

function pointsBounds(points: CoverageMapPoint[]): LngLatBounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.longitude);
    maxX = Math.max(maxX, p.longitude);
    minY = Math.min(minY, p.latitude);
    maxY = Math.max(maxY, p.latitude);
  }
  return [
    [minX, minY],
    [maxX, maxY],
  ];
}

/**
 * Builds a CSS clip-path that covers the whole map except the focused area, so a blur can be laid
 * over everything outside it. Points are projected to screen pixels on every camera move.
 */
function useOutsideClipPath(mapRef: React.RefObject<MapRef | null>, focusShape: BoundaryFeature | null) {
  const [clipPath, setClipPath] = useState<string | null>(null);
  const frame = useRef(0);

  const update = useCallback(() => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const map = mapRef.current?.getMap();
      if (!map || !focusShape) {
        setClipPath(null);
        return;
      }
      const canvas = map.getCanvas();
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      let path = `M0 0H${w}V${h}H0Z`;
      for (const ring of outerRings(focusShape.geometry)) {
        let d = "";
        ring.forEach(([lng, lat], i) => {
          const { x, y } = map.project([lng, lat]);
          d += `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        });
        path += `${d}Z`;
      }
      setClipPath(`path(evenodd, "${path}")`);
    });
  }, [mapRef, focusShape]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    map.on("move", update);
    map.on("resize", update);
    update();
    return () => {
      map.off("move", update);
      map.off("resize", update);
      cancelAnimationFrame(frame.current);
    };
  }, [mapRef, update]);

  return { clipPath, update };
}

export function CoverageDeckMap({
  level,
  mode,
  areaShapes,
  areaStats,
  areaCodeKey,
  focusShape,
  points,
  visibleCategories,
  viewKey,
  onPickArea,
}: CoverageDeckMapProps) {
  const mapRef = useRef<MapRef>(null);
  const instructionsId = useId();
  const [loaded, setLoaded] = useState(false);
  const [hoverCode, setHoverCode] = useState<string | null>(null);
  const { clipPath, update: updateClip } = useOutsideClipPath(mapRef, loaded ? focusShape : null);

  const statByCode = useMemo(() => new globalThis.Map(areaStats.map((s) => [s.code, s])), [areaStats]);
  const visiblePoints = useMemo(
    () => points.filter((p) => visibleCategories[categoryOf(p)]),
    [points, visibleCategories],
  );
  const hexes = useMemo(
    () => (mode === "hexagons" ? hexBin(visiblePoints, HEX_RADIUS_METRES[level]) : []),
    [mode, visiblePoints, level],
  );
  const maxHexTotal = useMemo(() => hexes.reduce((max, h) => Math.max(max, h.totalPUs), 1), [hexes]);

  // Camera: fly to the focused area (or the points, or Nigeria) whenever the filters change.
  const targetBounds = useMemo<LngLatBounds>(
    () =>
      (focusShape ? boundsOf([focusShape]) : null) ??
      (level === "national" ? null : pointsBounds(points)) ??
      NIGERIA_BOUNDS,
    [focusShape, level, points],
  );
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded) return;
    map.fitBounds(targetBounds, {
      padding: 36,
      maxZoom: level === "ward" ? 15 : 12,
      pitch: mode === "hexagons" ? 45 : 0,
      bearing: 0,
      duration: 900,
    });
    // viewKey: refit when the filters change even if the bounds happen to be the same.
  }, [targetBounds, loaded, level, mode, viewKey]);

  const fillFor = useCallback(
    (code: string | null | undefined, alpha: number): RGBA => {
      const stat = code ? statByCode.get(code) : undefined;
      const rgb = stat ? TIER_RGB[coverageTier(stat.coveredPUs, stat.totalPUs)] : TIER_RGB.none;
      return rgba(rgb, alpha);
    },
    [statByCode],
  );

  const layers = useMemo(() => {
    const list: Layer[] = [];

    // 1. Wash over everything outside the focused area (the CSS blur sits on top of it).
    if (focusShape) {
      list.push(
        new PolygonLayer<{ polygon: number[][][] }>({
          id: "focus-mask",
          data: [
            {
              polygon: [
                [
                  [-30, -40],
                  [60, -40],
                  [60, 50],
                  [-30, 50],
                  [-30, -40],
                ],
                ...outerRings(focusShape.geometry).map((ring) => ring.map(([x, y]) => [x, y])),
              ],
            },
          ],
          getPolygon: (d) => d.polygon,
          getFillColor: [250, 250, 250, 150],
          stroked: false,
          pickable: false,
        }),
      );
    }

    // 2. Child areas coloured by official coverage (areas view) or outlined (other views).
    if (areaShapes.length) {
      list.push(
        new GeoJsonLayer<BoundaryProps>({
          id: "areas",
          data: { type: "FeatureCollection", features: areaShapes },
          filled: true,
          stroked: true,
          pickable: level !== "ward",
          getFillColor: (f): RGBA => {
            const code = f.properties[areaCodeKey] ?? null;
            if (mode !== "areas") return [255, 255, 255, code && code === hoverCode ? 70 : 0];
            return fillFor(code, code && code === hoverCode ? 235 : 175);
          },
          getLineColor: (f): RGBA => {
            const code = f.properties[areaCodeKey] ?? null;
            return code && code === hoverCode ? [10, 10, 10, 255] : mode === "areas" ? [255, 255, 255, 230] : [82, 82, 82, 160];
          },
          getLineWidth: (f) => (f.properties[areaCodeKey] && f.properties[areaCodeKey] === hoverCode ? 2.5 : 1),
          lineWidthUnits: "pixels",
          onHover: (info: PickingInfo<BoundaryFeature>) => setHoverCode(info.object?.properties[areaCodeKey] ?? null),
          onClick: (info: PickingInfo<BoundaryFeature>) => {
            const code = info.object?.properties[areaCodeKey];
            if (code && onPickArea) onPickArea(code);
          },
          updateTriggers: {
            getFillColor: [mode, hoverCode, statByCode, areaCodeKey],
            getLineColor: [mode, hoverCode, areaCodeKey],
            getLineWidth: [hoverCode, areaCodeKey],
          },
          transitions: { getFillColor: 300 },
        }),
      );
    }

    // 3. The focused area's own outline.
    // (Nationally the state borders already show where Nigeria ends.)
    if (focusShape && level !== "national") {
      list.push(
        new GeoJsonLayer<BoundaryProps>({
          id: "focus-outline",
          data: { type: "FeatureCollection", features: [focusShape] },
          filled: false,
          stroked: true,
          getLineColor: [10, 10, 10, 255],
          getLineWidth: 2,
          lineWidthUnits: "pixels",
          pickable: false,
        }),
      );
    }

    // 4a. Hexagons: height = polling units, colour = official coverage.
    if (mode === "hexagons") {
      list.push(
        new ColumnLayer<HexBin>({
          id: "hexagons",
          data: hexes,
          diskResolution: 6,
          radius: HEX_RADIUS_METRES[level],
          coverage: 0.88,
          extruded: true,
          getPosition: (d) => d.position,
          getElevation: (d) => (d.totalPUs / maxHexTotal) * HEX_RADIUS_METRES[level] * 14,
          getFillColor: (d) => rgba(TIER_RGB[coverageTier(d.coveredPUs, d.totalPUs)], 230),
          material: { ambient: 0.55, diffuse: 0.6, shininess: 40, specularColor: [255, 255, 255] },
          pickable: true,
          autoHighlight: true,
          highlightColor: [255, 255, 255, 110],
          transitions: { getElevation: { duration: 700 } },
          updateTriggers: { getElevation: [maxHexTotal, level] },
        }),
      );
    }

    // 4b. One dot per mapped location, coloured covered / gap / mixed.
    if (mode === "points") {
      list.push(
        new ScatterplotLayer<CoverageMapPoint>({
          id: "points",
          data: visiblePoints,
          getPosition: (d) => [d.longitude, d.latitude],
          getRadius: (d) => 40 + Math.sqrt(d.totalPUs) * 30,
          radiusUnits: "meters",
          radiusMinPixels: 2.5,
          radiusMaxPixels: 14,
          getFillColor: (d) => rgba(CATEGORY_RGB[categoryOf(d)], 235),
          stroked: true,
          getLineColor: [255, 255, 255, 220],
          lineWidthMinPixels: 1,
          pickable: true,
          autoHighlight: true,
          highlightColor: [10, 10, 10, 90],
        }),
      );
    }

    return list;
  }, [focusShape, areaShapes, level, mode, areaCodeKey, hoverCode, fillFor, statByCode, onPickArea, hexes, maxHexTotal, visiblePoints]);

  const getTooltip = useCallback(
    ({ object, layer }: PickingInfo) => {
      if (!object || !layer) return null;
      const style = {
        background: "#FFFFFF",
        color: "#0A0A0A",
        border: "1px solid #E5E5E5",
        borderRadius: "8px",
        boxShadow: "0 8px 24px rgba(20,24,30,0.14)",
        padding: "8px 10px",
        fontSize: "12px",
        fontFamily: "inherit",
        zIndex: "3",
      };
      if (layer.id === "areas") {
        const props = (object as BoundaryFeature).properties;
        const code = props[areaCodeKey] ?? null;
        const stat = code ? statByCode.get(code) : undefined;
        const name = titleCase(stat?.name ?? props.name);
        if (!stat) return { html: `<b>${name}</b><br/><span style="color:#737373">No coverage data</span>`, style };
        const hint = level !== "ward" && onPickArea ? `<br/><span style="color:#737373">Click to open</span>` : "";
        return {
          html: `<b>${name}</b><br/><span style="color:#1E8A55;font-weight:600">${pct(stat.coveredPUs, stat.totalPUs)}%</span> covered · ${stat.coveredPUs.toLocaleString()} of ${stat.totalPUs.toLocaleString()} units${hint}`,
          style,
        };
      }
      if (layer.id === "hexagons") {
        const hex = object as HexBin;
        return {
          html: `<b>${hex.totalPUs.toLocaleString()} polling units</b><br/><span style="color:#1E8A55;font-weight:600">${pct(hex.coveredPUs, hex.totalPUs)}%</span> covered · ${(hex.totalPUs - hex.coveredPUs).toLocaleString()} gaps`,
          style,
        };
      }
      if (layer.id === "points") {
        const point = object as CoverageMapPoint;
        return {
          html: `<b>${point.totalPUs.toLocaleString()} polling unit${point.totalPUs === 1 ? "" : "s"} here</b><br/>${point.coveredPUs.toLocaleString()} with an official agent · ${(point.totalPUs - point.coveredPUs).toLocaleString()} without<br/><span style="color:#737373">${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}</span>`,
          style,
        };
      }
      return null;
    },
    [areaCodeKey, statByCode, level, onPickArea],
  );

  return (
    <div
      className="coverage-coordinate-map relative overflow-hidden"
      style={{ height: MAP_HEIGHT, borderRadius: 10, background: "#FAFAFA" }}
    >
      <p id={instructionsId} className="sr-only">
        Use the arrow keys to pan the map and plus or minus to zoom. Hover an area or marker to read its coverage;
        click an area to open it.
      </p>
      <Map
        ref={mapRef}
        initialViewState={{ bounds: NIGERIA_BOUNDS, fitBoundsOptions: { padding: 24 } }}
        mapStyle={mapStyle}
        workerUrl={mapLibreWorkerUrl}
        maxBounds={NIGERIA_MAX_BOUNDS}
        minZoom={4.5}
        maxPitch={60}
        onLoad={() => {
          const canvas = mapRef.current?.getMap().getCanvas();
          canvas?.setAttribute("aria-label", "Interactive map of polling-unit coverage in Nigeria");
          canvas?.setAttribute("aria-describedby", instructionsId);
          setLoaded(true);
          updateClip();
        }}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" showCompass={mode === "hexagons"} visualizePitch />
        <DeckOverlay
          layers={layers}
          getTooltip={getTooltip}
          getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
        />
      </Map>
      {clipPath ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            zIndex: 1,
            clipPath,
            backdropFilter: "blur(3px) saturate(0.5)",
            WebkitBackdropFilter: "blur(3px) saturate(0.5)",
          }}
        />
      ) : null}
    </div>
  );
}
