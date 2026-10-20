import { ref, shallowRef } from 'vue';
import { config } from '../config';
import { fetchLocations, type Location } from '../services/locations-api';
import { MapDataCache, normalizeViewport, type Bounds } from '../services/map-data-cache';

const cache = new MapDataCache<Location[]>({ ttlMs: config.cacheTtlMs, maxEntries: config.cacheMaxEntries });

/** Loads locations for a viewport via the cache; only the latest request's result is applied. */
export function useViewportLocations() {
  const locations = shallowRef<Location[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);
  let lastKey: string | null = null;
  let latestRequestId = 0;

  async function load(bounds: Bounds, zoom: number): Promise<void> {
    const viewport = normalizeViewport(bounds, zoom);
    if (viewport.key === lastKey && !error.value) return; // viewport not meaningfully changed
    lastKey = viewport.key;

    const requestId = ++latestRequestId;
    loading.value = true;
    try {
      const items = await cache.getOrLoad(viewport.key, () =>
        fetchLocations(viewport.bounds, viewport.zoom).then((r) => r.items),
      );
      if (requestId !== latestRequestId) return; // a newer request superseded this one
      locations.value = items;
      error.value = null;
    } catch (e) {
      if (requestId !== latestRequestId) return;
      error.value = e instanceof Error ? e.message : 'Failed to load locations';
    } finally {
      if (requestId === latestRequestId) loading.value = false;
    }
  }

  return { locations, loading, error, load };
}
