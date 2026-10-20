import { BadRequestException } from '@nestjs/common';
import { LOCATIONS } from './fixtures/locations.fixture';
import { LocationsService, maxImportanceForZoom } from './locations.service';

describe('LocationsService', () => {
  const service = new LocationsService();

  it('fixture has exactly 100 locations with unique ids', () => {
    expect(LOCATIONS).toHaveLength(100);
    expect(new Set(LOCATIONS.map((l) => l.id)).size).toBe(100);
  });

  it('returns all locations without filters', () => {
    expect(service.find({})).toHaveLength(100);
  });

  it('filters by bounds (inclusive)', () => {
    const bounds = { minLat: 36.26, minLng: 49.99, maxLat: 36.28, maxLng: 50.01 };
    const result = service.find(bounds);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThan(100);
    for (const l of result) {
      expect(l.lat).toBeGreaterThanOrEqual(bounds.minLat);
      expect(l.lat).toBeLessThanOrEqual(bounds.maxLat);
      expect(l.lng).toBeGreaterThanOrEqual(bounds.minLng);
      expect(l.lng).toBeLessThanOrEqual(bounds.maxLng);
    }
  });

  it('returns empty list for bounds outside Qazvin', () => {
    expect(service.find({ minLat: 0, minLng: 0, maxLat: 1, maxLng: 1 })).toEqual([]);
  });

  it('reduces detail at low zoom', () => {
    expect(maxImportanceForZoom(9)).toBe(1);
    expect(maxImportanceForZoom(12)).toBe(2);
    expect(maxImportanceForZoom(15)).toBe(3);
    expect(service.find({ zoom: 9 }).every((l) => l.importance === 1)).toBe(true);
    expect(service.find({ zoom: 9 }).length).toBeLessThan(service.find({ zoom: 14 }).length);
  });

  it('filters by type', () => {
    const result = service.find({ types: ['digital', 'wall'] });
    expect(result.length).toBe(40);
    expect(result.every((l) => l.type === 'digital' || l.type === 'wall')).toBe(true);
  });

  it('every location has billboard details', () => {
    for (const l of LOCATIONS) {
      expect(l.description.length).toBeGreaterThan(0);
      expect(l.widthM).toBeGreaterThan(0);
      expect(l.heightM).toBeGreaterThan(0);
      expect(['available', 'booked']).toContain(l.status);
    }
  });

  it('rejects partial bounds', () => {
    expect(() => service.find({ minLat: 36 })).toThrow(BadRequestException);
  });

  it('rejects inverted bounds', () => {
    expect(() => service.find({ minLat: 37, minLng: 49, maxLat: 36, maxLng: 50 })).toThrow(BadRequestException);
  });
});
