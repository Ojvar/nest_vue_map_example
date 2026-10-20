import { config } from '../config';
import type { Bounds } from './map-data-cache';

export const BILLBOARD_TYPES = ['unipole', 'overpass', 'rooftop', 'wall', 'digital'] as const;
export type BillboardType = (typeof BILLBOARD_TYPES)[number];

/** Mirrors the backend `Location` (a billboard site). */
export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  importance: number;
  type: BillboardType;
  description: string;
  widthM: number;
  heightM: number;
  faces: number;
  illuminated: boolean;
  status: 'available' | 'booked';
  district: string;
  address: string;
  pricePerMonthIrr: number;
  dailyImpressions: number;
}

export interface LocationsResponse {
  total: number;
  items: Location[];
}

export async function fetchLocations(bounds: Bounds, zoom: number): Promise<LocationsResponse> {
  const params = new URLSearchParams({
    minLat: String(bounds.minLat),
    minLng: String(bounds.minLng),
    maxLat: String(bounds.maxLat),
    maxLng: String(bounds.maxLng),
    zoom: String(zoom),
  });
  const res = await fetch(`${config.apiBaseUrl}/locations?${params}`);
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string | string[] } | null;
    const message = Array.isArray(body?.message) ? body.message.join(', ') : body?.message;
    throw new Error(message ?? `Request failed with status ${res.status}`);
  }
  return (await res.json()) as LocationsResponse;
}
