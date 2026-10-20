/**
 * Small framework-agnostic cache for map data:
 * - TTL per entry
 * - LRU eviction once maxEntries is exceeded (Map keeps insertion order)
 * - in-flight de-duplication: concurrent calls for the same key share one promise
 */
export interface Bounds {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
}

interface ViewportKey {
  key: string;
  bounds: Bounds;
  zoom: number;
}

interface MapDataCacheOptions {
  ttlMs: number;
  maxEntries: number;
  now?: () => number;
}

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const MAX_ZOOM_BUCKET = 22;

/**
 * Snaps bounds outward to a grid whose cell size halves with every zoom level,
 * so small pans inside the same cells produce the same key (and request).
 */
export function normalizeViewport(bounds: Bounds, zoom: number): ViewportKey {
  const z = Math.min(MAX_ZOOM_BUCKET, Math.max(0, Math.floor(zoom)));
  const step = 180 / 2 ** z; // half a web-mercator tile width in degrees
  const down = (v: number) => Math.floor(v / step) * step;
  const up = (v: number) => Math.ceil(v / step) * step;
  const clamp = (v: number, lim: number) => Math.max(-lim, Math.min(lim, v));
  const round = (v: number) => Number(v.toFixed(6));
  const snapped: Bounds = {
    minLat: round(clamp(down(bounds.minLat), 90)),
    minLng: round(clamp(down(bounds.minLng), 180)),
    maxLat: round(clamp(up(bounds.maxLat), 90)),
    maxLng: round(clamp(up(bounds.maxLng), 180)),
  };
  const key = `${z}:${snapped.minLat},${snapped.minLng},${snapped.maxLat},${snapped.maxLng}`;
  return { key, bounds: snapped, zoom: z };
}

export class MapDataCache<T> {
  private readonly entries = new Map<string, Entry<T>>();
  private readonly inFlight = new Map<string, Promise<T>>();
  private readonly now: () => number;

  constructor(private readonly options: MapDataCacheOptions) {
    this.now = options.now ?? Date.now;
  }

  get size(): number {
    return this.entries.size;
  }

  /** Returns a fresh cached value or undefined; refreshes LRU position on hit. */
  get(key: string): T | undefined {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T): void {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + this.options.ttlMs });
    while (this.entries.size > this.options.maxEntries) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
    }
  }

  /** Cached value, an already running request for the key, or a new load. Failures are not cached. */
  getOrLoad(key: string, loader: () => Promise<T>): Promise<T> {
    const cached = this.get(key);
    if (cached !== undefined) return Promise.resolve(cached);
    const pending = this.inFlight.get(key);
    if (pending) return pending;

    const promise = loader()
      .then((value) => {
        this.set(key, value);
        return value;
      })
      .finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, promise);
    return promise;
  }
}
