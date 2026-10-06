---
inclusion: always
---

# 01 — CURRENT ARCHITECTURE (frontend)

> Describes what is true now, verified against `src/` and `docs/architecture/data-layer.md`.
> The legacy `01_ARCHITECTURE.md` (Blade components / `resources/views`) is **OBSOLETE**
> as frontend architecture and archived. Its durable *principles* (single responsibility,
> single layout owner, no business logic in presentation, layered primitives→semantic→component)
> are **ADAPTED** below to React.

## Boot chain (CURRENT)

`src/main.tsx` → `src/App.tsx`. `App` composes providers and the shell:
`AppProvider` → `AuthProvider` → branding/role/instrument sync → shell
(`Sidebar`, `TopBar`/`BottomNav`, `CommandPalette`, overlays) → `ViewOutlet`.
Runtime config is read via `getRuntimeConfig()` (`src/api/config.ts`).

## Layered data architecture (CURRENT — test-enforced)

```
View (src/views/*) → Domain hook (src/domains/<d>/use*) → Repository interface
                                   → registry picks impl → Local(demo) | Api(HTTP)
```

| Layer | Path | Must not |
|---|---|---|
| Transport | `src/api/client.ts` | know any domain |
| Errors | `src/api/errors.ts` | make per-view UI text decisions |
| Config | `src/api/config.ts` | expose a fake "production" mode |
| Domain contracts/impls | `src/domains/<domain>/` | speak HTTP in the interface |
| Composition (registry) | `src/domains/registry.ts`, `registry.client.ts`, `registryCore.ts` | contain business logic |
| Local/demo persistence | `src/services/demoStore.ts` | be imported by a view |

- **Composition roots (CURRENT):** `registry.ts` selects `Local*` (demo/local) vs `Api*`
  by mode; `registry.client.ts` is the API-oriented client build that contains **no demo
  capability** — unavailable domains resolve to an explicit `DOMAIN_UNAVAILABLE` repository
  (never demo data, never a speculative endpoint), disclosed via `UNAVAILABLE_DOMAINS`.
- **Local/demo vs API boundary (CURRENT):** demo/local is *implementation #1*, never deleted,
  **never silently selected in `api` mode** (`docs/engineering/DECISIONS.md` §1–§2, §25). The
  mode vocabulary is migrating to `local` with `demo` as an alias; storage keys `ava:demo:*`.
- **Entity identity (CURRENT):** one shared entity shape per domain (e.g. `Student` from
  `src/domains/students/types.ts`); ids are domain ids (`"st1"`), never URLs.

## ADAPTED principles (from legacy 01)

- **Single responsibility:** each component/hook/repository owns one concern.
- **Single Layout Owner:** page layout is owned by the shell/wrapper, not by leaf
  components (buttons, badges, chips) — React equivalent of the legacy rule.
- **No business logic in presentation:** presentational components receive data via props;
  logic lives in domain hooks/repositories, not in JSX. (Legacy "no logic in Blade".)
- **Layering:** primitive → semantic → component still holds, now for TS modules + CSS tokens.
- **Zero layout shift:** placeholders sized to final dimensions.

## Test-enforced boundaries (CURRENT — do not break)

`src/__tests__/architectureBoundaries.test.ts` fails the build if a view/component
touches `localStorage`, imports `demoStore`, calls `fetch(`, hardcodes an `http(s)://`
URL, references the removed `useAsyncView`, or imports `ACADEMY_NOW`. Client/demo
composition purity is additionally asserted by `registryClient.test.ts`,
`bundleBoundary.test.ts`, and `m10Boundary.test.ts`. Layering is a test, not a convention.
