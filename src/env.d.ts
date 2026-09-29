/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DATA_SOURCE?: "local" | "demo" | "api";
  readonly VITE_API_BASE_URL?: string;
}

/**
 * Build-time composition target, injected by `vite.config.ts`.
 * `customer` and `client` are the clean graph. `operator` is the fixture
 * graph (`APP_TARGET=demo` is normalized to this before injection). The
 * comparison `__APP_TARGET__ === "operator"` is a build-time constant, so
 * the operator branch is eliminated from the clean artifacts.
 */
declare const __APP_TARGET__: "customer" | "client" | "operator";

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
