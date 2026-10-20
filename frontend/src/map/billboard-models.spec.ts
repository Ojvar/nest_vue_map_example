import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BILLBOARD_TYPES, type Location } from '../services/locations-api';
import { createBillboardKit, rotationForId } from './billboard-models';

const base: Omit<Location, 'type'> = {
  id: 'qzv-001', name: 'Test', lat: 36.27, lng: 50, importance: 1, description: '', widthM: 12, heightM: 4,
  faces: 2, illuminated: true, status: 'available', district: 'District 1', address: '', pricePerMonthIrr: 1, dailyImpressions: 1,
};

describe('billboard models', () => {
  it('builds a model for every type sharing geometry between instances', () => {
    const kit = createBillboardKit();
    const geometries = new Set<THREE.BufferGeometry>();
    for (const type of BILLBOARD_TYPES) {
      const model = kit.build({ ...base, type });
      model.traverse((o) => o instanceof THREE.Mesh && geometries.add(o.geometry));
      expect(model.children.length).toBeGreaterThan(0);
    }
    expect(geometries.size).toBeLessThanOrEqual(2);
    kit.dispose();
  });

  it('rotation is stable per id', () => {
    expect(rotationForId('qzv-001')).toBe(rotationForId('qzv-001'));
    expect(rotationForId('qzv-001')).not.toBe(rotationForId('qzv-002'));
  });
});
