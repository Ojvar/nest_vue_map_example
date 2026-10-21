/**
 * Framework-free road graph and movement logic for the keyboard character.
 * Distances use a local flat-earth approximation, which is accurate enough at street scale.
 */

export type LngLat = [number, number];
/** Unit-less direction in screen terms: x = east, y = north. */
export type Direction = [number, number];

export interface RoadGraph {
  nodes: Map<string, LngLat>;
  neighbours: Map<string, Set<string>>;
}

/** The character sits on the edge `from → to`, `t` (0..1) of the way along it. */
export interface RoadPosition {
  from: string;
  to: string;
  t: number;
}

const METERS_PER_DEG_LAT = 110_540;
const METERS_PER_DEG_LNG_AT_EQUATOR = 111_320;
/** Vertices closer than this are the same point (tile quantisation and clipping move them slightly). */
const MERGE_DISTANCE_M = 3;
/** A road ending this close to another road's side joins it there (T-junctions, roundabout exits). */
const JOIN_DISTANCE_M = 5;
/** Turns are judged on where a road goes over this distance, not its first tiny segment. */
const LOOK_AHEAD_M = 15;
/** Ignore roads more than ~60° away from the pressed direction. */
const MIN_ALIGNMENT = 0.5;
/** Upper bound on edges walked in one call, so bad data can never freeze the page. */
const MAX_STEPS = 1000;
/** With no matching road, keep following the current one through bends up to ~120° (but not a U-turn). */
const STRAIGHT_ON_MIN_ALIGNMENT = -0.5;

/** Offset from `a` to `b` in metres (east, north). */
function toMeters(a: LngLat, b: LngLat): [number, number] {
  const cosLat = Math.cos((a[1] * Math.PI) / 180);
  return [(b[0] - a[0]) * METERS_PER_DEG_LNG_AT_EQUATOR * cosLat, (b[1] - a[1]) * METERS_PER_DEG_LAT];
}

const length = ([x, y]: [number, number]) => Math.hypot(x, y);
const distance = (a: LngLat, b: LngLat) => length(toMeters(a, b));

function alignment(a: LngLat, b: LngLat, dir: Direction): number {
  const v = toMeters(a, b);
  const len = length(v) * length(dir);
  return len === 0 ? -1 : (v[0] * dir[0] + v[1] * dir[1]) / len;
}

/** Closest point to `p` on segment a–b, as a fraction `t` along it and the distance in metres. */
function projectOnSegment(a: LngLat, b: LngLat, p: LngLat): { t: number; distanceM: number } {
  const ab = toMeters(a, b);
  const ap = toMeters(a, p);
  const lenSq = ab[0] ** 2 + ab[1] ** 2;
  const t = lenSq === 0 ? 0 : Math.min(1, Math.max(0, (ap[0] * ab[0] + ap[1] * ab[1]) / lenSq));
  return { t, distanceM: length([ap[0] - ab[0] * t, ap[1] - ab[1] * t]) };
}

function connect(graph: RoadGraph, a: string, b: string) {
  if (a === b) return;
  graph.neighbours.get(a)!.add(b);
  graph.neighbours.get(b)!.add(a);
}

function disconnect(graph: RoadGraph, a: string, b: string) {
  graph.neighbours.get(a)!.delete(b);
  graph.neighbours.get(b)!.delete(a);
}

/** Every edge once, as [a, b]. */
function edges(graph: RoadGraph): [string, string][] {
  const result: [string, string][] = [];
  for (const [a, next] of graph.neighbours) for (const b of next) if (a < b) result.push([a, b]);
  return result;
}

/** Uniform grid over lon/lat; `cellSizeM` is the cell size in metres (north–south). */
class Grid<T> {
  private readonly cells = new Map<string, T[]>();
  private readonly sizeDeg: number;

  constructor(cellSizeM: number) {
    this.sizeDeg = cellSizeM / METERS_PER_DEG_LAT;
  }

  private cell = ([lng, lat]: LngLat): [number, number] => [Math.floor(lng / this.sizeDeg), Math.floor(lat / this.sizeDeg)];

  /** Adds `item` to every cell of the box spanned by `a` and `b`. */
  add(item: T, a: LngLat, b: LngLat = a) {
    const [x1, y1] = this.cell([Math.min(a[0], b[0]), Math.min(a[1], b[1])]);
    const [x2, y2] = this.cell([Math.max(a[0], b[0]), Math.max(a[1], b[1])]);
    for (let x = x1; x <= x2; x++) {
      for (let y = y1; y <= y2; y++) {
        const key = `${x},${y}`;
        const items = this.cells.get(key);
        if (items) items.push(item);
        else this.cells.set(key, [item]);
      }
    }
  }

  /** Items in the cell of `p` and its 8 neighbours (may repeat an item). */
  *near(p: LngLat): Generator<T> {
    const [cx, cy] = this.cell(p);
    for (let x = cx - 1; x <= cx + 1; x++) for (let y = cy - 1; y <= cy + 1; y++) yield* this.cells.get(`${x},${y}`) ?? [];
  }
}

interface Join {
  node: string;
  t: number;
}

/**
 * Links each dead end to the side of a nearby road (T-junctions, roundabout exits): the road is
 * split at the closest point. All joins are found first against the original edges, then applied,
 * so the work stays near-linear and splitting can never feed back into itself.
 */
