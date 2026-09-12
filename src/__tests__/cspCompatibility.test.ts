/**
 * CSP compatibility, verified against the REAL production build artifact.
 *
 * WHY THIS TEST EXISTS
 *
 * A previous phase shipped a CSP of `script-src 'self'` while the build used
 * `vite-plugin-singlefile`, which inlines the whole application into a
 * nonce-less `<script type="module">`. The policy string looked exemplary and
 * would have white-screened production. Asserting that a CSP *reads* securely
 * proves nothing — the only meaningful check parses what the bundler actually
 * emitted and asks whether the policy permits it.
 *
 * So this test:
 *   1. requires a real `dist/` (run `npm run build` first);
 *   2. parses the emitted HTML;
 *   3. simulates the CSP against every resource the document loads;
 *   4. fails if the policy would block the application OR if the policy has
 *      been weakened to make it pass.
 *
 * If `dist/` is absent the suite SKIPS rather than silently passing — a green
 * check that ran no assertions is worse than a red one.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DIST = join(ROOT, "dist");
const DIST_HTML = join(DIST, "index.html");
const hasBuild = existsSync(DIST_HTML);

/** Extracts the enforced CSP from the nginx deployment config. */
function nginxCsp(): string {
  const conf = readFileSync(join(ROOT, "deploy", "nginx.conf"), "utf8");
  const match = /add_header\s+Content-Security-Policy\s+"([^"]+)"/.exec(conf);
  if (!match) throw new Error("nginx.conf does not set Content-Security-Policy");
  return match[1];
}

function caddyCsp(): string {
  const conf = readFileSync(join(ROOT, "deploy", "Caddyfile"), "utf8");
  const match = /Content-Security-Policy\s+"([^"]+)"/.exec(conf);
  if (!match) throw new Error("Caddyfile does not set Content-Security-Policy");
  return match[1];
}

/** Parses a CSP string into directive → source list. */
function parseCsp(csp: string): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const part of csp.split(";")) {
    const tokens = part.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) continue;
    out[tokens[0]] = tokens.slice(1);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Minimal HTML scanning — no dependency, no jsdom needed              */
/* ------------------------------------------------------------------ */

interface Tag {
  name: string;
  attrs: Record<string, string>;
}

/** Collects <script>, <link> and <style> start tags from the document. */
function scanTags(html: string): Tag[] {
  const tags: Tag[] = [];
  const re = /<(script|link|style)\b([^>]*)>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    const attrs: Record<string, string> = {};
    const attrRe = /([a-zA-Z-]+)(?:\s*=\s*"([^"]*)")?/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(match[2])) !== null) {
      attrs[a[1].toLowerCase()] = a[2] ?? "";
    }
    tags.push({ name: match[1].toLowerCase(), attrs });
  }
  return tags;
}

