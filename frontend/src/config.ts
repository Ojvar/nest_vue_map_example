const env = import.meta.env;

export const config = {
  apiBaseUrl: env.VITE_API_BASE_URL ?? 'http://localhost:3000/api',
  mapStyleUrl: env.VITE_MAP_STYLE_URL ?? 'https://tiles.openfreemap.org/styles/liberty',
  cacheTtlMs: Number(env.VITE_CACHE_TTL_MS) || 5 * 60 * 1000,
  cacheMaxEntries: Number(env.VITE_CACHE_MAX_ENTRIES) || 50,
  /** Qazvin city centre as [lng, lat]. */
  initialCenter: [50.0049, 36.2797] as [number, number],
  initialZoom: 12.5,
  moveDebounceMs: 300,
  /** 3D models are shown at or above this zoom when 3D is enabled. */
  threeDMinZoom: 15,
  threeDPitch: 55,
};
