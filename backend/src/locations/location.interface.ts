export const BILLBOARD_TYPES = ['unipole', 'overpass', 'rooftop', 'wall', 'digital'] as const;
export type BillboardType = (typeof BILLBOARD_TYPES)[number];

export interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 1 = major landmark (always shown), 2 = notable, 3 = local detail. */
  importance: 1 | 2 | 3;
  type: BillboardType;
  description: string;
  widthM: number;
  heightM: number;
  faces: number;
  illuminated: boolean;
  status: 'available' | 'booked';
  district: string;
  address: string;
  /** Monthly rent in Iranian rials. */
  pricePerMonthIrr: number;
  dailyImpressions: number;
}
