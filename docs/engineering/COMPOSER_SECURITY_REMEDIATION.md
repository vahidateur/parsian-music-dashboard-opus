# Composer security remediation — reconciled record

This document is the single auditable record of the dependency security work on
`feat/composer-security-20261117` (PR #26). It preserves the history of both remediation
phases and states the final version and evidence unambiguously.

## 1. Scope and protected PR boundaries

- Repository: `vahidateur/parsian-music-dashboard-opus`.
- Base: `origin/main` = `233c620253c21be9dd8be46521e815df56f61c44` (unchanged throughout).
- Authorized branch: `feat/composer-security-20261117` / PR #26.
- Protected branch: `feat/phase16-18-consolidation-20261116` / PR #25,
  head `f322437a62c3064f7ef3f789a33448ffe72f0422`. PR #25 was not modified.
- PR #26 scope: **runtime dependency security remediation with one isolated frontend
  test-stability adjustment**. No application runtime behaviour, authorization policy,
  API contract, or product feature was changed.

Baseline before remediation: `laravel/framework` **v13.38.0**, with 7 advisory-bearing
packages and 10 advisory records.

## 2. Original advisory baseline

The first audit (Phase L, 2026-11-17) used `composer audit --locked`, cross-checked against
Packagist and upstream advisories.

| Package | Baseline version | Advisory | Severity (upstream) | CVSS | Minimum fix |
|---|---|---|---|---|---|
| `laravel/framework` | v13.38.0 | CVE-2026-128083 | low (Packagist) | not published | 13.40.0 |
| `phpunit/phpunit` | 13.4.3 | CVE-2026-119193 | medium (Packagist) | not published | 13.4.4 |
| `symfony/http-foundation` | v8.1.9 | CVE-2026-121619 | not rated in Packagist | not published | 8.1.11 |
| `symfony/http-foundation` | v8.1.9 | CVE-2026-118514 | not rated in Packagist | not published | 8.1.11 |
| `symfony/http-foundation` | v8.1.9 | PKSA-pr6q / GHSA-3h27-hjv7-fqjx | Low (upstream) | not published | 8.1.11 |
| `symfony/http-foundation` | v8.1.9 | PKSA-b2gg / GHSA-5mx8-mwrp-5693 | Moderate (upstream) | not published | 8.1.11 |
| `symfony/http-kernel` | v8.1.9 | CVE-2026-123339 | not rated in Packagist | not published | 8.1.11 |
| `symfony/mime` | v8.1.7 | CVE-2026-45070 | medium (Packagist) | not published | 8.1.10 |
| `symfony/routing` | v8.1.9 | CVE-2026-118516 | not rated in Packagist | not published | 8.1.11 |
| `symfony/yaml` | v8.1.9 | CVE-2026-123792 / GHSA-hwfg-qwvh-2wfx | **High** (upstream) | **8.7** `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:H/SC:N/SI:N/SA:N` | 8.1.11 |

Severity reconciliation: Packagist left CVE-2026-123792 unrated, while upstream
GHSA-hwfg-qwvh-2wfx rates it High / 8.7. The upstream classification is authoritative; the
blank Composer field is missing metadata, not a low-risk finding.

## 3. Phase L — initial dependency remediation (2026-11-17)

- Commit `f5ed66dbf29c7497ad9e67d8f74020450dfb5f7a` — `chore(deps): patch Composer security advisories`.
- Commit `7b8d83c1d2319a7c9b829cde7e67f3a490a334cc` — test-only stabilization of
  `src/domains/shared/__tests__/emptyEnvironmentPanels.test.tsx` plus a documentation note.
- `laravel/framework` was raised only to **13.40.0**, the minimum fix for
  CVE-2026-128083. Relative to `main`, the resolver moved **38 package upgrades and removed
  `theseer/tokenizer`** (39 package-entry changes). Of those, 7 were the advisory-target
  packages and 31 were transitive patch/minor moves. No major version changed;
  `composer.json` and the `php: ^8.4` platform requirement were unchanged.

The test-only stabilization was needed because this branch starts from `main` and therefore
lacked the equivalent fix already present on PR #25 (`c9e6c2b`). It adds waits for the form
to be writable before clicking save; all original assertions remain, including the toast
assertions, and one store assertion was added — no coverage was removed.

## 4. Phase M — Laravel signed-URL advisory closure (2026-11-18)

Two advisories published upstream on 2026-11-11 were verified directly from the official
GitHub Security Advisory pages:

| Advisory | Severity / CVSS | Affected 13.x | Fixed | Mechanism |
|---|---|---|---|---|
| [GHSA-6rv8-qj5v-p8ch](https://github.com/laravel/framework/security/advisories/GHSA-6rv8-qj5v-p8ch) | **Moderate 4.8** `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N` | `>=13.0.0, <13.41.0` | 13.41.0 | Attacker-influenced numeric-keyed parameters to `temporarySignedRoute()` / `signedRoute()` were appended unencoded, allowing a second authoritative `expires` field. |
| [GHSA-v5ch-g375-82r6](https://github.com/laravel/framework/security/advisories/GHSA-v5ch-g375-82r6) | **Moderate 4.8** (same vector) | `>=13.0.0, <13.41.0` | 13.41.0 | When `max_input_vars` drops the parsed `expires`, signature verification against the raw query can treat an expired URL as non-expiring. |

Both are **Moderate**, not Low.

Target selection: 13.41.0 and 13.42.0 were published 2026-11-10; **13.43.0** was published
2026-11-17 and was the latest stable 13.x on Packagist at execution time. Its changelog
contains both patches (PR #62349 and PR #62401). A dry run proposed exactly two changes —
`laravel/framework` v13.40.0 → v13.43.0 and transitive `guzzlehttp/guzzle` 8.5.1 → 8.5.2 —
and the actual update matched.

Commit `43b43bc195bccd96615614689467c056f71b0224` —
`fix(deps): update Laravel to latest patched 13.x release`.

## 5. Final cumulative dependency state

| Package | Baseline (main) | Phase L | Final | Scope |
|---|---|---|---|---|
| `laravel/framework` | v13.38.0 | v13.40.0 | **v13.43.0** | direct, production |
| `guzzlehttp/guzzle` | 8.3.0 | 8.5.1 | **8.5.2** | transitive, production |
| `phpunit/phpunit` | 13.4.3 | 13.4.4 | **13.4.4** | direct, development |
| `symfony/http-foundation` | v8.1.9 | v8.1.11 | **v8.1.11** | transitive, production |
| `symfony/http-kernel` | v8.1.9 | v8.1.11 | **v8.1.11** | transitive, production |
| `symfony/mime` | v8.1.7 | v8.1.10 | **v8.1.10** | transitive, production |
| `symfony/routing` | v8.1.9 | v8.1.11 | **v8.1.11** | transitive, production |
| `symfony/yaml` | v8.1.9 | v8.1.11 | **v8.1.11** | transitive via Sail, development |

Counts recomputed from the actual lockfiles:

- **Phase M incremental** (relative to `7b8d83c`): 2 upgrades, 0 removals, 0 additions.
- **Cumulative final vs `origin/main`**: **38 upgrades + 1 removal** (`theseer/tokenizer`),
  0 additions — 39 changed package entries.
- Of the 38 upgrades, **7** are the advisory-target packages; the other **31** are
  resolver-driven patch/minor moves: `doctrine/inflector`, `guzzlehttp/guzzle`,
  `guzzlehttp/psr7`, `laravel/prompts`, `laravel/serializable-closure`,
  `league/commonmark`, `league/uri`, `league/uri-interfaces`, `monolog/monolog`,
  `nesbot/carbon`, `nunomaduro/termwind`, `phpunit/php-code-coverage`, `ramsey/uuid`,
  `sebastian/version`, `symfony/console`, `symfony/css-selector`,
  `symfony/deprecation-contracts`, `symfony/error-handler`,
  `symfony/event-dispatcher-contracts`, `symfony/finder`, `symfony/mailer`,
  `symfony/polyfill-intl-grapheme`, `symfony/polyfill-mbstring`,
  `symfony/polyfill-php85`, `symfony/process`, `symfony/service-contracts`,
  `symfony/string`, `symfony/translation`, `symfony/translation-contracts`,
  `symfony/var-dumper`, `vlucas/phpdotenv`.

Not every package change is itself a security fix: most are resolver-driven transitive
updates required by the fixed versions. No major version moved; `composer.json`, repository
definitions, package sources, Composer plugins, scripts and platform requirements are
unchanged.

## 6. Final advisory reconciliation matrix

| Advisory | Package | Severity | Minimum fix | Final installed | Closed |
|---|---|---|---|---|---|
| GHSA-6rv8-qj5v-p8ch | `laravel/framework` | Moderate 4.8 | 13.41.0 | 13.43.0 | YES |
| GHSA-v5ch-g375-82r6 | `laravel/framework` | Moderate 4.8 | 13.41.0 | 13.43.0 | YES |
| CVE-2026-128083 | `laravel/framework` | low | 13.40.0 | 13.43.0 | YES |
| CVE-2026-119193 | `phpunit/phpunit` | medium (dev) | 13.4.4 | 13.4.4 | YES |
| CVE-2026-121619 | `symfony/http-foundation` | not rated | 8.1.11 | 8.1.11 | YES |
| CVE-2026-118514 | `symfony/http-foundation` | not rated | 8.1.11 | 8.1.11 | YES |
| GHSA-3h27-hjv7-fqjx | `symfony/http-foundation` | Low | 8.1.11 | 8.1.11 | YES |
| GHSA-5mx8-mwrp-5693 | `symfony/http-foundation` | Moderate | 8.1.11 | 8.1.11 | YES |
| CVE-2026-123339 | `symfony/http-kernel` | not rated | 8.1.11 | 8.1.11 | YES |
| CVE-2026-45070 | `symfony/mime` | medium | 8.1.10 | 8.1.10 | YES |
| CVE-2026-118516 | `symfony/routing` | not rated | 8.1.11 | 8.1.11 | YES |
| GHSA-hwfg-qwvh-2wfx | `symfony/yaml` | High 8.7 | 8.1.11 | 8.1.11 | YES |

**Metadata discrepancy (observation 2026-11-18).** `composer audit --locked` reports
`No security vulnerability advisories found.` (exit 0), while the two Laravel GHSA records
above existed since 2026-11-11. Packagist's advisory feed had not propagated them into the
Composer audit database at the time of the check. A clean audit result is therefore **not**
treated as proof of absence; upstream GHSA records were the decision source. This
discrepancy must be rechecked before relying on audit alone in future.

## 7. Application reachability and deployment exposure

- **Laravel signed URLs**: repository-wide search of `app/`, `routes/`, `config/` and
  `tests/` found no `temporarySignedRoute`, `signedRoute`, `hasValidSignature*`,
  `hasValidRelativeSignature` or `signed` middleware usage. That establishes the absence of
  an application-level data flow into the vulnerable generator; it does **not** negate the
  framework-level vulnerability, which is fixed by the installed version.
- **GHSA-v5ch**: local PHP reports `max_input_vars=1000`; real web-server/proxy request-line
  limits are **UNKNOWN**. `trusted_hosts` does not mitigate this advisory.
- **GHSA-3h27-hjv7-fqjx**: **UNKNOWN** — needs a web-server/CDN/WAF path rule ahead of PHP
  plus `SCRIPT_NAME` stripping. The checked-in nginx/Caddy files configure the frontend SPA
  only and do not prove anything about backend PHP routing.
- **GHSA-5mx8-mwrp-5693**: **UNKNOWN** — needs a front controller in a subdirectory or a
  server that sets `SCRIPT_NAME` to the request path. `framework.trusted_hosts` does not
  mitigate it.
- **GHSA-hwfg-qwvh-2wfx** (`symfony/yaml`): dev-only via `laravel/sail`; no YAML parsing in
  application code. Fixed regardless.

All UNKNOWN conditions remain unresolved until real backend deployment configuration is
supplied. No production topology was invented or assumed.

## 8. Validation and GitHub Actions evidence

Validation was performed on the dependency code HEAD
`43b43bc195bccd96615614689467c056f71b0224`:

- `composer validate --strict` — `./composer.json is valid`.
- `composer audit --locked` — no advisories in the Composer database (see discrepancy in §6).
- PHP lint — clean across `app/`, `config/`, `database/`, `routes/`, `tests/`, `bootstrap/`, `public/`.
- `php artisan test` (SQLite) — 471 passed, 2 skipped, 3260 assertions.
- `php artisan test` (MySQL 8.4.13, isolated `parsian_ci` database) — 473 passed,
  0 skipped, 3274 assertions.
- No signed-URL application regression test was added because no call site exists; the
  framework patch and the full suites are the evidence.

GitHub Actions runs associated with that exact SHA:

| Run ID | Trigger | Jobs | Conclusion |
|---|---|---|---|
| 44267093752 | pull_request | PHP 8.5 Laravel suite, MySQL 8, HTTP smoke | success |
| 44267093805 | pull_request | frontend (typechecks, Vitest, builds, bundle gates) | success |
| 44267102041 | push | PHP 8.5 Laravel suite, MySQL 8, HTTP smoke | success |
| 44267101727 | push | frontend | success |

Earlier run IDs belonged to earlier commits and are superseded; they are not evidence for
the final code state. A subsequent documentation-only commit changes no dependency or
runtime file; its own CI results are reported in the phase report and PR description rather
than back-dated into this table.

## 9. Remaining risks and owner decisions

- **UNKNOWN** backend deployment topology for the two HttpFoundation advisories and the
  `max_input_vars` condition — owner must supply real configuration before production
  sign-off, even though the packages are patched.
- Composer advisory metadata lag — cross-check upstream GHSA records, not audit alone.
- 39 cumulative lockfile entries changed — 7 targeted security packages, 31 resolver-driven
  transitive upgrades, 1 removal; reviewed via CI but still warrant human review.
- No independent human review of PR #26 has been submitted; green CI is not an approval.
- PR #25 integration must be re-evaluated after PR #26 is actually merged.
- No deployment, release, or Ruleset change is authorized in this work.

## 10. Coordinated PR integration plan (not executed)

1. Independently review PR #26; obtain explicit owner authorization before merging it.
2. After PR #26 is merged, record the new `main` SHA.
3. Merge the updated `main` into `feat/phase16-18-consolidation-20261116` using a normal
   merge commit, **not** a rebase.
4. Confirm the test-only patch on `emptyEnvironmentPanels.test.tsx` is neither duplicated nor
   lost: both branches currently hold blob
   `5a45093080c5d8fd5ef141508aab8460ff886a86`.
5. Review PR #25's full diff against the new `main`.
6. Re-run all applicable PR #25 checks on the resulting HEAD.
7. Conduct a separate independent review of PR #25 and obtain separate owner authorization.

No merge, approval, ready-for-review transition, or deployment was performed in this work.
