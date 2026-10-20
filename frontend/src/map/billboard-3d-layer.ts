import maplibregl, { type CustomLayerInterface, type CustomRenderMethodInput, type Map as MapLibreMap } from 'maplibre-gl';
import * as THREE from 'three';
import type { Location } from '../services/locations-api';
import { createBillboardKit, rotationForId } from './billboard-models';

/**
 * MapLibre custom layer rendering billboard models with three.js.
 * Models live in a local metre-based scene anchored at `origin`; the render
 * matrix maps that scene into MapLibre's mercator world.
 */
export class Billboard3DLayer implements CustomLayerInterface {
  readonly id: string;
  readonly type = 'custom' as const;
  readonly renderingMode = '3d' as const;

  private map: MapLibreMap | null = null;
  private renderer: THREE.WebGLRenderer | null = null;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.Camera();
  private readonly models = new THREE.Group();
  private readonly kit = createBillboardKit();
  private origin: maplibregl.MercatorCoordinate;
  private metreScale: number;
  private visible = false;
  private locations: Location[] = [];

  constructor(id: string, originLngLat: [number, number]) {
    this.id = id;
    this.origin = maplibregl.MercatorCoordinate.fromLngLat(originLngLat, 0);
    this.metreScale = this.origin.meterInMercatorCoordinateUnits();
    this.scene.add(this.models);
    this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(30, 80, 50);
    this.scene.add(sun);
  }

  onAdd(map: MapLibreMap, gl: WebGLRenderingContext | WebGL2RenderingContext): void {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
    this.renderer.autoClear = false;
    this.rebuild();
  }

  onRemove(): void {
    this.models.clear();
    this.kit.dispose();
    this.renderer?.dispose(); // does not destroy MapLibre's shared GL context
    this.renderer = null;
    this.map = null;
  }

  setVisible(visible: boolean): void {
    if (visible === this.visible) return;
    this.visible = visible;
    this.map?.triggerRepaint();
  }

  /** Replaces all models (no duplicates; shared geometry means nothing to dispose per model). */
  setLocations(locations: Location[]): void {
    this.locations = locations;
    this.rebuild();
  }

  private rebuild(): void {
    this.models.clear();
    for (const location of this.locations) {
      const mc = maplibregl.MercatorCoordinate.fromLngLat([location.lng, location.lat], 0);
      const model = this.kit.build(location);
      // local axes: x = east, z = south (mercator y grows southwards), y = up
      model.position.set((mc.x - this.origin.x) / this.metreScale, 0, (mc.y - this.origin.y) / this.metreScale);
      model.rotation.y = rotationForId(location.id);
      this.models.add(model);
    }
    this.map?.triggerRepaint();
  }

  render(_gl: WebGLRenderingContext | WebGL2RenderingContext, args: CustomRenderMethodInput): void {
    if (!this.visible || !this.renderer) return;
    const s = this.metreScale;
    const transform = new THREE.Matrix4()
      .makeTranslation(this.origin.x, this.origin.y, this.origin.z ?? 0)
      .scale(new THREE.Vector3(s, -s, s))
      .multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
    this.camera.projectionMatrix = new THREE.Matrix4()
      .fromArray(args.defaultProjectionData.mainMatrix as unknown as number[])
      .multiply(transform);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
  }
}
