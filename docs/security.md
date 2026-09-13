# Security posture — private SaaS panel

This panel is not a public website. It must not be indexed, must not be
discoverable, and must not appear in any AI training corpus. This document
states what is implemented, what is enforced where, and — most importantly —
**what is not protected yet**.

Nothing here should be read as a claim that the application is secure. A
frontend cannot be secure on its own; the sections marked **BACKEND REQUIRED**
are load-bearing, not aspirational.

---

## 1. Keeping the panel out of indexes and datasets

Four layers, weakest to strongest.

| Layer | File | Strength |
|---|---|---|
| `<meta name="robots">` | `index.html` | Advisory. Crawler must fetch and parse the page. |
| `robots.txt` | `public/robots.txt` | Advisory. **Trivially ignored.** |
| `X-Robots-Tag` HTTP header | `deploy/nginx.conf`, `deploy/Caddyfile` | Strong for compliant crawlers — cannot be skipped like a file. |
| User-agent refusal at the edge | `deploy/*` | Enforcing, but spoofable. |
| **Authentication** | app + backend | **The only real control.** |

`robots.txt` names ~110 crawlers (AI training, AI search, conventional search,
SEO scrapers, archivers) and opens with a wildcard `Disallow: /` so an unlisted
crawler is still refused. It also carries the emerging `Content-Signal` and
`DisallowAITraining` opt-outs.

**Be clear-eyed about this:** several crawlers are documented as ignoring
`robots.txt` outright — Bytespider is the usual example, and Perplexity-User
states that it bypasses it. The reason the panel stays out of datasets is that
**there is nothing to crawl without credentials**, not that we asked politely.

The document also ships **no** Open Graph tags, **no** Twitter card, **no**
description, **no** canonical link and a neutral `<title>Panel</title>`. Those
exist to make a page quotable and shareable, which is the opposite of the goal.
`src/__tests__/privacyPosture.test.ts` fails the build if any of them return.

## 2. Secret access path

`VITE_ACCESS_PATH` gates the entire app above every provider
(`src/security/AccessGate.tsx`). Without the correct slug the visitor gets a
bare `404 Not Found` body — no branding, no Persian text, no form, no images,
no SVG, nothing to fingerprint.

Generate one with `npm run gen:access-path` (32 hex chars ≈ 128 bits). A slug
shorter than 24 characters is **rejected at startup** rather than silently
accepted, because a short slug looks protected and is not.

> ### This is obscurity, not security.
> A URL leaks through browser history, the `Referer` header, bookmark sync,
> corporate TLS inspection, and screenshots. It is a filter that removes
> opportunistic internet-wide scanners — which is genuinely valuable, since
> that is exactly how a private panel ends up in a "hosts running X" dataset —
> **but it is never a second factor and must never be counted as one.**

**The edge configs now enforce this too**, which matters more than the in-app
gate: the frontend gate still serves the JavaScript bundle to anyone who asks,
and **the slug is compiled into that bundle** by Vite (`import.meta.env` is
inlined at build time). Refusing at the edge means a wrong URL receives no
application code at all.

- **Caddy** interpolates `{$ACCESS_PATH}` from the environment.
- **nginx** cannot use a variable in a `location` prefix, so `deploy/nginx.conf`
  contains the literal placeholder `__ACCESS_PATH__`. Substitute it at deploy
  time (envsubst or your config tool) with the same value passed to the build.

The slug is also kept out of the access log (`access_log off` on that location):
a log file is exactly where a "secret" URL stops being secret.

## 3. HTTP security headers

Set in `deploy/nginx.conf` and `deploy/Caddyfile`, mirrored (minus HSTS) in the
Vite dev server so a CSP break is found in development, not after deploy.

| Header | Value | Purpose |
|---|---|---|
| `Content-Security-Policy` | `default-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'` | XSS / injection / clickjacking |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | TLS downgrade |
| `X-Content-Type-Options` | `nosniff` | MIME confusion |
| `X-Frame-Options` | `DENY` | Clickjacking (legacy backstop) |
| `Referrer-Policy` | `no-referrer` | **Stops the secret path leaking** |
| `Permissions-Policy` | camera, mic, geolocation, payment, USB … all `()` | Post-XSS capability reduction |
| `Cross-Origin-*-Policy` | `same-origin` / `require-corp` | Cross-origin isolation |
| `X-Robots-Tag` | `noindex, nofollow, noarchive, nosnippet` | Index refusal |

**Build architecture is a CSP decision.** The project deliberately does **not**
use `vite-plugin-singlefile`. That plugin inlines the whole application into a
nonce-less `<script type="module">`, which `script-src 'self'` blocks — an
earlier iteration shipped exactly that combination and would have white-screened
production. Vite now emits hashed external assets, which `'self'` permits
natively.

