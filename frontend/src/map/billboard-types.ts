import type { BillboardType } from '../services/locations-api';

export type IconShape = 'circle' | 'square' | 'triangle' | 'diamond' | 'hexagon';

interface BillboardTypeStyle {
  label: string;
  color: string;
  shape: IconShape;
}

export const BILLBOARD_TYPE_STYLES: Record<BillboardType, BillboardTypeStyle> = {
  unipole: { label: 'Unipole', color: '#d32f2f', shape: 'circle' },
  overpass: { label: 'Overpass banner', color: '#7b1fa2', shape: 'square' },
  rooftop: { label: 'Rooftop', color: '#f57c00', shape: 'triangle' },
  wall: { label: 'Wall-mounted', color: '#388e3c', shape: 'diamond' },
  digital: { label: 'Digital LED', color: '#1976d2', shape: 'hexagon' },
};
