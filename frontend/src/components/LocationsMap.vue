<template>
  <div class="locations-map">
    <div ref="container" class="locations-map__canvas" />

    <q-btn
      class="locations-map__toggle"
      color="white"
      text-color="primary"
      :icon="enable3d ? 'view_in_ar' : 'map'"
      :label="enable3d ? '3D' : '2D'"
      dense
      no-caps
      @click="toggle3d"
    >
      <q-tooltip>3D models appear from zoom {{ config.threeDMinZoom }}. Right-drag or Ctrl+drag to tilt.</q-tooltip>
    </q-btn>

    <q-btn
      class="locations-map__character-toggle"
      :color="characterActive ? 'primary' : 'white'"
      :text-color="characterActive ? 'white' : 'primary'"
      icon="directions_walk"
      dense
      no-caps
      @click="toggleCharacter"
    >
      <q-tooltip>Walk the roads with the arrow keys or WASD</q-tooltip>
    </q-btn>

    <q-card class="locations-map__legend" flat bordered>
      <div v-for="item in legend" :key="item.type" class="row items-center no-wrap q-gutter-x-xs">
        <img :src="item.icon" width="16" height="16" alt="" />
        <span class="text-caption">{{ item.label }}</span>
      </div>
    </q-card>
  </div>
</template>

<script setup lang="ts">
import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { config } from '../config';
import { Billboard3DLayer } from '../map/billboard-3d-layer';
import { applyPopupColor, buildPopupContent, POPUP_CLASS } from '../map/billboard-popup';
import { BILLBOARD_TYPE_STYLES } from '../map/billboard-types';
import { RoadCharacter } from '../map/road-character';
import { addTypeIcons, iconDataUrl, iconName } from '../map/type-icons';
import { BILLBOARD_TYPES, type Location } from '../services/locations-api';
import type { Bounds } from '../services/map-data-cache';

// Persian/Arabic labels need MapLibre's RTL text plugin (served from public/, v0.3.0)
// to be shaped right-to-left. Must be registered once, before maps render text.
const RTL_TEXT_PLUGIN_URL = `${import.meta.env.BASE_URL}mapbox-gl-rtl-text.js`;
if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
  void maplibregl.setRTLTextPlugin(RTL_TEXT_PLUGIN_URL, false);
}

const SOURCE_ID = 'locations';
const ICON_LAYER_ID = 'locations-icons';
/** Invisible but queryable circles: one click target for both 2D icons and 3D model bases. */
const HIT_LAYER_ID = 'locations-hit';
const MODELS_LAYER_ID = 'locations-3d';
const ICON_OPACITY_IN_3D = 0.25;

const props = defineProps<{ locations: Location[] }>();
const emit = defineEmits<{ viewportChange: [bounds: Bounds, zoom: number] }>();

const container = ref<HTMLDivElement>();
const enable3d = ref(true);
let map: MapLibreMap | null = null;
let modelsLayer: Billboard3DLayer | null = null;
const characterActive = ref(false);
let character: RoadCharacter | null = null;
/**
 * One popup instance, reused so only a single card is ever open.
 * closeOnClick is off: with a reused popup, MapLibre's built-in close would fire on the same
 * click that opens it for another point. Clicks on empty map close it below instead.
 */
const popup = new maplibregl.Popup({
  offset: 14,
  maxWidth: 'none',
  className: POPUP_CLASS,
  focusAfterOpen: false,
  closeOnClick: false,
});
const POPUP_PAN_OFFSET_PX = 140; // pan the point below centre so the card above it fits

function closePopupOnEscape(e: KeyboardEvent) {
  if (e.key === 'Escape') popup.remove();
}
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

const locationsById = computed(() => new Map(props.locations.map((l) => [l.id, l])));
const legend = BILLBOARD_TYPES.map((type) => ({ type, label: BILLBOARD_TYPE_STYLES[type].label, icon: iconDataUrl(type) }));

function toGeoJson(locations: Location[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: 'FeatureCollection',
    features: locations.map((l) => ({
      type: 'Feature',
      id: l.id,
      geometry: { type: 'Point', coordinates: [l.lng, l.lat] },
      properties: { id: l.id, icon: iconName(l.type), importance: l.importance },
    })),
  };
}

function emitViewport() {
  if (!map) return;
  const b = map.getBounds();
  emit('viewportChange', { minLat: b.getSouth(), minLng: b.getWest(), maxLat: b.getNorth(), maxLng: b.getEast() }, map.getZoom());
}

