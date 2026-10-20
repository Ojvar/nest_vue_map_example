import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/main';

describe('GET /api/locations (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('returns all 100 locations', async () => {
    const res = await request(app.getHttpServer()).get('/api/locations').expect(200);
    expect(res.body.total).toBe(100);
  });

  it('filters by bounds and zoom', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/locations?minLat=36.25&minLng=49.98&maxLat=36.29&maxLng=50.03&zoom=14')
      .expect(200);
    expect(res.body.total).toBeGreaterThan(0);
    expect(res.body.total).toBeLessThan(100);
  });

  it('filters by comma-separated types', async () => {
    const res = await request(app.getHttpServer()).get('/api/locations?types=unipole,digital').expect(200);
    expect(res.body.total).toBe(40);
    expect(res.body.items[0]).toHaveProperty('description');
  });

  it.each([
    'types=spaceship',
    'types=digital,digital',
    'minLat=abc&minLng=49&maxLat=37&maxLng=50',
    'minLat=36',
    'minLat=37&minLng=49&maxLat=36&maxLng=50',
    'minLat=-100&minLng=49&maxLat=36&maxLng=50',
    'zoom=30',
    'unknown=1',
  ])('returns 400 for %s', (qs) => request(app.getHttpServer()).get(`/api/locations?${qs}`).expect(400));
});
