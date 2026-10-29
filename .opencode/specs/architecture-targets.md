# Spec — Architecture & target boundaries

**Status:** CURRENT (re-verified 2026-10-29) · **Authority:** `src/` implementation + `src/__tests__/*` (tests are the
enforcement) · **Do not read** `docs/engineering/PROJECT_STATE.md` for this — it is for state,
not structure.

## The one structure that matters

```
View (src/views/*)  →  Domain hook (src/domains/<d>/use*)  →  Repository interface
                                        → composition root picks the implementation
                                                        → Local* (demo)  |  Api* (HTTP)
```

| Layer | Path | Must not |
|---|---|---|
| Transport | `src/api/client.ts` | know a domain |
| Errors | `src/api/errors.ts` | decide per-view UI text |
| Config | `src/api/config.ts` | fake a "production" mode |
| Domain contracts | `src/domains/<d>/` | speak HTTP in the interface |
| Composition roots | `src/domains/registry.ts` · `src/domains/registry.client.ts` · `src/domains/registryCore.ts` | hold business logic |
| Demo persistence | `src/services/demoStore.ts` | be imported by a view |

## Composition roots

- `src/domains/registry.ts` — the demo/local composition.
- `src/domains/registry.client.ts` — the client composition. It contains **no demo module at all**; a
  domain the server does not serve resolves to `createUnavailableRepository(...)`
  (`src/domains/shared/unavailableRepository.ts`), which fails with `DOMAIN_UNAVAILABLE`.
  The list of those domains is one enumeration: `UNAVAILABLE_DOMAINS`
  (`src/domains/shared/unavailableDomains.ts`). It is currently **empty** — every domain the
  client wires is served (see `api-capability-errors.md`). The demo composition still uses
  `createUnavailableRepository` for Finance.
- `src/domains/registryCore.ts` — shared plumbing (client, token, override seams, reset).
- The target file swap is a **file alias** in `vite.config.ts`, not a runtime flag: the
  bundler never resolves a demo target file in a client build.

## Target seam (the only place target-specific code may live)

`src/targets/environment.tsx` · `src/targets/targetCopy.ts` · `src/targets/targetFeatures.tsx` ·
`src/targets/commandShowcase.ts` · `src/targets/libraryProvisioning.ts` ·
`src/targets/galleryProvisioning.ts`, each with a `.client.*` twin.
The bundler aliases `@/targets/<name>` to the right twin; `tsconfig.demo.json` and
`tsconfig.client.json` mirror the same mapping for typecheck.

**Rule:** if two targets need different *wording*, it goes through `@/targets/targetCopy` —
one slot, two values. A literal from one variant hardcoded in a shared module leaks into the
other bundle. `.opencode/skills/target-verify/SKILL.md` and the gate
`src/targets/__tests__/targetCopy.test.ts` enforce it.

## Boundaries that are tests, not conventions

| Gate | What it fails on |
|---|---|
| `src/__tests__/architectureBoundaries.test.ts` | `localStorage`, `demoStore`, `fetch(`, hardcoded `http(s)://` in a view/component |
| `src/__tests__/bundleBoundary.test.ts` | demo capability in the client bundle; client-only wording in the demo bundle; a third build |
| `src/__tests__/bundleBudget.test.ts` | bundle-size budget drift |
| `src/__tests__/cspCompatibility.test.ts` | the artifact breaking the production CSP in `deploy/nginx.conf` |
| `src/__tests__/m10Boundary.test.ts` | the dissolved fixture boundary returning |
| `src/__tests__/namingGate.test.ts` | the `Demo*`-named production set changing |
| `src/domains/__tests__/registryClient.test.ts` | the client composition importing a demo module |

## Standing notes

- **Rooms are served and authorized.** DECISIONS §35 lifted PB-3 for Rooms: the ids
  `rooms.read` and `rooms.write` exist and `backend/app/Domain/Rooms/RoomPolicy.php` checks
  them through `PermissionGate`. PB-3 blocks no domain now (`auth-rbac.md`); the earlier
  "blocked for every actor" behaviour is historical.
- **No third build** — `dist/customer` and `dist/operator` are forbidden names and a test
  asserts they do not exist.
