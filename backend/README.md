# Backend (NestJS)

Mock billboard-site API for Qazvin, Iran (100 static locations, no database).

```bash
cp .env.example .env   # optional: PORT, CORS_ORIGIN (comma-separated)
npm install
npm run start:dev      # http://localhost:3000/api/locations
npm test               # unit tests (filtering, zoom detail)
npm run test:e2e       # HTTP tests (status codes, validation)
npm run build && npm run start:prod
```

Nest does not read `.env` itself: the root `run.sh` loads it, or use `node --env-file=.env dist/main`.

## GET /api/locations

| Param | Type | Notes |
|---|---|---|
| `minLat`,`minLng`,`maxLat`,`maxLng` | number | Optional, but all four or none. `min <= max`, lat in [-90,90], lng in [-180,180]. Inclusive. |
| `types` | comma-separated | Optional: any of `unipole,overpass,rooftop,wall,digital`; unknown or duplicate → 400. |
| `zoom` | integer 0–22 | Optional level of detail: `< 11` → major landmarks only, `11–12` → + notable places, `>= 13` or omitted → all. |

Response: `{ "total": number, "items": Location[] }`. Each location is a mock billboard site: `id, name, lat, lng, importance, type, description, widthM, heightM, faces, illuminated, status (available|booked), district, address, pricePerMonthIrr, dailyImpressions` (see `src/locations/location.interface.ts`). Types are assigned round-robin, 20 per type.
Invalid or unknown params → `400` with a `message` field.
