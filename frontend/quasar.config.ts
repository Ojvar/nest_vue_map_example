import { defineConfig } from '#q-app/wrappers';

export default defineConfig(() => ({
  boot: [],
  css: ['app.scss'],
  extras: ['material-icons'],
  build: {
    target: { browser: ['es2022', 'firefox115', 'chrome115', 'safari14'], node: 'node20' },
    typescript: { strict: true, vueShim: true },
    vueRouterMode: 'history',
  },
  devServer: { port: 9000, open: false },
  framework: { plugins: ['Notify'] },
}));
