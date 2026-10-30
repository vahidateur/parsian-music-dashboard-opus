/// <reference types="vitest/config" />
import net from "node:net";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { resolveDataSourceNotice } from "./scripts/lib/data-source-notice.mjs";
import { classifyDataSource } from "./src/api/dataSourceVocabulary.ts";

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

/*
 * The API origin the dev proxy forwards to (see `server.proxy` below) and the
 * origin the dev-full script starts Laravel on. One place, so the disclosure
 * and the proxy can never point at different backends.
 */
const API_HOST = "127.0.0.1";
const API_PORT = 8080;

/**
 * True when something is already listening on the API port.
 *
 * A connect attempt, not a PID check: the question the disclosure answers is
 * "is a backend reachable there?", and a listener on that port is exactly
 * that. Loopback only, and it never sends a byte.
 */
function portIsListening(host: string, port: number, timeoutMs = 400): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const finish = (listening: boolean) => {
      socket.destroy();
      resolve(listening);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

/**
 * The dev-server data-source disclosure.
 *
 * DEV-ONLY (`apply: "serve"`), and its text lives outside `src/`, so it can
 * never reach a built artifact.
 *
 * `npm run dev` and `npm run dev:full` are two different applications behind
 * two different commands, and running the backend alongside `npm run dev` does
 * NOT connect them: the demo composition reads and writes the browser's own
 * storage, so every change lands there and the database stays untouched —
 * which reads exactly like "the two are not wired together". This plugin
 * states, in the terminal, which of the two is running and, when a backend is
 * up that this server will not use, the command that does use it.
 *
 * The classification comes from the same vocabulary the runtime config uses
 * (`src/api/dataSourceVocabulary.ts`), so the terminal cannot claim a data
 * source the panel does not use.
 */
function dataSourceDisclosure(): Plugin {
  return {
    name: "parsian:data-source-disclosure",
    apply: "serve",
    configureServer(server) {
      void (async () => {
        const apiPortBusy = await portIsListening(API_HOST, API_PORT);
        const notice = resolveDataSourceNotice({
          appTarget: APP_TARGET,
          sourceClass: classifyDataSource(process.env.VITE_DATA_SOURCE, APP_TARGET),
          apiPortBusy,
          apiHost: API_HOST,
          apiPort: API_PORT,
        });
        for (const line of notice.lines) server.config.logger.info(`[dev] ${line}`);
      })();
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), dataSourceDisclosure()],
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
      Dev-only API proxy.

      The app defaults to a RELATIVE api base (`VITE_API_BASE_URL=/api/v1`,
      .env.example) so the browser never talks to a different origin than the one
      serving the panel. In production the edge routes `/api` to the backend; in
      development there is no edge, so without this the dev server would answer
      `/api/...` itself and every call in api mode would 404.

      WHY THIS IS SAFE:

      - DEV-ONLY BY CONSTRUCTION. `server.proxy` is read by the dev server only.
        It is not an input to the build, so it cannot reach `dist/` and no
        production bundle learns about it (`bundleBoundary` still scans the real
        output for demo/backend leakage).
      - NO CORS. The browser keeps calling the SAME origin it loaded the panel
        from; the proxy forwards server-side. No `Access-Control-*` header is
        added anywhere, and none is needed.
      - NO CSP CHANGE. Nothing here alters `PRODUCTION_CSP` (still asserted
        against deploy/nginx.conf by `cspCompatibility.test.ts`), and the dev CSP
        stays report-only and permissive for HMR as before.
      - PATH AND QUERY ARE PRESERVED. No `rewrite`, so `/api/v1/students?page=2`
        arrives at the backend as `/api/v1/students?page=2`. `changeOrigin` only
        rewrites the `Host` header, which the backend's vhost needs.
      - LOOPBACK TARGET. 127.0.0.1, not 0.0.0.0: the backend runs on this
        machine; binding the proxy to a routable interface would be a way to
        reach a dev backend from outside it.

      `preview` deliberately does NOT get a proxy: a preview of the built client
      is a static artifact check, not an integration environment, and silently
      forwarding its /api calls would make an unconfigured deployment look wired.
    */
    proxy: {
      "/api": {
        target: `http://${API_HOST}:${API_PORT}`,
        changeOrigin: true,
      },
    },
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
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
  },
});
