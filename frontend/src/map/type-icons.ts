import type { Map as MapLibreMap } from 'maplibre-gl';
import { BILLBOARD_TYPES, type BillboardType } from '../services/locations-api';
import { BILLBOARD_TYPE_STYLES, type IconShape } from './billboard-types';

const ICON_SIZE = 32; // pixels, drawn at 2x for sharpness
const PIXEL_RATIO = 2;

export const iconName = (type: BillboardType) => `billboard-${type}`;

function tracePath(ctx: CanvasRenderingContext2D, shape: IconShape, c: number, r: number) {
  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(c, c, r, 0, Math.PI * 2);
  } else if (shape === 'square') {
    ctx.rect(c - r * 0.85, c - r * 0.85, r * 1.7, r * 1.7);
  } else {
    // regular polygons, first vertex pointing up
    const sides = { triangle: 3, diamond: 4, hexagon: 6 }[shape];
    const radius = shape === 'triangle' ? r * 1.15 : r;
    for (let i = 0; i < sides; i++) {
      const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
      const x = c + radius * Math.cos(a);
      const y = c + radius * Math.sin(a) + (shape === 'triangle' ? r * 0.2 : 0);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
  }
}

function drawIcon(type: BillboardType): HTMLCanvasElement {
  const { shape, color } = BILLBOARD_TYPE_STYLES[type];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  tracePath(ctx, shape, ICON_SIZE / 2, ICON_SIZE / 2 - 4);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffffff';
  ctx.stroke();
  return canvas;
}

/** Registers one icon image per billboard type on the map. */
export function addTypeIcons(map: MapLibreMap): void {
  for (const type of BILLBOARD_TYPES) {
    if (map.hasImage(iconName(type))) continue;
    const ctx = drawIcon(type).getContext('2d')!;
    map.addImage(iconName(type), ctx.getImageData(0, 0, ICON_SIZE, ICON_SIZE), { pixelRatio: PIXEL_RATIO });
  }
}

/** Data URL of a type icon, for the legend. */
export const iconDataUrl = (type: BillboardType) => drawIcon(type).toDataURL();