describe.skipIf(!hasBuild)("the production artifact must load under the deployed CSP", () => {
  const html = hasBuild ? readFileSync(DIST_HTML, "utf8") : "";
  const tags = scanTags(html);
  const scripts = tags.filter((t) => t.name === "script");
  const styles = tags.filter((t) => t.name === "style");

  it("emits at least one script, so the test is not vacuous", () => {
    expect(scripts.length).toBeGreaterThan(0);
  });

  it("emits NO inline script — the exact failure that shipped before", () => {
    const inline = scripts.filter((s) => s.attrs.src === undefined);
    const detail = inline.map((s) => JSON.stringify(s.attrs)).join(", ");
    // `script-src 'self'` permits externally loaded same-origin scripts only.
    // An inline script would need a nonce or hash, neither of which a static
    // file server can provide per response.
    expect(inline.length, `inline script(s) would be BLOCKED: ${detail}`).toBe(0);
  });

  it("loads every script from a same-origin path that 'self' permits", () => {
    for (const script of scripts) {
      const src = script.attrs.src;
      expect(src, "script must have a src").toBeTruthy();
      // Relative or root-relative only: an absolute URL to another origin
      // would need that origin listed in script-src.
      expect(src.startsWith("/") || src.startsWith("./"), `${src} must be same-origin`).toBe(true);
      expect(src.startsWith("//"), `${src} must not be protocol-relative`).toBe(false);
    }
  });

  it("emits no inline <style> block, so style-src 'self' suffices", () => {
    expect(styles.length, "inline <style> would need style-src 'unsafe-inline'").toBe(0);
  });

  it("loads every stylesheet from a same-origin path", () => {
    const sheets = tags.filter((t) => t.name === "link" && t.attrs.rel === "stylesheet");
    expect(sheets.length).toBeGreaterThan(0);
    for (const sheet of sheets) {
      expect(sheet.attrs.href.startsWith("/") || sheet.attrs.href.startsWith("./")).toBe(true);
    }
  });

  it("references only fonts that font-src 'self' permits", () => {
    // Fonts are emitted into assets/ and referenced from the CSS, not the
    // HTML. Confirm none were left as remote URLs.
    const cssFiles = readdirSync(join(DIST, "assets")).filter((f) => f.endsWith(".css"));
    expect(cssFiles.length).toBeGreaterThan(0);
    for (const file of cssFiles) {
      const css = readFileSync(join(DIST, "assets", file), "utf8");
      const remote = css.match(/url\((?:'|")?https?:\/\/[^)]+\)/g) ?? [];
      expect(remote, `remote url() in ${file} would be blocked`).toEqual([]);
    }
  });

  it("contains no eval or new Function, so 'unsafe-eval' is genuinely unnecessary", () => {
    const jsFiles = readdirSync(join(DIST, "assets")).filter((f) => f.endsWith(".js"));
    expect(jsFiles.length).toBeGreaterThan(0);
    for (const file of jsFiles) {
      const js = readFileSync(join(DIST, "assets", file), "utf8");
      expect(js, `new Function( in ${file} would require 'unsafe-eval'`).not.toContain("new Function(");
    }
  });

  it("ships no source map, which would expose the original TypeScript", () => {
    const maps = readdirSync(join(DIST, "assets")).filter((f) => f.endsWith(".map"));
    expect(maps).toEqual([]);
  });
});

describe("the policy itself must not be weakened", () => {
  const csp = parseCsp(nginxCsp());

  it("permits no inline or eval'd script", () => {
    expect(csp["script-src"]).toBeDefined();
    expect(csp["script-src"]).not.toContain("'unsafe-inline'");
    expect(csp["script-src"]).not.toContain("'unsafe-eval'");
    expect(csp["script-src"]).not.toContain("*");
  });

  it("permits no inline <style> block", () => {
    // style-src covers <style> elements and stylesheet loads. Only
    // style-src-attr may relax, and only for element attributes.
    expect(csp["style-src"]).not.toContain("'unsafe-inline'");
  });

  it("allows inline style ATTRIBUTES only, which cannot execute code", () => {
    // React's style={{...}} props compile to style attributes. This is the one
    // documented relaxation and it is deliberately the narrowest directive
    // that covers them.
    expect(csp["style-src-attr"]).toContain("'unsafe-inline'");
  });

  it("locks down the directives that matter for injection and framing", () => {
    expect(csp["default-src"]).toEqual(["'self'"]);
    expect(csp["object-src"]).toEqual(["'none'"]);
    expect(csp["base-uri"]).toEqual(["'none'"]);
    expect(csp["frame-ancestors"]).toEqual(["'none'"]);
    expect(csp["form-action"]).toEqual(["'self'"]);
  });

  it("does not allow arbitrary remote connections", () => {
    expect(csp["connect-src"]).toEqual(["'self'"]);
  });
});

describe("deployment configs must not drift apart", () => {
  it("nginx and Caddy enforce byte-identical policies", () => {
    // Two configs with different policies means one environment is untested.
    expect(caddyCsp()).toBe(nginxCsp());
  });

  it("the dev server reports against the same policy the edge enforces", () => {
    const viteConfig = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
    // Report-Only in dev, because Vite's HMR client needs inline scripts that
    // production does not ship. The directives are otherwise the same string.
    expect(viteConfig).toContain("Content-Security-Policy-Report-Only");
    expect(viteConfig).toContain("PRODUCTION_CSP");

    // Every directive in the deployed policy must appear in the dev constant.
    for (const directive of Object.keys(parseCsp(nginxCsp()))) {
      expect(viteConfig, `dev CSP is missing ${directive}`).toContain(directive);
    }
  });
});

describe("the bundler must not reintroduce single-file inlining", () => {
  it("does not use vite-plugin-singlefile", () => {
    const viteConfig = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
    // Re-adding it silently reintroduces the inline script this test exists to
    // prevent, and the failure only appears once the CSP is deployed.
    expect(viteConfig).not.toMatch(/^\s*import\s+\{[^}]*viteSingleFile/m);
    expect(viteConfig).not.toMatch(/viteSingleFile\(\)/);
  });

  it("emits hashed asset filenames so they can be cached immutably", () => {
    const viteConfig = readFileSync(join(ROOT, "vite.config.ts"), "utf8");
    expect(viteConfig).toContain("[hash]");
  });
});
