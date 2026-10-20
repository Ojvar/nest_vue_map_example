/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_MAP_STYLE_URL?: string;
  readonly VITE_CACHE_TTL_MS?: string;
  readonly VITE_CACHE_MAX_ENTRIES?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
