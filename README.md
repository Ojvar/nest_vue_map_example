# Qazvin Map Example

Two independent apps:

- `backend/` – NestJS REST API serving 100 mock billboard sites in Qazvin, Iran
- `frontend/` – Vue 3 + Quasar SPA rendering them on a MapLibre GL JS map

Requires Node.js 20+ (tested with Node 24 / npm 11).

## Setup & run

```bash
./run.sh   # installs deps if missing, loads backend/.env, starts both dev servers (Ctrl+C stops both)
```

Or separately:

```bash
# terminal 1
cd backend && npm install && npm run start:dev     # http://localhost:3000/api/locations

# terminal 2
cd frontend && npm install && npm run dev          # http://localhost:9000
```

## Environment

| Project | Variable | Default |
|---|---|---|
| backend | `PORT` | `3000` |
| backend | `CORS_ORIGIN` (comma-separated) | `http://localhost:9000` |
| frontend | `VITE_API_BASE_URL` | `http://localhost:3000/api` |
| frontend | `VITE_MAP_STYLE_URL` | `https://tiles.openfreemap.org/styles/liberty` |
| frontend | `VITE_CACHE_TTL_MS` | `300000` |
| frontend | `VITE_CACHE_MAX_ENTRIES` | `50` |

Copy each project's `.env.example` to `.env` to change them.

## Tests & builds

```bash
cd backend  && npm test && npm run test:e2e && npm run build
cd frontend && npm test && npm run type-check && npm run build
```

## Architecture & key decisions

- **Backend**: `LocationsController` → `LocationsService` → static fixture (`src/locations/fixtures/locations.fixture.ts`). Query validated by a class-validator DTO and a global `ValidationPipe` (unknown params rejected); cross-field rules (all four bounds or none, `min <= max`) live in the service and return 400.
- **Level of detail**: each location has an `importance` (1–3). Low zooms return only landmarks, so a zoomed-out view stays readable without a clustering infrastructure.
- **Billboards**: each location is a mock billboard site with one of 5 types. 2D: a symbol layer with a canvas-generated shape per type plus a legend. 3D (zoom ≥ 15, toggle button): a three.js MapLibre custom layer with procedural low-poly models (unipole, overpass banner, rooftop, wall wrap, LED screen) sized from `widthM`/`heightM` with a stable per-id rotation; no glTF assets.
- **Map**: MapLibre with OpenFreeMap (free, no API key). Locations are one GeoJSON source feeding a symbol layer (icons) and an invisible circle hit layer; `setData` replaces the collection, so there are never duplicate markers. Click shows a popup, hover shows a pointer.
- **Viewport loading**: `moveend` is debounced (300 ms). Bounds are snapped outward to a grid whose cell size depends on the integer zoom; if the snapped key is unchanged, no request is made. The snapped (slightly larger) bounds are what is requested, so small pans are already covered.
- **Cache** (`map-data-cache.ts`): plain TS class, keyed by the snapped bounds + zoom bucket, with TTL, LRU eviction (via `Map` insertion order) and a shared promise per in-flight key. Failures are not cached.
- **Out-of-order responses**: the composable tags each load with an incrementing id and only applies the result of the latest one; earlier responses still populate the cache.