Rejected alternatives, and why:

| Option | Why not |
|---|---|
| Nonce | A static file server cannot generate a per-response nonce. A nonce baked into a static build is not a nonce. |
| SHA-256 hash in CSP | The hash changes every build while the CSP lives in a static nginx file; deploys would silently break. |
| `'unsafe-inline'` | Defeats the directive entirely. |

The single relaxation is **`style-src-attr 'unsafe-inline'`**, needed because
React compiles `style={{...}}` props into inline style *attributes*. That
directive covers attributes only — it cannot permit a `<style>` block and
cannot execute code. `script-src` and `style-src` are both clean.

**This is verified against the real artifact**, not asserted about a string:
`src/__tests__/cspCompatibility.test.ts` parses `dist/index.html` and the
emitted JS/CSS, and fails if an inline script appears, if a remote `url()`
sneaks into the CSS, if `new Function(` appears, if a source map ships, or if
`vite-plugin-singlefile` is reintroduced. It also asserts nginx and Caddy
enforce byte-identical policies.

**Dev vs production:** the dev server sends the same policy as
`Content-Security-Policy-Report-Only`. Report-only because Vite's HMR client
legitimately needs inline scripts that production does not ship — enforcing it
would break hot reload and train everyone to ignore the header. Violations
still surface in the console, and the build-artifact test is the binding check.

## 4. Authentication

### Password storage — NOT IMPLEMENTED IN THE FRONTEND

**There is no password hashing in this repository, by design.**

An earlier iteration shipped a browser-side PBKDF2 module. An audit found it
was never called by any production code path — the demo login is still a
plaintext comparison against a public constant — so it was **removed**. Unused
cryptography is worse than none: it reads like protection in a code review and
protects nothing at runtime.

Browser-side hashing is not password storage in any case:

- whoever steals the hash can replay it directly against the API, so the hash
  simply *becomes* the password;
- the client controls the iteration count and can lie about it;
- the browser cannot keep a pepper secret.

> **BACKEND REQUIRED.** Password hashing is a server responsibility:
> **Argon2id** (preferred) or bcrypt, with a server-held pepper, per-user salt,
> and a work factor tuned on production hardware. Nothing in this repository
> should be extended to approximate it.

### Password policy — BACKEND REQUIRED

