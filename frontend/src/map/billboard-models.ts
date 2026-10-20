import * as THREE from 'three';
import type { BillboardType, Location } from '../services/locations-api';
import { BILLBOARD_TYPE_STYLES } from './billboard-types';

/**
 * Procedural low-poly billboard models in metres (y = up, panel faces +z).
 * All meshes share a unit box/cylinder and a few materials; per-mesh scale
 * gives the size, so 100 models cost only a handful of GPU buffers.
 */
export function createBillboardKit() {
  const box = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0); // base at y=0
  const cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 8).translate(0, 0.5, 0);
  const steel = new THREE.MeshLambertMaterial({ color: 0x8a8f98 });
  const concrete = new THREE.MeshLambertMaterial({ color: 0xc9c2b6 });
  const back = new THREE.MeshLambertMaterial({ color: 0x3a3f47 });
  const panels = Object.fromEntries(
    Object.entries(BILLBOARD_TYPE_STYLES).map(([type, s]) => [
      type,
      new THREE.MeshLambertMaterial({ color: s.color, emissive: s.color, emissiveIntensity: type === 'digital' ? 0.8 : 0.15 }),
    ]),
  ) as unknown as Record<BillboardType, THREE.Material>;

  function part(geometry: THREE.BufferGeometry, material: THREE.Material, size: [number, number, number], pos: [number, number, number]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(...size);
    mesh.position.set(...pos);
    return mesh;
  }

  /** Panel with a dark back so the face direction is readable. */
  function panel(type: BillboardType, w: number, h: number, y: number, z = 0) {
    const g = new THREE.Group();
    g.add(part(box, back, [w + 0.3, h + 0.3, 0.3], [0, y - 0.15, z]));
    g.add(part(box, panels[type], [w, h, 0.1], [0, y, z + 0.2]));
    return g;
  }

  const builders: Record<BillboardType, (l: Location) => THREE.Object3D[]> = {
    unipole: (l) => [part(cylinder, steel, [0.8, 9, 0.8], [0, 0, 0]), panel('unipole', l.widthM, l.heightM, 9)],
    overpass: (l) => [
      part(box, concrete, [1.2, 6, 2.5], [-11, 0, 0]),
      part(box, concrete, [1.2, 6, 2.5], [11, 0, 0]),
      part(box, concrete, [24, 1, 3], [0, 6, 0]),
      panel('overpass', l.widthM, l.heightM, 7, 1.4),
    ],
    rooftop: (l) => [
      part(box, concrete, [l.widthM + 4, 12, 10], [0, 0, 0]),
      part(box, steel, [0.3, 1.5, 0.3], [-l.widthM / 3, 12, 0]),
      part(box, steel, [0.3, 1.5, 0.3], [l.widthM / 3, 12, 0]),
      panel('rooftop', l.widthM, l.heightM, 13.5),
    ],
    wall: (l) => [part(box, concrete, [l.widthM + 6, 16, 8], [0, 0, -4]), panel('wall', l.widthM, l.heightM, 6, 0.1)],
    digital: (l) => [part(box, steel, [1.2, 3, 1.2], [0, 0, 0]), panel('digital', l.widthM, l.heightM, 3)],
  };

  function build(location: Location): THREE.Group {
    const group = new THREE.Group();
    group.add(...builders[location.type](location));
    group.userData.id = location.id;
    return group;
  }

  function dispose() {
    [box, cylinder].forEach((g) => g.dispose());
    [steel, concrete, back, ...Object.values(panels)].forEach((m) => m.dispose());
  }

  return { build, dispose };
}

/** Deterministic rotation (radians) derived from the id, so a model never "spins" between reloads. */
export function rotationForId(id: string): number {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return ((Math.abs(hash) % 360) * Math.PI) / 180;
}
