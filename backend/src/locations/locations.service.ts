import { BadRequestException, Injectable } from "@nestjs/common";
import { FindLocationsQuery } from "./dto/find-locations.query";
import { LOCATIONS } from "./fixtures/locations.fixture";
import { Location } from "./location.interface";

/**
 * Level of detail by zoom: below 11 only major landmarks, below 13 landmarks
 * plus notable places, otherwise everything. No zoom = everything.
 */
export function maxImportanceForZoom(zoom?: number): Location["importance"] {
  if (zoom === undefined || zoom >= 13) {
    return 3;
  }
  if (zoom >= 11) {
    return 2;
  }
  return 1;
}

const BOUND_KEYS = ["minLat", "minLng", "maxLat", "maxLng"] as const;

@Injectable()
export class LocationsService {
  private readonly locations: readonly Location[] = LOCATIONS;

  find(query: FindLocationsQuery): Location[] {
    const bounds = this.parseBounds(query);
    const maxImportance = maxImportanceForZoom(query.zoom);
    return this.locations.filter(
      (l) =>
        l.importance <= maxImportance &&
        (!query.types?.length || query.types.includes(l.type)) &&
        (!bounds ||
          (l.lat >= bounds.minLat &&
            l.lat <= bounds.maxLat &&
            l.lng >= bounds.minLng &&
            l.lng <= bounds.maxLng)),
    );
  }

  private parseBounds(query: FindLocationsQuery) {
    const provided = BOUND_KEYS.filter((k) => query[k] !== undefined);
    if (provided.length === 0) {
      return null;
    }
    if (provided.length !== BOUND_KEYS.length) {
      throw new BadRequestException(
        "minLat, minLng, maxLat and maxLng must be provided together",
      );
    }
    const { minLat, minLng, maxLat, maxLng } =
      query as Required<FindLocationsQuery>;
    if (minLat > maxLat)
      throw new BadRequestException(
        "minLat must be less than or equal to maxLat",
      );
    if (minLng > maxLng)
      throw new BadRequestException(
        "minLng must be less than or equal to maxLng",
      );
    return { minLat, minLng, maxLat, maxLng };
  }
}