function joinDeadEnds(graph: RoadGraph) {
  const index = new Grid<[string, string]>(JOIN_DISTANCE_M);
  const allEdges = edges(graph);
  for (const edge of allEdges) index.add(edge, graph.nodes.get(edge[0])!, graph.nodes.get(edge[1])!);

  const splits = new Map<[string, string], Join[]>();
  for (const [node, next] of graph.neighbours) {
    if (next.size !== 1) continue;
    const point = graph.nodes.get(node)!;
    let best: { edge: [string, string]; t: number; distanceM: number } | null = null;
    for (const edge of index.near(point)) {
      if (edge.includes(node) || next.has(edge[0]) || next.has(edge[1])) continue;
      const hit = projectOnSegment(graph.nodes.get(edge[0])!, graph.nodes.get(edge[1])!, point);
      if (hit.distanceM <= JOIN_DISTANCE_M && (!best || hit.distanceM < best.distanceM)) best = { edge, ...hit };
    }
    if (best) splits.set(best.edge, [...(splits.get(best.edge) ?? []), { node, t: best.t }]);
  }

  for (const [[a, b], joins] of splits) {
    // Joins at an end of the edge just link up; the rest split a–b into a chain a–n1–n2–…–b.
    const chain: string[] = [];
    for (const join of joins.sort((x, y) => x.t - y.t)) {
      if (join.t === 0) connect(graph, join.node, a);
      else if (join.t === 1) connect(graph, join.node, b);
      else chain.push(join.node);
    }
    if (!chain.length) continue;
    disconnect(graph, a, b);
    const path = [a, ...chain, b];
    path.slice(1).forEach((id, i) => connect(graph, path[i]!, id));
  }
}

export function buildRoadGraph(lines: LngLat[][]): RoadGraph {
  const graph: RoadGraph = { nodes: new Map(), neighbours: new Map() };
  // Only nodes in neighbouring grid cells can be close enough to merge.
  const index = new Grid<string>(MERGE_DISTANCE_M);
  const addNode = (p: LngLat) => {
    for (const id of index.near(p)) if (distance(graph.nodes.get(id)!, p) <= MERGE_DISTANCE_M) return id;
    const id = String(graph.nodes.size);
    graph.nodes.set(id, p);
    graph.neighbours.set(id, new Set());
    index.add(id, p);
    return id;
  };
  for (const line of lines) {
    const ids = line.map(addNode);
    ids.slice(1).forEach((id, i) => connect(graph, ids[i]!, id));
  }
  joinDeadEnds(graph);
  return graph;
}

export function positionToLngLat(graph: RoadGraph, pos: RoadPosition): LngLat {
  const a = graph.nodes.get(pos.from)!;
  const b = graph.nodes.get(pos.to)!;
  return [a[0] + (b[0] - a[0]) * pos.t, a[1] + (b[1] - a[1]) * pos.t];
}

/** Closest point on any road to `point`, or null if the graph is empty. */
export function snapToRoad(graph: RoadGraph, point: LngLat): RoadPosition | null {
  let best: RoadPosition | null = null;
  let bestDistance = Infinity;
  for (const [from, to] of edges(graph)) {
    const hit = projectOnSegment(graph.nodes.get(from)!, graph.nodes.get(to)!, point);
    if (hit.distanceM < bestDistance) {
      bestDistance = hit.distanceM;
      best = { from, to, t: hit.t };
    }
  }
  return best;
}

/** A point about LOOK_AHEAD_M along the road from `from` through `next`, following bends. */
function lookAhead(graph: RoadGraph, from: string, next: string): LngLat {
  let travelled = 0;
  let [previous, current] = [from, next];
  for (let step = 0; step < MAX_STEPS; step++) {
    travelled += distance(graph.nodes.get(previous)!, graph.nodes.get(current)!);
    const onward = [...graph.neighbours.get(current)!].filter((n) => n !== previous);
    if (travelled >= LOOK_AHEAD_M || onward.length !== 1 || onward[0] === from) return graph.nodes.get(current)!;
    [previous, current] = [current, onward[0]!];
  }
  return graph.nodes.get(current)!;
}

/**
 * Next node after arriving at `node` from `previous`: the road best matching `dir`, otherwise
 * the road straight on (so a roundabout carries you round to the exit you want).
 * Null at a dead end.
 */
function chooseNext(graph: RoadGraph, previous: string, node: string, dir: Direction): string | null {
  const origin = graph.nodes.get(node)!;
  const heading = toMeters(graph.nodes.get(previous)!, origin);
  const options = [...graph.neighbours.get(node)!].filter((n) => n !== previous);
  const best = (score: (n: string) => number, min: number) => {
    let result: string | null = null;
    for (const n of options) {
      const value = score(n);
      if (value > min) [result, min] = [n, value];
    }
    return result;
  };
  return (
    best((n) => alignment(origin, lookAhead(graph, node, n), dir), MIN_ALIGNMENT) ??
    best((n) => alignment(origin, lookAhead(graph, node, n), heading), STRAIGHT_ON_MIN_ALIGNMENT)
  );
}

/** Moves up to `distanceM` metres along the roads in direction `dir`; returns the new position. */
export function moveAlongRoads(graph: RoadGraph, pos: RoadPosition, dir: Direction, distanceM: number): RoadPosition {
  let { from, to, t } = pos;
  // Turn back along the current edge if asked; a sideways press keeps going to the next junction.
  if (alignment(graph.nodes.get(from)!, graph.nodes.get(to)!, dir) < 0) [from, to, t] = [to, from, 1 - t];

  let remaining = distanceM;
  for (let step = 0; remaining > 0 && step < MAX_STEPS; step++) {
    const edgeLength = length(toMeters(graph.nodes.get(from)!, graph.nodes.get(to)!));
    const left = edgeLength * (1 - t);
    if (remaining < left) return { from, to, t: t + remaining / edgeLength };
    remaining -= left;
    const next = chooseNext(graph, from, to, dir);
    if (!next) return { from, to, t: 1 }; // dead end: stop at the node
    [from, to, t] = [to, next, 0];
  }
  return { from, to, t };
}
