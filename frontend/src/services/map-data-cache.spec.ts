import { describe, expect, it, vi } from 'vitest';
import { MapDataCache, normalizeViewport } from './map-data-cache';

function createCache(ttlMs = 1000, maxEntries = 3) {
  let time = 0;
  const cache = new MapDataCache<string>({ ttlMs, maxEntries, now: () => time });
  return { cache, advance: (ms: number) => (time += ms) };
}

describe('normalizeViewport', () => {
  it('maps nearby viewports at the same zoom to the same key', () => {
    const a = normalizeViewport({ minLat: 36.271, minLng: 50.001, maxLat: 36.281, maxLng: 50.011 }, 14.2);
    const b = normalizeViewport({ minLat: 36.272, minLng: 50.002, maxLat: 36.282, maxLng: 50.012 }, 14.7);
    expect(a.key).toBe(b.key);
  });

  it('expands bounds to cover the viewport', () => {
    const input = { minLat: 36.271, minLng: 50.001, maxLat: 36.281, maxLng: 50.011 };
    const { bounds } = normalizeViewport(input, 14);
    expect(bounds.minLat).toBeLessThanOrEqual(input.minLat);
    expect(bounds.minLng).toBeLessThanOrEqual(input.minLng);
    expect(bounds.maxLat).toBeGreaterThanOrEqual(input.maxLat);
    expect(bounds.maxLng).toBeGreaterThanOrEqual(input.maxLng);
  });

  it('uses different keys for different zoom buckets', () => {
    const b = { minLat: 36.27, minLng: 50, maxLat: 36.28, maxLng: 50.01 };
    expect(normalizeViewport(b, 12).key).not.toBe(normalizeViewport(b, 13).key);
  });

  it('clamps to valid coordinates', () => {
    const { bounds } = normalizeViewport({ minLat: -89.9, minLng: -179.9, maxLat: 89.9, maxLng: 179.9 }, 0);
    expect(bounds).toEqual({ minLat: -90, minLng: -180, maxLat: 90, maxLng: 180 });
  });
});

describe('MapDataCache', () => {
  it('returns cached values until TTL expires', async () => {
    const { cache, advance } = createCache(1000);
    const loader = vi.fn().mockResolvedValue('data');
    await cache.getOrLoad('k', loader);
    advance(999);
    await cache.getOrLoad('k', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    advance(1);
    expect(cache.get('k')).toBeUndefined();
    await cache.getOrLoad('k', loader);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('evicts the least recently used entry', () => {
    const { cache } = createCache(1000, 2);
    cache.set('a', '1');
    cache.set('b', '2');
    cache.get('a'); // a becomes most recently used
    cache.set('c', '3');
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')).toBe('1');
    expect(cache.get('c')).toBe('3');
    expect(cache.size).toBe(2);
  });

  it('deduplicates concurrent requests for the same key', async () => {
    const { cache } = createCache();
    let resolve!: (v: string) => void;
    const loader = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const p1 = cache.getOrLoad('k', loader);
    const p2 = cache.getOrLoad('k', loader);
    expect(loader).toHaveBeenCalledTimes(1);
    resolve('data');
    expect(await Promise.all([p1, p2])).toEqual(['data', 'data']);
  });

  it('stores each result under its own key when requests finish out of order', async () => {
    const { cache } = createCache();
    const resolvers: Record<string, (v: string) => void> = {};
    const load = (key: string) => cache.getOrLoad(key, () => new Promise<string>((r) => (resolvers[key] = r)));
    const first = load('first');
    const second = load('second');
    resolvers.second!('second-data');
    resolvers.first!('first-data');
    expect(await first).toBe('first-data');
    expect(await second).toBe('second-data');
    expect(cache.get('first')).toBe('first-data');
    expect(cache.get('second')).toBe('second-data');
  });

  it('does not cache failures', async () => {
    const { cache } = createCache();
    const loader = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue('ok');
    await expect(cache.getOrLoad('k', loader)).rejects.toThrow('boom');
    expect(await cache.getOrLoad('k', loader)).toBe('ok');
  });
});
