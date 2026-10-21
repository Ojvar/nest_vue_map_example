import { describe, expect, it } from 'vitest';
import { buildRoadGraph, moveAlongRoads, positionToLngLat, snapToRoad, type LngLat } from './road-graph';

// A "T" junction: an east–west street with a road going north from its middle.
const WEST: LngLat = [50.0, 36.0];
const MIDDLE: LngLat = [50.001, 36.0];
const EAST: LngLat = [50.002, 36.0];
const NORTH: LngLat = [50.001, 36.001];
const graph = buildRoadGraph([[WEST, MIDDLE, EAST], [MIDDLE, NORTH]]);

describe('road graph', () => {
  it('merges shared vertices into one node', () => {
    expect(graph.nodes.size).toBe(4);
    const junction = snapToRoad(graph, MIDDLE)!;
    const id = junction.t === 0 ? junction.from : junction.to;
    expect(graph.neighbours.get(id)!.size).toBe(3);
  });

  it('snaps a point to the nearest road', () => {
    const pos = snapToRoad(graph, [50.0005, 36.0001])!;
    const [lng, lat] = positionToLngLat(graph, pos);
    expect(lng).toBeCloseTo(50.0005, 6);
    expect(lat).toBeCloseTo(36.0, 6);
  });

  it('keeps going to the next junction and turns towards the pressed direction', () => {
    const start = snapToRoad(graph, WEST)!;
    // ~90 m east to the junction, then the rest north.
    const [lng, lat] = positionToLngLat(graph, moveAlongRoads(graph, start, [0, 1], 150));
    expect(lng).toBeCloseTo(MIDDLE[0], 6);
    expect(lat).toBeGreaterThan(MIDDLE[1]);
  });

  it('stops at a dead end', () => {
    const start = snapToRoad(graph, MIDDLE)!;
    const end = moveAlongRoads(graph, start, [0, 1], 10_000);
    expect(positionToLngLat(graph, end)).toEqual(NORTH);
  });

  it('can reverse along the current road', () => {
    const start = snapToRoad(graph, [50.0005, 36.0])!;
    const [lng] = positionToLngLat(graph, moveAlongRoads(graph, start, [-1, 0], 10));
    expect(lng).toBeLessThan(50.0005);
  });

  describe('roundabout', () => {
    // A square ring ~110 m wide. One exit leaves from the middle of the east side without a
    // shared vertex (T-junction); another starts ~2 m off the north-west corner (tile rounding).
    const RING: LngLat[] = [[50, 36], [50.0012, 36], [50.0012, 36.001], [50, 36.001], [50, 36]];
    const EAST_EXIT: LngLat[] = [[50.0012, 36.0005], [50.003, 36.0005]];
    const NORTH_EXIT: LngLat[] = [[50.00002, 36.00101], [50.00002, 36.003]];
    const ring = buildRoadGraph([RING, EAST_EXIT, NORTH_EXIT]);

    it('leaves through a T-junction exit in the pressed direction', () => {
      const start = snapToRoad(ring, [50.0006, 36])!; // middle of the south side
      // Holding east: along the south side, round the corner, then out the east exit.
      const [lng, lat] = positionToLngLat(ring, moveAlongRoads(ring, start, [1, 0], 150));
      expect(lat).toBeCloseTo(36.0005, 5);
      expect(lng).toBeGreaterThan(50.0012);
    });

    it('joins an exit whose end is a few metres off the ring', () => {
      const start = snapToRoad(ring, [50, 36.0005])!; // middle of the west side
      const [lng, lat] = positionToLngLat(ring, moveAlongRoads(ring, start, [0, 1], 150));
      expect(lng).toBeCloseTo(50.00002, 4);
      expect(lat).toBeGreaterThan(36.0011);
    });
  });
});

describe('road graph at city scale', () => {
  /** A street grid like several zoom-16 tiles: every street repeated (tile duplicates), with dead-end stubs. */
  function cityLines(size: number): LngLat[][] {
    const step = 0.0008; // ~80 m blocks
    const lines: LngLat[][] = [];
    for (let i = 0; i < size; i++) {
      const h: LngLat[] = [];
      const v: LngLat[] = [];
      for (let j = 0; j < size; j++) {
        h.push([50 + j * step, 36 + i * step]);
        v.push([50 + i * step, 36 + j * step]);
      }
      lines.push(h, v, [...h], [...v]);
      // An alley ending 2 m short of the next street: must be joined mid-segment.
      if (i < size - 1) lines.push([[50 + i * step + step / 2, 36 + step / 3], [50 + i * step + step / 2, 36 + 0.00002]]);
    }
    return lines;
  }

  it('builds a ~10k segment graph quickly', () => {
    const lines = cityLines(70);
    const startedAt = performance.now();
    const graph = buildRoadGraph(lines);
    const elapsed = performance.now() - startedAt;
    expect(graph.nodes.size).toBe(70 * 70 + 2 * 69); // duplicates merged
    const deadEnds = [...graph.neighbours.values()].filter((n) => n.size === 1).length;
    expect(deadEnds).toBe(69); // each alley's near end joined the street; only the far ends remain
    expect(elapsed).toBeLessThan(1000);
  });

  it('a huge move on a ring finishes (bounded loop)', () => {
    const ring = buildRoadGraph([[[50, 36], [50.001, 36], [50.001, 36.001], [50, 36.001], [50, 36]]]);
    const start = snapToRoad(ring, [50.0005, 36])!;
    const startedAt = performance.now();
    moveAlongRoads(ring, start, [0, -1], 1e9);
    expect(performance.now() - startedAt).toBeLessThan(200);
  });
});