Length floor (NIST SP 800-63B suggests 12+ characters and no composition
rules), a breached-password check against Have I Been Pwned's k-anonymity range
API, and rejection of context terms (the user's own email or name) all belong
on the server, at the point where a password is actually set. No public
password-setting flow exists in the frontend today — accounts are created by
staff (§6) — so there is nothing for a client-side policy to guard.

### Rate limiting — `src/security/loginThrottle.ts`

3 free attempts, then exponential backoff (2s → 4s → 8s → 16s, capped at 30s),
then a 15-minute lockout after 8 failures. State lives in `sessionStorage` so a
lockout does not outlive the browser session, and corrupt or tampered state
fails open to "allowed" — because it was never the real control.

> **This does nothing against an attacker.** A script POSTs to the API and never
> runs this code. It exists to blunt in-browser credential stuffing and to give
> a human an honest message. **The enforcing limit is `limit_req` at the edge
> (5/min on `/auth/login`) and per-account + per-IP limiting in the backend.**

### Sessions — `src/security/useIdleTimeout.ts`

20-minute idle timeout with a 2-minute warning, and a 10-hour absolute lifetime
that a page reload cannot extend. Shared across tabs via storage events. Both
clocks reset on sign-in so a new session never inherits the old one's remaining
lifetime.

> **BACKEND REQUIRED.** This signs the user out in the browser. The server must
> expire the session independently and reject the token afterwards, or an
> attacker holding a copied token is entirely unaffected.

## 5. What the demo mode is

`DemoAuthRepository` is **not authentication**. The passphrase is a public
string in the bundle, no password hash is stored, the token is a random string
with no cryptographic meaning, and session state in `localStorage` can be
edited to grant any role. This is acceptable **only** because demo mode has no
protected server-side data.

`src/views/__tests__/Login.test.tsx` asserts that in production mode the demo
banner, the passphrase and the sample accounts are **absent from the DOM
entirely** — not merely hidden. That test is verified to fail if the guard is
removed.

## 6. Registration is staff-only, by design

There is no public sign-up, no self-service password reset by email, and no
"create account" route. Students and teachers are created by an administrator
or receptionist inside the panel.

This removes a large attack surface (enumeration via signup, reset-token abuse,
automated account creation) and it must stay that way.

> **BACKEND REQUIRED.** Account creation must be an authenticated,
> role-restricted, audit-logged endpoint. Use `generateTemporaryPassword()` for
> the initial credential and force a change on first sign-in.

## 7. Data sensitivity

Two categories deserve care beyond ordinary PII:

- **National ID (کد ملی)** — already handled: normalised, checksum-validated,
  never in telemetry or URLs.
- **Student progress notes and practice history** — behavioural data, often
  about **minors**. Treat at the same sensitivity: never in logs, URLs or
  analytics; guardian access scoped to their own child; explicit retention.

`Referrer-Policy: no-referrer` and the "no identifiers in query strings" rule
exist for this reason. Never put a token or a national ID in a URL — it lands
in access logs, proxy logs and browser history.

## 8. Backend requirements — none of these are optional

1. **Argon2id/bcrypt** password hashing, server-side.
2. **Server-enforced authorization on every endpoint.** Client-side roles are
   UX only. Never trust a role, permission or ownership claim from the browser.
3. **Rate limiting** per account and per IP, with lockout and alerting.
4. **Session expiry and revocation** server-side; `HttpOnly`, `Secure`,
   `SameSite=Strict` cookies rather than `localStorage` tokens.
5. **CSRF protection** if cookie auth is used (double-submit or `SameSite`
   plus origin checking).
6. **Tenant isolation** — `organization_id` on every row and every query.
7. **IDOR prevention** — object ownership verified server-side; eligibility and
   visibility rules re-applied in the query, never trusted from the client.
8. **Append-only progress log** enforced by database grants, not app discipline.
9. **Audit logging** for sign-in, account creation, role change, export and
   deletion.
10. **Breached-password check** at set-password time.
11. **MFA (TOTP)** for admin accounts. Not implemented; recommended before
    handling real student data.
12. **Upload pipeline**: server MIME + magic-byte re-validation, AV scan, EXIF
    strip, served from a separate origin with `Content-Disposition: attachment`.
13. **Backups encrypted at rest**, restore tested, retention documented.

## 9. Honest status

| Control | Status |
|---|---|
| No-index meta, robots.txt, header configs | **IMPLEMENTED** — deployment-level, real |
| CSP compatible with the real build artifact | **IMPLEMENTED + VERIFIED** against `dist/` |
| Secret access path — in-app gate | **IMPLEMENTED** (obscurity only) |
| Secret access path — edge enforcement | **IMPLEMENTED** in configs; **not deployed by me** |
| Security headers (nginx + Caddy + dev report-only) | **IMPLEMENTED**, not deployed by me |
| Password hashing | **NOT IMPLEMENTED** — removed as dead code; backend responsibility |
| Login throttle / lockout | **DEMO/CLIENT ONLY** — bypass proven by test; backend required |
| Idle + absolute session timeout | **DEMO/CLIENT ONLY** — absolute clock now anchored to token expiry |
| Secure random for demo tokens | **IMPLEMENTED** — fails loudly, no `Math.random` downgrade |
| Demo/production credential isolation | **IMPLEMENTED**, regression-tested |
| Staff-only registration | **IMPLEMENTED** (no public signup exists) |
| Fixture data shown as real measurement | **REMOVED** — guarded by architectureBoundaries |
| MFA | **NOT IMPLEMENTED** |
| Server-side authz, tenant isolation, audit log | **BACKEND REQUIRED** |
| Penetration test | **NOT DONE** |
| Browser QA | **NOT VERIFIED** — no browser automation available in this environment |

## 10. Deployment checklist

- [ ] `npm run gen:access-path`, put the slug in `.env` (never commit it)
- [ ] Enforce that path at the edge as well as in the app
- [ ] **Substitute `__ACCESS_PATH__` in `deploy/nginx.conf`** (or set
      `ACCESS_PATH` for Caddy) with the SAME slug passed to the build
- [ ] Deploy `deploy/nginx.conf` or `deploy/Caddyfile`; adjust hostnames
- [ ] **Load the deployed page and confirm the console shows no CSP violation.**
      The build-artifact test proves the policy matches what the bundler emits;
      only a real browser proves the page renders.
- [ ] `curl -sI https://<host>/` and confirm every header from §3
- [ ] Grade on securityheaders.com and observatory.mozilla.org
- [ ] Confirm `https://<host>/robots.txt` returns the private policy
- [ ] Confirm a wrong path returns the bare 404
- [ ] Do **not** submit the domain to any search console
- [ ] Do **not** link to it from any public page — a backlink is how a
      "noindex" site gets discovered anyway
- [ ] Keep the hostname out of public DNS records beyond what TLS requires;
      consider a wildcard certificate so the name does not appear in
      Certificate Transparency logs
- [ ] Put it behind a WAF (Cloudflare bot rules) if the threat model warrants
- [ ] Restrict by IP allow-list or VPN if all staff are on known networks —
      this is stronger than everything in §2