function scheduleViewportEmit() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(emitViewport, config.moveDebounceMs);
}

/** 3D models replace (fade) the 2D icons when enabled and zoomed in far enough. */
function updateRenderMode() {
  if (!map || !modelsLayer) return;
  const show3d = enable3d.value && map.getZoom() >= config.threeDMinZoom;
  modelsLayer.setVisible(show3d);
  map.setPaintProperty(ICON_LAYER_ID, 'icon-opacity', show3d ? ICON_OPACITY_IN_3D : 1);
}

function toggle3d() {
  enable3d.value = !enable3d.value;
  if (!map) return;
  if (enable3d.value) {
    map.easeTo({ pitch: config.threeDPitch, zoom: Math.max(map.getZoom(), config.threeDMinZoom + 1) });
  } else {
    map.easeTo({ pitch: 0 });
  }
  updateRenderMode();
}

function toggleCharacter() {
  if (character) {
    character.stop();
    character = null;
  } else if (map?.isStyleLoaded()) {
    character = new RoadCharacter(map);
    character.start();
  }
  characterActive.value = character !== null;
}

function addLocationsLayers(m: MapLibreMap) {
  addTypeIcons(m);
  m.addSource(SOURCE_ID, { type: 'geojson', data: toGeoJson(props.locations) });
  m.addLayer({
    id: ICON_LAYER_ID,
    type: 'symbol',
    source: SOURCE_ID,
    layout: {
      'icon-image': ['get', 'icon'],
      'icon-size': ['match', ['get', 'importance'], 1, 1.1, 2, 0.95, 0.8],
      'icon-allow-overlap': true,
    },
  });
  m.addLayer({
    id: HIT_LAYER_ID,
    type: 'circle',
    source: SOURCE_ID,
    paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 10, 17, 28], 'circle-opacity': 0 },
  });
  modelsLayer = new Billboard3DLayer(MODELS_LAYER_ID, config.initialCenter);
  modelsLayer.setLocations(props.locations);
  m.addLayer(modelsLayer);

  m.on('click', (e) => {
    if (!m.queryRenderedFeatures(e.point, { layers: [HIT_LAYER_ID] }).length) popup.remove();
  });
  m.on('click', HIT_LAYER_ID, (e) => {
    const location = locationsById.value.get(String(e.features?.[0]?.properties?.id));
    if (!location) return;
    popup.setLngLat([location.lng, location.lat]).setDOMContent(buildPopupContent(location)).addTo(m);
    applyPopupColor(popup.getElement(), location);
    m.easeTo({ center: [location.lng, location.lat], offset: [0, POPUP_PAN_OFFSET_PX], duration: 400 });
  });
  m.on('mouseenter', HIT_LAYER_ID, () => (m.getCanvas().style.cursor = 'pointer'));
  m.on('mouseleave', HIT_LAYER_ID, () => (m.getCanvas().style.cursor = ''));
  m.on('zoom', updateRenderMode);
  updateRenderMode();
}

onMounted(() => {
  if (!container.value) return;
  map = new maplibregl.Map({
    container: container.value,
    style: config.mapStyleUrl,
    center: config.initialCenter,
    zoom: config.initialZoom,
    maxPitch: 70,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');
  map.on('load', () => {
    if (!map) return;
    addLocationsLayers(map);
    emitViewport();
  });
  map.on('moveend', scheduleViewportEmit);
  window.addEventListener('keydown', closePopupOnEscape);
});

// Both renderers replace their whole data set, so features can never be duplicated.
watch(
  () => props.locations,
  (locations) => {
    (map?.getSource(SOURCE_ID) as GeoJSONSource | undefined)?.setData(toGeoJson(locations));
    modelsLayer?.setLocations(locations);
  },
);

onBeforeUnmount(() => {
  clearTimeout(debounceTimer);
  window.removeEventListener('keydown', closePopupOnEscape);
  popup.remove();
  character?.stop();
  character = null;
  map?.remove(); // removes the custom layer, which disposes three.js resources
  map = null;
  modelsLayer = null;
});
</script>

<style scoped>
.locations-map,
.locations-map__canvas {
  position: absolute;
  inset: 0;
}
.locations-map__toggle {
  position: absolute;
  top: 12px;
  right: 56px;
  z-index: 2;
}
.locations-map__character-toggle {
  position: absolute;
  top: 12px;
  right: 120px;
  z-index: 2;
}
.locations-map__legend {
  position: absolute;
  right: 12px;
  bottom: 32px;
  z-index: 2;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.92);
}
</style>
