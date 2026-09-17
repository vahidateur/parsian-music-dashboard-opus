/**
 * Privacy and exposure posture, enforced by the test suite.
 *
 * This is a PRIVATE panel. The whole point is that it never appears in a
 * search index, an AI training corpus, or a "sites running X" dataset. Those
 * are one-line regressions — someone adds an Open Graph tag for a nicer link
 * preview, or a sitemap "for SEO", and the property is quietly gone.
 *
 * These checks read the real files, so the guarantee survives refactoring.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const indexHtml = readFileSync(join(ROOT, "index.html"), "utf8");
const robots = readFileSync(join(ROOT, "public", "robots.txt"), "utf8");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(tsx?|html)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("the document must refuse indexing", () => {
  it("carries a restrictive robots meta tag", () => {
    expect(indexHtml).toMatch(/<meta\s+name="robots"\s+content="[^"]*noindex/i);
    expect(indexHtml).toMatch(/<meta\s+name="robots"\s+content="[^"]*nofollow/i);
    expect(indexHtml).toMatch(/<meta\s+name="robots"\s+content="[^"]*noarchive/i);
  });

  it("names the major engines explicitly as a belt-and-braces measure", () => {
    expect(indexHtml).toMatch(/name="googlebot"[^>]*noindex/i);
    expect(indexHtml).toMatch(/name="bingbot"[^>]*noindex/i);
  });

  it("sends no referrer, so the secret path never leaks to another origin", () => {
    expect(indexHtml).toMatch(/<meta\s+name="referrer"\s+content="no-referrer"/i);
  });
});

describe("the document must not be shareable", () => {
  it("publishes no Open Graph or Twitter card metadata", () => {
    // These exist to make a page quotable and previewable — the opposite of
    // what a private panel wants.
    expect(indexHtml).not.toMatch(/property="og:/i);
    expect(indexHtml).not.toMatch(/name="twitter:/i);
  });

  it("publishes no description for a crawler to snippet", () => {
    expect(indexHtml).not.toMatch(/<meta\s+name="description"/i);
  });

  it("does not name the product or operator in the title", () => {
    const title = /<title>([^<]*)<\/title>/i.exec(indexHtml)?.[1] ?? "";
    expect(title.length).toBeGreaterThan(0);
    for (const term of ["آوا", "موسیقی", "آموزشگاه", "Ava", "Academy", "Music"]) {
      expect(title, `title should not contain "${term}"`).not.toContain(term);
    }
  });

  it("ships no canonical link that would advertise a public URL", () => {
    expect(indexHtml).not.toMatch(/rel="canonical"/i);
  });
});

describe("robots.txt", () => {
  it("refuses everything by default, so an unlisted crawler is still denied", () => {
    expect(robots).toMatch(/User-agent:\s*\*\s*\nDisallow:\s*\//i);
  });

  it("names the major AI training crawlers", () => {
    for (const bot of [
      "GPTBot",
      "ClaudeBot",
      "Google-Extended",
      "CCBot",
      "Bytespider",
      "meta-externalagent",
      "PerplexityBot",
      "Applebot-Extended",
      "Amazonbot",
    ]) {
      expect(robots, `robots.txt should name ${bot}`).toContain(bot);
    }
  });

  it("names the conventional search engines too", () => {
    for (const bot of ["Googlebot", "Bingbot", "YandexBot", "Baiduspider", "DuckDuckBot"]) {
      expect(robots).toContain(bot);
    }
  });

  it("never allows anything", () => {
    // A stray `Allow:` is how a private site accidentally becomes indexable.
    const allows = robots
      .split("\n")
      .filter((line) => /^\s*Allow:/i.test(line))
      .filter((line) => !line.trim().startsWith("#"));
    expect(allows).toEqual([]);
  });

  it("advertises no sitemap", () => {
    expect(robots).not.toMatch(/^\s*Sitemap:/im);
  });

  it("states honestly that it is advisory only", () => {
    // The file must not read as though it were a security control.
    expect(robots.toLowerCase()).toContain("not a control");
  });
});

describe("no sitemap ships", () => {
  it("has no sitemap file in public/", () => {
    for (const name of ["sitemap.xml", "sitemap_index.xml", "sitemap.txt"]) {
      expect(existsSync(join(ROOT, "public", name)), `${name} must not exist`).toBe(false);
    }
  });
});

describe("no secrets in the bundle", () => {
  const files = sourceFiles(join(ROOT, "src"));

  it("hardcodes no access path", () => {
    // The slug must come from build config, never from a literal, or it lands
    // in git and in every developer's clone.
    for (const file of files) {
      if (file.includes("accessPath.ts") || file.includes("__tests__")) continue;
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must not hardcode a 32-hex access slug`).not.toMatch(/["'][a-f0-9]{32}["']/);
    }
  });

  it("contains no private keys or long-lived tokens", () => {
    for (const file of files) {
      // This spec necessarily contains the marker strings it searches for.
      if (file.includes("privacyPosture.test.ts")) continue;
      const source = readFileSync(file, "utf8");
      expect(source, `${file} must not embed a private key`).not.toContain("BEGIN RSA PRIVATE KEY");
      expect(source).not.toContain("BEGIN OPENSSH PRIVATE KEY");
      // A JWT literal in source is always a mistake.
      expect(source, `${file} must not embed a JWT`).not.toMatch(/eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\./);
    }
  });

  it("keeps the demo passphrase out of production code paths", () => {
    // It may exist in the demo auth repository (which defines it), in the
    // banned-password list, and in tests. Nowhere else.
    //
    // Matched as a quoted literal so unrelated occurrences of the string —
    // `arena-demo-backup-....json` is a filename prefix, not a credential —
    // do not trip the check.
    const offenders = files.filter((file) => {
      if (file.includes("demoAuthRepository") || file.includes("__tests__") || file.includes("password.ts")) {
        return false;
      }
      return /["'`]arena-demo["'`]/.test(readFileSync(file, "utf8"));
    });
    expect(offenders).toEqual([]);
  });
});

describe("deployment configs exist and are hardened", () => {
  const nginx = readFileSync(join(ROOT, "deploy", "nginx.conf"), "utf8");

  it("sets X-Robots-Tag as an HTTP header, which a crawler cannot ignore", () => {
    expect(nginx).toMatch(/X-Robots-Tag[^;]*noindex/i);
  });

  it("sets the core OWASP headers", () => {
    for (const header of [
      "Strict-Transport-Security",
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Cross-Origin-Opener-Policy",
    ]) {
      expect(nginx, `nginx.conf must set ${header}`).toContain(header);
    }
  });

  it("uses a CSP with no unsafe-inline or unsafe-eval for scripts", () => {
    const csp = /Content-Security-Policy\s+"([^"]+)"/.exec(nginx)?.[1] ?? "";
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'none'");

    // The script-src directive specifically must be clean; style-src is
    // allowed 'unsafe-inline' as a documented trade-off.
    const scriptSrc = /script-src([^;]*)/.exec(csp)?.[1] ?? "";
    expect(scriptSrc).not.toContain("unsafe-inline");
    expect(scriptSrc).not.toContain("unsafe-eval");
  });

  it("rate limits the login endpoint", () => {
    expect(nginx).toContain("limit_req_zone");
    expect(nginx).toMatch(/auth\/login/);
  });

  it("hides server version information", () => {
    expect(nginx).toContain("server_tokens off");
  });
});
