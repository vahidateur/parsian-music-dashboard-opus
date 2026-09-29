/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: "local" | "demo" | "api";
  readonly VITE_API_BASE_URL?: string;
}

/**
 * Build-time composition target, injected by `vite.config.ts`
 * (`APP_TARGET=client` → "client", otherwise "demo"). The ALIASES do the
 * heavy lifting (which target FILES get bundled); this constant lets runtime
 * configuration distinguish the compositions too — e.g. an unset data source
 * means "API" in the client build (no demo fallback exists there) and "demo"
 * in the demo build/dev server.
 */
declare const __APP_TARGET__: "demo" | "client";

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
