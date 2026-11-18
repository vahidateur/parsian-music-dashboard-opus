# Composer security remediation — 2026-11-17

## Scope

This change contains **dependency updates only**. It does not touch application code,
authorization policy, feature behaviour, or PR #25 (`feat/phase16-18-consolidation-20261116`),
which remains Draft and unchanged.

Baseline: `origin/main` = `233c620253c21be9dd8be46521e815df56f61c44`.
New branch: `feat/composer-security-20261117`.

## Advisory reconciliation (before update)

Seven packages, ten advisories, from `composer audit --locked` and cross-checked against
Packagist and upstream Symfony/Laravel/PHPUnit advisories.

| Package | Installed | Advisory | Severity (upstream) | CVSS | Fixed |
|---|---|---|---|---|---|
| `laravel/framework` | v13.38.0 | CVE-2026-128083 | low (Packagist) | not published | 13.40.0 |
| `phpunit/phpunit` | 13.4.3 | CVE-2026-119193 | medium (Packagist) | not published | 13.4.4 |
| `symfony/http-foundation` | v8.1.9 | CVE-2026-121619 | not rated in Packagist | not published | 8.1.11 |
| `symfony/http-foundation` | v8.1.9 | CVE-2026-118514 | not rated in Packagist | not published | 8.1.11 |
| `symfony/http-foundation` | v8.1.9 | PKSA-pr6q / GHSA-3h27-hjv7-fqjx | **Low** (upstream) | not published | 8.1.11 |
| `symfony/http-foundation` | v8.1.9 | PKSA-b2gg / GHSA-5mx8-mwrp-5693 | **Moderate** (upstream) | not published | 8.1.11 |
| `symfony/http-kernel` | v8.1.9 | CVE-2026-123339 | not rated in Packagist | not published | 8.1.11 |
| `symfony/mime` | v8.1.7 | CVE-2026-45070 | medium (Packagist) | not published | 8.1.10 |
| `symfony/routing` | v8.1.9 | CVE-2026-118516 | not rated in Packagist | not published | 8.1.11 |
| `symfony/yaml` | v8.1.9 | CVE-2026-123792 / GHSA-hwfg-qwvh-2wfx | **High** (upstream) | **8.7** — `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N` | 8.1.11 |

### Symfony YAML severity reconciliation

`composer audit` reports `severity: none` because the Packagist entry for
CVE-2026-123792 has no severity field. Upstream `GHSA-hwfg-qwvh-2wfx` rates it **High,
CVSS 8.7** (network, low complexity, no privileges, availability impact). The correct
classification for this advisory is the upstream **High**; the Composer field is
missing metadata, not a low-risk finding.

Reachability in this repository: `symfony/yaml` comes only through `laravel/sail`
(`require-dev`). No `Yaml::` usage, YAML request format, or `MapRequestPayload` YAML
acceptance exists in `app/`, `config/`, `routes/` or `tests/`. Therefore the High-severity
DoS advisory is **not reachable at runtime**, but it is fixed here anyway because the
patch is a within-constraint minor update.

## Deployment exposure (two HttpFoundation advisories)

Repository configuration was inspected: `deploy/nginx.conf`, `deploy/Caddyfile`,
`docs/security.md`, `docs/production-handoff.md`, `docs/architecture/environments.md`.

- The checked-in server configs describe the **frontend SPA only**: `root /var/www/panel`,
  hashed-asset caching, an access-path slug, and `location /api/` proxied to
  `127.0.0.1:8080`.
- No backend web-server configuration, PHP-FPM pool, `fastcgi_split_path_info`,
  `.htaccess`, front-controller-in-subdirectory rewrite, CDN or WAF rule is present in
  the repository.
- `trusted_proxies` / `TrustProxies` / `private_ranges` / `trusted_hosts` are **not**
  configured anywhere in `app/`, `config/` or `bootstrap/`.

