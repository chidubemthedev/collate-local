"use client";

import { useId, useMemo, useRef, useState } from "react";
import Map, {
  Layer,
  NavigationControl,
  Popup,
  Source,
  type MapLayerMouseEvent,
  type MapRef,
} from "react-map-gl/maplibre";
import type {
  CircleLayerSpecification,
  GeoJSONSource,
  SymbolLayerSpecification,
} from "maplibre-gl";
import mapLibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import type { CoverageMapPoint } from "@/types/api";

interface InteractiveCoordinateMapProps {
  points: CoverageMapPoint[];
  viewKey: string;
}

interface SelectedPoint {
  longitude: number;
  latitude: number;
  totalPUs: number;
  coveredPUs: number;
}

const NIGERIA_VIEW_BOUNDS: [[number, number], [number, number]] = [
  [2, 2],
  [16, 15],
];
const NIGERIA_MAX_BOUNDS: [number, number, number, number] = [2, 2, 16, 15];

const mapStyle = {
  version: 8 as const,
  glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
  sources: {
    openStreetMap: {
      type: "raster" as const,
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
      maxzoom: 19,
    },
  },
  layers: [
    {
      id: "openStreetMap",
      type: "raster" as const,
      source: "openStreetMap",
    },
  ],
};

const clusterLayer: CircleLayerSpecification = {
  id: "coordinate-clusters",
  type: "circle",
  source: "coordinate-points",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": "#475569",
    "circle-radius": [
      "step",
      ["get", "point_count"],
      8,
      20,
      10,
      100,
      13,
      500,
      16,
      2000,
      20,
    ],
    "circle-opacity": 0.85,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 2,
  },
};

const clusterCountLayer: SymbolLayerSpecification = {
  id: "coordinate-cluster-count",
  type: "symbol",
  source: "coordinate-points",
  filter: ["has", "point_count"],
  layout: {
    "text-field": ["to-string", ["get", "totalPUs"]],
    "text-font": ["Noto Sans Regular"],
    "text-size": 11,
  },
  paint: { "text-color": "#ffffff" },
};

const individualPointLayer: CircleLayerSpecification = {
  id: "coordinate-single-points",
  type: "circle",
  source: "coordinate-points",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-color": [
      "case",
      ["==", ["get", "coveredPUs"], 0],
      "#f59e0b",
      ["==", ["get", "coveredPUs"], ["get", "totalPUs"]],
      "#10b981",
      "#6366f1",
    ],
    "circle-radius": [
      "interpolate",
      ["linear"],
      ["zoom"],
      4,
      [
        "case",
        [
          "all",
          [">", ["get", "coveredPUs"], 0],
          ["<", ["get", "coveredPUs"], ["get", "totalPUs"]],
        ],
        3,
        5,
      ],
      10,
      [
        "case",
        [
          "all",
          [">", ["get", "coveredPUs"], 0],
          ["<", ["get", "coveredPUs"], ["get", "totalPUs"]],
        ],
        5,
        7,
      ],
      15,
      [
        "case",
        [
          "all",
          [">", ["get", "coveredPUs"], 0],
          ["<", ["get", "coveredPUs"], ["get", "totalPUs"]],
        ],
        7,
        9,
      ],
    ],
    "circle-opacity": 1,
    "circle-stroke-color": "#ffffff",
    "circle-stroke-width": 1,
  },
};

