"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Map, { NavigationControl, useControl, type MapRef } from "react-map-gl/maplibre";
import { MapboxOverlay, type MapboxOverlayProps } from "@deck.gl/mapbox";
import { ColumnLayer, GeoJsonLayer, ScatterplotLayer, TextLayer } from "@deck.gl/layers";
import type { GeoJSONSource } from "maplibre-gl";
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
const MASK_SOURCE = "focus-mask";
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

interface AreaLabel {
  position: [number, number];
  text: string;
}

/** Signed-area centroid of a ring, with its size, for placing a label inside the shape. */
function ringCentroid(ring: GeoJSON.Position[]): { position: [number, number]; area: number } {
  let twiceArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    const cross = x0 * y1 - x1 * y0;
    twiceArea += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  if (twiceArea === 0) {
    const [x, y] = ring[0];
    return { position: [x, y], area: 0 };
  }
  return { position: [cx / (3 * twiceArea), cy / (3 * twiceArea)], area: Math.abs(twiceArea) / 2 };
}

function pointInRing([x, y]: [number, number], ring: GeoJSON.Position[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * A point inside the ring for its label: the centroid, or for curved shapes whose centroid falls
 * outside (Kebbi, some LGAs), the middle of the widest stretch of the shape at that height.
 */
function labelPoint(ring: GeoJSON.Position[]): { position: [number, number]; area: number } {
  const centroid = ringCentroid(ring);
  if (centroid.area === 0 || pointInRing(centroid.position, ring)) return centroid;
  const y = centroid.position[1];
  const crossings: number[] = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x0, y0] = ring[i];
    const [x1, y1] = ring[i + 1];
    if (y0 > y !== y1 > y) crossings.push(x0 + ((y - y0) * (x1 - x0)) / (y1 - y0));
  }
  crossings.sort((a, b) => a - b);
  let bestX = centroid.position[0];
  let bestWidth = -1;
  for (let i = 0; i + 1 < crossings.length; i += 2) {
    const width = crossings[i + 1] - crossings[i];
    if (width > bestWidth) {
      bestWidth = width;
      bestX = (crossings[i] + crossings[i + 1]) / 2;
    }
  }
  return { position: [bestX, y], area: centroid.area };
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/(^|[\s\-'(/])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/\bFct\b/g, "FCT");
}

const getCursor = ({ isHovering }: { isHovering: boolean }) => (isHovering ? "pointer" : "grab");

/** deck.gl drawn on top of MapLibre, sharing its camera. Pass memoised props: any change re-syncs. */
function DeckOverlay({ props }: { props: MapboxOverlayProps }) {
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
 * over everything outside it. It is worked out once the camera stops, and the blur is hidden while
 * the map moves (the faded wash drawn by deck.gl stays): projecting thousands of border points and
 * re-blurring the map on every frame is what made panning and zooming lag.
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
      const parts = [`M0 0H${w}V${h}H0Z`];
      for (const ring of outerRings(focusShape.geometry)) {
        let d = "";
        let lastX = Infinity;
        let lastY = Infinity;
        ring.forEach(([lng, lat], i) => {
          const { x, y } = map.project([lng, lat]);
          // Points closer than a pixel to the last one add nothing on screen.
          if (i > 0 && i < ring.length - 1 && Math.abs(x - lastX) < 1 && Math.abs(y - lastY) < 1) return;
          d += `${d ? "L" : "M"}${Math.round(x)} ${Math.round(y)}`;
          lastX = x;
          lastY = y;
        });
        parts.push(`${d}Z`);
      }
      setClipPath(`path(evenodd, "${parts.join("")}")`);
    });
  }, [mapRef, focusShape]);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
    const hide = () => {
      cancelAnimationFrame(frame.current);
      setClipPath(null);
    };
    map.on("movestart", hide);
    map.on("moveend", update);
    map.on("resize", update);
    if (!map.isMoving()) update();
    return () => {
      map.off("movestart", hide);
      map.off("moveend", update);
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
  const { clipPath, update: updateClip } = useOutsideClipPath(mapRef, loaded ? focusShape : null);

  const statByCode = useMemo(() => new globalThis.Map(areaStats.map((s) => [s.code, s])), [areaStats]);
  const visiblePoints = useMemo(
    () => (mode === "areas" ? [] : points.filter((p) => visibleCategories[categoryOf(p)])),
    [mode, points, visibleCategories],
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

  // The wash over everything outside the focused area: a world-sized polygon with the area cut
  // out. Nationally that is 37 state-shaped holes whose borders overlap slightly, which took
  // deck.gl over 10 s to triangulate on the main thread and froze the page. MapLibre draws it
  // instead: it triangulates in a background worker, tile by tile, so the page stays responsive.
  const maskGeoJson = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: focusShape
        ? [
            {
              type: "Feature",
              properties: {},
              geometry: {
                type: "Polygon",
                coordinates: [
                  [
                    [-30, -40],
                    [60, -40],
                    [60, 50],
                    [-30, 50],
                    [-30, -40],
                  ],
                  ...outerRings(focusShape.geometry),
                ],
              },
            },
          ]
        : [],
    }),
    [focusShape],
  );
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !loaded) return;
    const source = map.getSource(MASK_SOURCE) as GeoJSONSource | undefined;
    if (source) {
      source.setData(maskGeoJson);
      return;
    }
    map.addSource(MASK_SOURCE, { type: "geojson", data: maskGeoJson });
    map.addLayer({
      id: MASK_SOURCE,
      type: "fill",
      source: MASK_SOURCE,
      paint: { "fill-color": "#FAFAFA", "fill-opacity": 0.6, "fill-antialias": false },
    });
  }, [loaded, maskGeoJson]);
  const areaData = useMemo(
    () => ({ type: "FeatureCollection" as const, features: areaShapes }),
    [areaShapes],
  );
  const focusData = useMemo(
    () => ({ type: "FeatureCollection" as const, features: focusShape ? [focusShape] : [] }),
    [focusShape],
  );
  // One label per area, at the middle of its largest piece (GRID3 can split one INEC ward into
  // several shapes; those share a code and get a single label).
  const labelData = useMemo<AreaLabel[]>(() => {
    const best = new globalThis.Map<string, AreaLabel & { area: number }>();
    for (const feature of areaShapes) {
      const code = feature.properties[areaCodeKey] ?? null;
      const key = code ?? `name:${feature.properties.name}`;
      for (const ring of outerRings(feature.geometry)) {
        const { position, area } = labelPoint(ring);
        const current = best.get(key);
        if (!current || area > current.area) {
          const name = (code ? statByCode.get(code)?.name : undefined) ?? feature.properties.name;
          best.set(key, { position, area, text: titleCase(name) });
        }
      }
    }
    return [...best.values()].map(({ position, text }) => ({ position, text }));
  }, [areaShapes, areaCodeKey, statByCode]);

  // The page keeps onPickArea stable (useCallback), so it does not rebuild the layers.
  const canPick = Boolean(onPickArea);

  const layers = useMemo(() => {
    const list: Layer[] = [];

    // 1. (The wash outside the focused area is a MapLibre layer; see maskGeoJson.)

    // 2. Child areas coloured by official coverage (areas view) or outlined (other views).
    if (areaShapes.length) {
      list.push(
        new GeoJsonLayer<BoundaryProps>({
          id: "areas",
          data: areaData,
          filled: true,
          stroked: true,
          pickable: level !== "ward",
          // Hover highlight is done on the GPU, so moving the mouse never re-renders or recolours.
          autoHighlight: true,
          highlightColor: mode === "areas" ? [10, 10, 10, 60] : [255, 255, 255, 90],
          getFillColor: (f): RGBA =>
            mode === "areas" ? fillFor(f.properties[areaCodeKey] ?? null, 175) : [255, 255, 255, 0],
          getLineColor: mode === "areas" ? [255, 255, 255, 230] : [82, 82, 82, 160],
          getLineWidth: 1,
          lineWidthUnits: "pixels",
          onClick: (info: PickingInfo<BoundaryFeature>) => {
            const code = info.object?.properties[areaCodeKey];
            if (code) onPickArea?.(code);
          },
          updateTriggers: {
            getFillColor: [mode, statByCode, areaCodeKey],
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
          data: focusData,
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

    // 5. Area names, on top of everything else.
    if (labelData.length) {
      list.push(
        new TextLayer<AreaLabel>({
          id: "area-labels",
          data: labelData,
          getPosition: (d) => d.position,
          getText: (d) => d.text,
          getSize: level === "national" ? 11 : 12,
          sizeUnits: "pixels",
          getColor: [23, 23, 23, 235],
          fontFamily: "Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          fontWeight: 600,
          characterSet: "auto",
          // A white halo keeps names readable over any fill colour.
          fontSettings: { sdf: true },
          outlineWidth: 3,
          outlineColor: [255, 255, 255, 230],
          getTextAnchor: "middle",
          getAlignmentBaseline: "center",
          pickable: false,
        }),
      );
    }

    return list;
  }, [focusShape, areaData, focusData, areaShapes.length, level, mode, areaCodeKey, fillFor, statByCode, onPickArea, hexes, maxHexTotal, visiblePoints, labelData]);

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
        const hint = level !== "ward" && canPick ? `<br/><span style="color:#737373">Click to open</span>` : "";
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
    [areaCodeKey, statByCode, level, canPick],
  );

  const overlayProps = useMemo(() => ({ layers, getTooltip, getCursor }), [layers, getTooltip]);

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
          const map = mapRef.current?.getMap();
          // Our own labels name the states, LGAs and wards, so hide the base map's state and
          // country names to avoid duplicates and clashes. Cities, towns and roads stay.
          for (const layer of map?.getStyle().layers ?? []) {
            if (layer.type === "symbol" && /^label_(state|country)/.test(layer.id)) {
              map?.setLayoutProperty(layer.id, "visibility", "none");
            }
          }
          const canvas = map?.getCanvas();
          canvas?.setAttribute("aria-label", "Interactive map of polling-unit coverage in Nigeria");
          canvas?.setAttribute("aria-describedby", instructionsId);
          setLoaded(true);
          updateClip();
        }}
        attributionControl={{ compact: true }}
      >
        <NavigationControl position="top-right" showCompass={mode === "hexagons"} visualizePitch />
        <DeckOverlay props={overlayProps} />
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