| Advisory | Condition | Assessment |
|---|---|---|
| PKSA-pr6q / GHSA-3h27-hjv7-fqjx — path rules in front of PHP bypassable via `/index.phpadmin` | Requires a web-server/CDN/WAF path rule that guards a path ahead of the front controller, plus `SCRIPT_NAME`-based stripping | **UNKNOWN**. Repo nginx rules guard dotfiles and assets at the SPA edge, not backend PHP routes; backend server rules are not in the repository. `trusted_hosts` is irrelevant to this advisory. |
| PKSA-b2gg / GHSA-5mx8-mwrp-5693 — generated URLs take a client-chosen host | Requires front controller in a subdirectory with rewrite of all URLs to it, or a server setting `SCRIPT_NAME` to the request path (e.g. `php -S` with a router script, or nginx without `fastcgi_split_path_info`) | **UNKNOWN**. The local topology proxies `/api/` to `127.0.0.1:8080`; how that upstream sets `SCRIPT_NAME` is not recorded here. `framework.trusted_hosts` does **not** mitigate this advisory. |

Both advisories are patched by `symfony/http-foundation` 8.1.11, so exposure uncertainty
does not block the update.

## Dependency graph and changes

`composer why` established:

- **direct**: `laravel/framework` (`require`), `phpunit/phpunit` (`require-dev`)
- **transitive from `laravel/framework`**: `symfony/http-foundation`, `symfony/http-kernel`,
  `symfony/mime`, `symfony/routing`
- **transitive from `laravel/sail` (dev)**: `symfony/yaml`

The update was limited to the seven affected packages at their minimum fixed versions and
`--with-dependencies`. Composer's resolver also moved 32 patch/minor transitive packages
that constrain those fixes (for example `symfony/console`, `symfony/mailer`, `monolog`,
`guzzle`). **No major version changed**, and `composer.json` was not modified.

Key versions after update:

| Package | Before | After |
|---|---|---|
| `laravel/framework` | v13.38.0 | v13.40.0 |
| `phpunit/phpunit` | 13.4.3 | 13.4.4 |
| `symfony/http-foundation` | v8.1.9 | v8.1.11 |
| `symfony/http-kernel` | v8.1.9 | v8.1.11 |
| `symfony/mime` | v8.1.7 | v8.1.10 |
| `symfony/routing` | v8.1.9 | v8.1.11 |
| `symfony/yaml` | v8.1.9 | v8.1.11 |

## Verification

- `composer validate` — `./composer.json is valid`
- `composer audit --locked` — `No security vulnerability advisories found.` (exit 0)
- PHP lint — all `app/config/database/routes/tests/bootstrap/public` PHP files clean
- `php artisan test` (SQLite) — 471 passed, 2 skipped, 3260 assertions
- `php artisan test` (MySQL 8.4.13) — 473 passed, 0 skipped, 3274 assertions
- HTTP smoke — executed by GitHub Actions on the published dependency branch

### CI reliability note

The first full frontend run on this branch hit a known timing-sensitive assertion in
`emptyEnvironmentPanels.test.tsx` (the empty-environment branding save case) that was already
stabilized in PR #25 by commit `c9e6c2b`. Because this branch starts from `main`, it did not
contain that fix. The same test-only stabilization is applied here as a separate commit so
the dependency PR's CI is reliable; it changes no product code and no assertion semantics —
it only waits for the form to be writable before clicking save. The change is identical to
`c9e6c2b`, so it will merge cleanly once PR #25 is merged first.

## Owner decisions still open

- Confirm the real backend deployment topology for the two UNKNOWN HttpFoundation
  conditions (document root, `SCRIPT_NAME`, any path-level CDN/WAF rules).
- Decide whether to make `pr-gate` a required check on `main` after its real run succeeds.

## Phase M — Laravel signed-URL advisory closure (2026-11-18)

### New advisories

