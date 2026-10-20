import { defineRouter } from '#q-app/wrappers';
import { createRouter, createWebHistory } from 'vue-router';
import routes from './routes';

export default defineRouter(() =>
  createRouter({ history: createWebHistory(process.env.VUE_ROUTER_BASE), routes }),
);
