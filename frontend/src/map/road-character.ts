import type { GeoJSONSource, MapSourceDataEvent, Map as MapLibreMap } from 'maplibre-gl';
import {
  buildRoadGraph,
  moveAlongRoads,
  positionToLngLat,
  snapToRoad,
  type Direction,
  type LngLat,
  type RoadGraph,
  type RoadPosition,
} from './road-graph';

/** Vector source and layer of the OpenFreeMap (OpenMapTiles schema) style. */
const ROAD_SOURCE = 'openmaptiles';
const ROAD_SOURCE_LAYER = 'transportation';
/** Everything you can walk or drive on: no rail, ferries, aerialways or area polygons. */
const ROAD_CLASSES = [
  'motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service', 'track', 'path', 'pedestrian',
];

const LAYER_ID = 'road-character';
const SPEED_MPS = 40;
/** Small alleys are only in the tiles from about this zoom. */
const MIN_ZOOM = 16;

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: [0, 1], w: [0, 1],
  ArrowDown: [0, -1], s: [0, -1],
  ArrowLeft: [-1, 0], a: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0],
};

const pointFeature = (p: LngLat): GeoJSON.Feature<GeoJSON.Point> => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: p },
  properties: {},
});

/** Collects the loaded road lines from the style's vector tiles. */
function readRoadLines(map: MapLibreMap): LngLat[][] {
  const features = map.querySourceFeatures(ROAD_SOURCE, {
    sourceLayer: ROAD_SOURCE_LAYER,
    filter: ['in', ['get', 'class'], ['literal', ROAD_CLASSES]],
  });
  return features.flatMap((f) => {
    const g = f.geometry;
    if (g.type === 'LineString') return [g.coordinates as LngLat[]];
    if (g.type === 'MultiLineString') return g.coordinates as LngLat[][];
    return [];
  });
}

/**
 * A dot the user drives along the roads with the arrow keys or WASD.
 * The road graph is rebuilt from the loaded tiles whenever the map settles.
 */
export class RoadCharacter {
  private graph: RoadGraph = buildRoadGraph([]);
  private position: RoadPosition | null = null;
  private readonly pressed = new Set<string>();
  private frame = 0;
  private lastTime = 0;
  /** Set when road tiles load; the graph is rebuilt on the next idle only then. */
  private roadsChanged = true;

  constructor(private readonly map: MapLibreMap) {}

  start() {
    const { map } = this;
    map.addSource(LAYER_ID, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: LAYER_ID,
      type: 'circle',
      source: LAYER_ID,
      paint: { 'circle-radius': 8, 'circle-color': '#e53935', 'circle-stroke-width': 3, 'circle-stroke-color': '#fff' },
    });
    map.keyboard.disable(); // arrow keys drive the character instead of panning
    map.on('sourcedata', this.onSourceData);
    map.on('idle', this.rebuildGraph);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    map.easeTo({ zoom: Math.max(map.getZoom(), MIN_ZOOM) });
  }

  stop() {
    const { map } = this;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    map.off('sourcedata', this.onSourceData);
    map.off('idle', this.rebuildGraph);
    map.keyboard.enable();
    if (map.getLayer(LAYER_ID)) map.removeLayer(LAYER_ID);
    if (map.getSource(LAYER_ID)) map.removeSource(LAYER_ID);
    this.pressed.clear();
    this.position = null;
  }

  private readonly onSourceData = (e: MapSourceDataEvent) => {
    if (e.sourceId === ROAD_SOURCE && e.tile) this.roadsChanged = true;
  };

  /**
   * Runs on 'idle', which also fires after our own marker updates and camera moves,
   * so it only does work when new road tiles arrived since the last build.
   */
  private readonly rebuildGraph = () => {
    if (!this.roadsChanged) return;
    this.roadsChanged = false;
    // Keep the current spot (or start at the map centre) and re-snap it onto the fresh graph.
    const current = this.position ? positionToLngLat(this.graph, this.position) : this.map.getCenter().toArray();
    const graph = buildRoadGraph(readRoadLines(this.map));
    if (graph.nodes.size === 0) return;
    this.graph = graph;
    this.position = snapToRoad(graph, current as LngLat);
    this.render(false);
  };

  private direction(): Direction | null {
    let x = 0;
    let y = 0;
    for (const key of this.pressed) {
      const [dx, dy] = KEY_DIRECTIONS[key]!;
      x += dx;
      y += dy;
    }
    return x || y ? [x, y] : null;
  }

  private readonly tick = (time: number) => {
    const dir = this.direction();
    if (!dir || !this.position) {
      this.frame = 0;
      return;
    }
    const seconds = Math.min((time - this.lastTime) / 1000, 0.1); // clamp after a background tab
    this.lastTime = time;
    this.position = moveAlongRoads(this.graph, this.position, dir, SPEED_MPS * seconds);
    this.render(true);
    this.frame = requestAnimationFrame(this.tick);
  };

  private render(follow: boolean) {
    if (!this.position) return;
    const lngLat = positionToLngLat(this.graph, this.position);
    (this.map.getSource(LAYER_ID) as GeoJSONSource | undefined)?.setData(pointFeature(lngLat));
    if (follow) this.map.jumpTo({ center: lngLat });
  }

  private readonly onKeyDown = (e: KeyboardEvent) => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (!(key in KEY_DIRECTIONS) || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault();
    this.pressed.add(key);
    if (!this.frame) {
      this.lastTime = performance.now();
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    this.pressed.delete(e.key.length === 1 ? e.key.toLowerCase() : e.key);
  };

  private readonly onBlur = () => this.pressed.clear();
}
