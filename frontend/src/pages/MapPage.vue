<template>
  <q-page class="map-page">
    <LocationsMap :locations="locations" @viewport-change="load" />

    <div class="map-status">
      <q-chip v-if="loading" icon="sync" color="white">
        <q-spinner size="1em" class="q-mr-sm" /> Loading locations…
      </q-chip>
      <q-chip v-else-if="!error && locations.length === 0" icon="info" color="white">
        No locations in this area
      </q-chip>
      <q-chip v-else-if="!error" color="white">{{ locations.length }} locations</q-chip>
    </div>

    <q-banner v-if="error" class="map-error bg-negative text-white" rounded dense>
      {{ error }}
    </q-banner>
  </q-page>
</template>

<script setup lang="ts">
import { useQuasar } from 'quasar';
import { watch } from 'vue';
import LocationsMap from 'components/LocationsMap.vue';
import { useViewportLocations } from '../composables/useViewportLocations';

const $q = useQuasar();
const { locations, loading, error, load } = useViewportLocations();

watch(error, (message) => {
  if (message) $q.notify({ type: 'negative', message: `Could not load locations: ${message}` });
});
</script>

<style scoped>
.map-page {
  position: relative;
}

.map-status {
  position: absolute;
  left: 12px;
  bottom: 24px;
  z-index: 1;
}

.map-error {
  position: absolute;
  top: 12px;
  left: 12px;
  right: 120px;
  z-index: 1;
}
</style>
