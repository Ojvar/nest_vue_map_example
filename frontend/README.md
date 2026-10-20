# Frontend (Vue 3 + Quasar + MapLibre GL JS)

```bash
cp .env.example .env   # VITE_API_BASE_URL, VITE_MAP_STYLE_URL, VITE_CACHE_TTL_MS, VITE_CACHE_MAX_ENTRIES
npm install
npm run dev            # http://localhost:9000
npm test               # Vitest: cache behaviour
npm run type-check
npm run build          # output in dist/spa
```

Key files:
- `src/services/map-data-cache.ts` – framework-agnostic TTL + LRU cache with in-flight dedup and viewport key normalization
- `src/services/locations-api.ts` – HTTP client
- `src/composables/useViewportLocations.ts` – glues cache + API, ignores stale responses
- `src/components/LocationsMap.vue` – MapLibre map, GeoJSON source + circle layer, popups
- `src/map/billboard-types.ts` – per-type label/colour/shape, (the 3D zoom threshold and pitch live in `src/config.ts`)
- `src/map/type-icons.ts` – canvas-drawn icons (circle, square, triangle, diamond, hexagon) registered with `map.addImage`
- `src/map/billboard-models.ts` – procedural low-poly three.js billboard models (shared geometry/materials)
- `src/map/billboard-3d-layer.ts` – MapLibre custom layer rendering the models at real-world metre scale
- `src/map/billboard-popup.ts` – popup content (DOM-built, `dir="auto"` for RTL text)

2D/3D: icons are always drawn; with 3D enabled (top-right toggle, default on) and zoom ≥ 15 the 3D models appear and icons fade. Tilt with right-drag / Ctrl+drag or the compass control. Clicks go to an invisible circle layer at each site's base.