| Advisory | Package | Severity | CVSS | Affected (13.x) | Fixed | Target | Status |
|---|---|---|---|---|---|---|---|
| [GHSA-6rv8-qj5v-p8ch](https://github.com/laravel/framework/security/advisories/GHSA-6rv8-qj5v-p8ch) — temporary signed URL expiration bypass via unencoded numeric-keyed route parameters | `laravel/framework` | **Moderate** | 4.8 (`CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N`) | `>=13.0.0, <13.41.0` | 13.41.0 | 13.43.0 | FIXED |
| [GHSA-v5ch-g375-82r6](https://github.com/laravel/framework/security/advisories/GHSA-v5ch-g375-82r6) — temporary signed URL expiration bypass via `max_input_vars` | `laravel/framework` | **Moderate** | 4.8 (same vector) | `>=13.0.0, <13.41.0` | 13.41.0 | 13.43.0 | FIXED |

Both advisories are **Moderate 4.8**, not Low. `composer audit` did not list them at the
time of the audit (Packagist advisory metadata lagged the upstream GHSA pages published
2026-11-11); the update was driven by the official upstream advisories, not by the audit
database. This discrepancy is recorded rather than treated as a clean bill of health from
one source.

### Target selection

Laravel 13.41.0 and 13.42.0 were released 2026-11-10; **13.43.0** was released
2026-11-17 and is the latest stable 13.x on Packagist at execution time. Its changelog
includes both fixes: PR #62349 (`expires` fallback from raw query string) and PR #62401
(URL-encoding numeric-keyed query parameters). No major version change and no PHP platform
drift: `composer.json` still requires `php: ^8.4`, and the lock's `platform` remains `php: ^8.4`.

Dry run (`composer update laravel/framework --with-all-dependencies --dry-run`) proposed
exactly two changes: `laravel/framework` v13.40.0 → v13.43.0 and `guzzlehttp/guzzle`
8.5.1 → 8.5.2. The actual run matched the dry run.

### Attack conditions and reachability

- **GHSA-6rv8**: requires the application to forward attacker-influenced, numeric-keyed
  request arrays into `temporarySignedRoute()` / `signedRoute()` where they do not fill a
  route placeholder. Repository-wide search of `app/`, `routes/`, `config/` and `tests/`
  found **no** signed-route call sites, no `hasValidSignature*` usage and no `signed`
  middleware. There is therefore no application-level data flow that can feed such input
  to the generator.
- **GHSA-v5ch**: requires a request line long enough to exceed PHP `max_input_vars`, so the
  parsed `expires` is dropped while the raw query still carries it. Local PHP reports
  `max_input_vars=1000`; the real backend web-server/proxy limits remain **UNKNOWN** (same
  deployment gap as the HttpFoundation advisories). `trusted_hosts` does not mitigate it.

No application middleware workaround was added: the official framework patch in 13.43.0
is installed, and inventing a second signature-verification layer would duplicate an
approved security boundary.

### Dependency diff and supply chain

Only two packages moved relative to `7b8d83c`:

| Package | Before | After | Type | Scope |
|---|---|---|---|---|
| `laravel/framework` | v13.40.0 | v13.43.0 | direct | production |
| `guzzlehttp/guzzle` | 8.5.1 | 8.5.2 | transitive | production |

`composer.json` unchanged; no major version changes; repository sources unchanged; no new
plugins, scripts, or platform requirements; `composer validate --strict` passes.

### Verification after this update

- `composer audit --locked` — `No security vulnerability advisories found.` (exit 0)
- PHP lint — clean
- Backend SQLite — **471 passed, 2 skipped, 3260 assertions**
- Backend MySQL 8.4.13 — **473 passed, 0 skipped, 3274 assertions**
- No application-level signed-URL regression test was added because there is no call site;
  the framework patch plus the full suites are the evidence for this PR.

### Residual risk

The production deployment topology is still not documented in the repository. If a future
feature introduces signed URLs, it must pass only explicitly selected, string-keyed
parameters and must cap URL length at the edge.