export function InteractiveCoordinateMap({
  points,
  viewKey,
}: InteractiveCoordinateMapProps) {
  const mapRef = useRef<MapRef>(null);
  const instructionsId = useId();
  const [selectedPoint, setSelectedPoint] = useState<SelectedPoint | null>(null);
  const [hoveredMixedPoint, setHoveredMixedPoint] = useState<SelectedPoint | null>(null);

  const geoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point, CoverageMapPoint>>(
    () => ({
      type: "FeatureCollection",
      features: points.map((point) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [point.longitude, point.latitude],
        },
        properties: point,
      })),
    }),
    [points],
  );

  const initialViewState = useMemo(() => {
    if (points.length === 0) {
      return {
        bounds: NIGERIA_VIEW_BOUNDS,
        fitBoundsOptions: { padding: 24, maxZoom: 6 },
      };
    }

    let minLongitude = Infinity;
    let maxLongitude = -Infinity;
    let minLatitude = Infinity;
    let maxLatitude = -Infinity;
    for (const point of points) {
      minLongitude = Math.min(minLongitude, point.longitude);
      maxLongitude = Math.max(maxLongitude, point.longitude);
      minLatitude = Math.min(minLatitude, point.latitude);
      maxLatitude = Math.max(maxLatitude, point.latitude);
    }

    if (minLongitude === maxLongitude && minLatitude === maxLatitude) {
      return {
        longitude: minLongitude,
        latitude: minLatitude,
        zoom: 12,
      };
    }

    return {
      bounds: [
        [minLongitude, minLatitude],
        [maxLongitude, maxLatitude],
      ] as [[number, number], [number, number]],
      fitBoundsOptions: { padding: 48, maxZoom: 12 },
    };
  }, [points]);

  const handleMapClick = (event: MapLayerMouseEvent) => {
    const feature = event.features?.[0];
    if (!feature) {
      setSelectedPoint(null);
      return;
    }

    const source = mapRef.current?.getMap().getSource("coordinate-points") as
      | GeoJSONSource
      | undefined;
    if (feature.layer.id === clusterLayer.id) {
      const clusterId = Number(feature.properties?.cluster_id);
      if (!Number.isFinite(clusterId) || !source) return;

      void source.getClusterExpansionZoom(clusterId).then((zoom) => {
        const [longitude, latitude] = (
          feature.geometry as GeoJSON.Point
        ).coordinates;
        mapRef.current?.getMap().easeTo({
          center: [longitude, latitude],
          zoom,
          duration: 500,
        });
      }).catch((error: unknown) => {
        console.error("[CoverageMap] failed to expand coordinate cluster", error);
      });
      return;
    }

    const point = feature.properties;
    if (!point) return;
    handleSelectPoint({
      longitude: Number(point.longitude),
      latitude: Number(point.latitude),
      totalPUs: Number(point.totalPUs),
      coveredPUs: Number(point.coveredPUs),
    });
  };

  const handleMapMouseMove = (event: MapLayerMouseEvent) => {
    const feature = event.features?.find(
      (candidate) => candidate.layer.id === individualPointLayer.id,
    );
    const point = feature?.properties;
    if (
      !point ||
      Number(point.coveredPUs) <= 0 ||
      Number(point.coveredPUs) >= Number(point.totalPUs)
    ) {
      setHoveredMixedPoint(null);
      return;
    }

    const hoveredPoint = {
      longitude: Number(point.longitude),
      latitude: Number(point.latitude),
      totalPUs: Number(point.totalPUs),
      coveredPUs: Number(point.coveredPUs),
    };
    setHoveredMixedPoint((current) =>
      current?.longitude === hoveredPoint.longitude &&
      current.latitude === hoveredPoint.latitude
        ? current
        : hoveredPoint,
    );
  };

  const handleMapLoad = () => {
    const canvas = mapRef.current?.getMap().getCanvas();
    canvas?.setAttribute(
      "aria-label",
      "Interactive map of polling-unit coverage in Nigeria",
    );
    canvas?.setAttribute("aria-describedby", instructionsId);
  };

  const handleSelectPoint = (point: CoverageMapPoint) => {
    const { longitude, latitude, totalPUs, coveredPUs } = point;
    setHoveredMixedPoint(null);
    setSelectedPoint({ longitude, latitude, totalPUs, coveredPUs });
    const map = mapRef.current?.getMap();
    map?.easeTo({
      center: [longitude, latitude],
      zoom: Math.max(map.getZoom(), 12),
      duration: 500,
    });
  };

  return (
    <div className="space-y-3">
      <div className="coverage-coordinate-map relative h-[min(55svh,440px)] min-h-[260px] overflow-hidden rounded-lg border border-border sm:h-[480px]">
        <p id={instructionsId} className="sr-only">
          Use the arrow keys to pan the map and plus or minus to zoom. On touch screens, drag to
          pan and pinch to zoom. Select a marker to read its coverage counts.
        </p>
        <Map
          key={viewKey}
          ref={mapRef}
          initialViewState={initialViewState}
          mapStyle={mapStyle}
          workerUrl={mapLibreWorkerUrl}
          maxBounds={NIGERIA_MAX_BOUNDS}
          minZoom={5}
          interactiveLayerIds={[clusterLayer.id, individualPointLayer.id]}
          onLoad={handleMapLoad}
          onClick={handleMapClick}
          onMouseMove={handleMapMouseMove}
          onMouseLeave={() => setHoveredMixedPoint(null)}
          onMoveStart={(event) => {
            if (event.originalEvent) setSelectedPoint(null);
          }}
          cursor="pointer"
        >
          <NavigationControl position="top-right" showCompass={false} />
          <Source
            id="coordinate-points"
            type="geojson"
            data={geoJson}
            cluster
            clusterMaxZoom={13}
            clusterRadius={40}
            clusterProperties={{
              totalPUs: ["+", ["get", "totalPUs"]],
              coveredPUs: ["+", ["get", "coveredPUs"]],
            }}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...individualPointLayer} />
          </Source>
          {selectedPoint && (
            <Popup
              longitude={selectedPoint.longitude}
              latitude={selectedPoint.latitude}
              anchor="bottom"
              closeButton
              closeOnClick={false}
              onClose={() => setSelectedPoint(null)}
            >
              <div className="space-y-1 text-xs">
                <p className="font-semibold">
                  {selectedPoint.totalPUs.toLocaleString()} polling unit
                  {selectedPoint.totalPUs === 1 ? "" : "s"} at this coordinate
                </p>
                <p className="text-emerald-700">
                  {selectedPoint.coveredPUs.toLocaleString()} with an official agent
                </p>
                <p className="text-amber-700">
                  {(selectedPoint.totalPUs - selectedPoint.coveredPUs).toLocaleString()} without
                  one
                </p>
                <p className="pt-1 text-[10px] text-muted-foreground">
                  {selectedPoint.latitude.toFixed(5)}, {selectedPoint.longitude.toFixed(5)}
                </p>
              </div>
            </Popup>
          )}
          {!selectedPoint && hoveredMixedPoint && (
            <Popup
              longitude={hoveredMixedPoint.longitude}
              latitude={hoveredMixedPoint.latitude}
              anchor="bottom"
              closeButton={false}
              closeOnClick={false}
              className="pointer-events-none"
            >
              <div className="space-y-1 text-xs">
                <p className="font-semibold">Mixed coverage at this location</p>
                <p>
                  {hoveredMixedPoint.coveredPUs.toLocaleString()} of{" "}
                  {hoveredMixedPoint.totalPUs.toLocaleString()} polling units have an official agent
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Select a marker to view its coverage counts.
                </p>
              </div>
            </Popup>
          )}
        </Map>
      </div>
    </div>
  );
}
