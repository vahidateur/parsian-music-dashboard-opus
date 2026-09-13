/// <reference types="vitest/config" />
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
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
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["src/test/setup.ts"],
  },
});
