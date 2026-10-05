/// <reference types="vitest/config" />
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Which composition to build.
 *
 *   APP_TARGET=demo   (default) — the demo composition: demo repositories,
 *                      demo provisioning, demo credential panel, delivery UI.
 *   APP_TARGET=client           — the production/client composition: API
 *                      repositories, DOMAIN_UNAVAILABLE for unserved domains,
 *                      and NOT ONE demo module in any chunk.
 *
 * Selection is by FILE ALIAS (below), which is what makes the boundary
 * physical: the bundler never resolves a demo target file when building the
 * client — it is not a runtime flag that dead code elimination might miss.
 * `src/domains/registry` is swapped the same way (registry.client.ts is
 * export-compatible, so no application code changes between compositions).
 * Tests (vitest) run with the default demo target unless APP_TARGET says
 * otherwise; `__APP_TARGET__` is defined to match.
 *
 * Asserted by src/__tests__/bundleBoundary.test.ts against the real
 * `dist/client` and `dist/demo` output — negative AND positive checks.
 */
const APP_TARGET: "demo" | "client" = process.env.APP_TARGET === "client" ? "client" : "demo";
const targetFile = (base: string, ext: string): string =>
  path.resolve(__dirname, `src/targets/${base}${APP_TARGET === "client" ? ".client" : ""}.${ext}`);
const targetAliases: { find: string; replacement: string }[] = [
  { find: "@/targets/environment", replacement: targetFile("environment", "tsx") },
  { find: "@/targets/libraryProvisioning", replacement: targetFile("libraryProvisioning", "ts") },
  { find: "@/targets/galleryProvisioning", replacement: targetFile("galleryProvisioning", "ts") },
  { find: "@/targets/targetCopy", replacement: targetFile("targetCopy", "ts") },
  { find: "@/targets/targetFeatures", replacement: targetFile("targetFeatures", "tsx") },
  { find: "@/targets/commandShowcase", replacement: targetFile("commandShowcase", "ts") },
];
const registryAlias: { find: string; replacement: string }[] =
  APP_TARGET === "client"
    ? [{ find: "@/domains/registry", replacement: path.resolve(__dirname, "src/domains/registry.client.ts") }]
    : [];

/**
 * The Content-Security-Policy the edge enforces in production.
 *
 * Kept here so the dev server can report against the SAME string the
 * deployment configs use, and so a test can assert the two never drift.
 * The single source of truth for the value is deploy/nginx.conf; this must
 * match it exactly (asserted by src/__tests__/cspCompatibility.test.ts).
 */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  // React writes style={{...}} props as inline style ATTRIBUTES. This
  // directive covers attributes only — never <style> blocks, never scripts.
  "style-src-attr 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "media-src 'self' blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "frame-src 'none'",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __APP_TARGET__: JSON.stringify(APP_TARGET),
  },
  build: {
    /*
      Hashed, externally-loaded assets — NOT a single inlined file.

      This is a security requirement, not a preference. `vite-plugin-singlefile`
      inlines the whole application into one `<script type="module">` with no
      `src`. A strict `script-src 'self'` blocks inline scripts, so the panel
      would white-screen in production.

      The alternatives were worse:
        - a nonce cannot be generated per response by a static file server, and
          a build-time "nonce" baked into a static artifact is not a nonce;
        - a SHA-256 hash in the CSP changes on every build while the CSP lives
          in a static nginx file, so deploys would silently break.

      External hashed assets satisfy `script-src 'self'` natively, and they
      cache far better: an unchanged vendor chunk is not re-downloaded because
      one component changed.
    */
    sourcemap: false, // never ship original TypeScript to a private panel
    rollupOptions: {
      output: {
        /*
          M11/I6: split the framework runtime into its own hashed vendor
          chunk. The framework changes far less often than application code,
          so a warm browser re-downloads only the entry/view chunks
          after an app change. Everything emitted stays same-origin external
          hashed assets — the `script-src 'self'` policy is unaffected, and
          `chunkSizeWarningLimit` is deliberately untouched (raised limits are
          how bundle growth goes unremarked; see DECISIONS.md D9).
        */
        manualChunks(id) {
          if (/node_modules[\/](?:react|react-dom|scheduler)[\/]/.test(id)) return "vendor";
        },
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    /* Ordered: the specific target/registry swaps win over the generic "@". */
    alias: [...targetAliases, ...registryAlias, { find: "@", replacement: path.resolve(__dirname, "src") }],
  },
  server: {
    host: true,
    allowedHosts: true,
    /*
      Mirror the production headers in development.

      A permissive dev server is exactly how a CSP that breaks production
      survives review, so the dev CSP is REPORT-ONLY with the same directives
      the edge enforces. Report-only rather than enforcing because Vite's HMR
      client legitimately needs inline scripts and a websocket that production
      does not — enforcing the production policy here would break hot reload
      and teach everyone to ignore the header.

      Violations still appear in the browser console, so a genuinely new
      violation (a third-party CDN, an eval) is visible before deploy. The
      binding check is src/__tests__/cspCompatibility.test.ts, which parses the
      real build output.

      HSTS is deliberately absent: the dev server is plain HTTP, and sending
      HSTS over HTTP would pin localhost to HTTPS in the developer's browser.
    */
    headers: {
      "Content-Security-Policy-Report-Only": PRODUCTION_CSP,
      "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    },

    /*
      Development-only API proxy: the Laravel API the `api` data source talks
      to, on the same port `deploy/nginx.conf` and `docs/engineering/
      BACKEND_STATUS.md` already agree on (8080).

      Without this, `VITE_DATA_SOURCE=api` in `npm run dev` is a trap. Vite has
      no `/api` route, so its SPA fallback answers the request with `200` and
      `Content-Type: text/html` — index.html, not the API. The client then
      fails parsing HTML as JSON, which reads like a broken backend rather
      than a missing one.

      Deliberately minimal and same-origin:
        - `server.*` is dev-server only; `vite build` never reads it, so the
          production bundles are untouched.
        - Requests stay same-origin, so the shipped CSP (`connect-src 'self'`)
          still holds and NO CORS configuration is needed on the Laravel side.
        - No rewrite, no path stripping: `/api/v1/...` is forwarded verbatim,
          which is exactly what `VITE_API_BASE_URL=/api/v1` already sends.
        - When Laravel is not running the proxy errors loudly instead of
          silently serving the SPA, which is the honest outcome.

      This does not change which data source is selected — that is still
      `VITE_DATA_SOURCE`, and the demo/local default is untouched.
    */
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8080",
      },
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
  },
});
