# Environments & data sources

Arena has two first-class runtime environments sharing one UI and one set of
domain contracts. Demo is a supported showcase adapter, not disposable mock code.

```
VITE_DATA_SOURCE  →  resolveConfig()  →  registry.ts  →  Demo*Repository | Api*Repository
```

## Accepted values

| `VITE_DATA_SOURCE` | Mode | Notes |
|---|---|---|
| *(unset / empty)* | `demo` | Developer convenience. Nobody who set nothing believes they configured production. |
| `demo` | `demo` | Explicit showcase mode. |
| `api`, `production`, `prod`, `live`, `real`, `staging`, `stage` | `api` | All mean "use the real backend". Staging is not a separate data source — it is the API with a different base URL. |
| anything else | **boot error** | The app refuses to start. |

## The no-silent-fallback rule

Before this phase, `VITE_DATA_SOURCE=production` resolved to **demo mode**:
a typo or a plausible-but-unsupported value silently served fabricated
localStorage records to someone who believed they had configured a real backend.
That was the single most dangerous defect in the codebase.

Now:

- Production-intent aliases resolve to `api`, never demo.
- An unrecognised value sets `RuntimeConfig.error`, and `ConfigGate` in
  `src/App.tsx` renders only that error — no shell, no data, no login.

Covered by `src/api/__tests__/config.test.ts`. The earlier suite asserted the
buggy behaviour was correct; it has been inverted.

## Two independent axes — do not conflate them

"Demo" means two different things in this codebase, and confusing them is a bug
source:

| Question | Answered by | Persisted where | Values |
|---|---|---|---|
| **Where does data come from?** | `isDemoMode()` (`src/api/config.ts`) | `VITE_DATA_SOURCE`, resolved at boot | `demo` \| `api` |
| **What kind of local environment is this?** | `readLifecycleState()` / `isDemoEnvironment()` (`src/domains/demo/lifecycle.ts`) | `ava:demo:lifecycle` in localStorage | `uninitialized` \| `empty` \| `demo` |

The first is a *build/configuration* fact; the second is a *persisted runtime*
fact about the visitor's own browser. A demo-mode app can be running a customer's
EMPTY environment, and an api-mode app has no local environment at all.

Demo-only affordances therefore require **both**: `isDemoEnvironment()` is
`isDemoMode() && state === "demo"`. That is why the demo library file, `DemoNote`
and the demo labelling in the Settings data panel all go through it rather than
through `isDemoMode()` alone — in an EMPTY environment the records on screen are
the customer's own, and labelling them demo data is the same dishonesty in the
opposite direction. See `docs/architecture/demo-data.md` for the lifecycle model.

## Demo-only material must not leak

Two independent axes, not one gate (see the table above):

1. **Data-source axis** — `listDemoAccounts()` returns `[]` outside demo mode, and an api-mode build
   offers no demo credential panel. Asserted by
   `src/views/__tests__/loginDemoIsolation.test.tsx`, which runs in api mode.
2. **Lifecycle axis** — in the demo composition the login screen **does** render the demo panel in an
   EMPTY environment, because that environment is signable-in and has no other way in. Its *wording*
   comes from `useIsDemoEnvironment()`, so it never calls the customer's own data "demo data" (H3).

The earlier claim that `isDemoMode()` alone gates every affordance was wrong; this section now states
the two-axis rule the table above already describes.

## What `api` mode does **not** yet give you

Selecting `api` today wires `ApiAuthRepository`, `ApiUserRepository` and
`ApiStudentRepository` to a backend that **does not exist**. There is no server,
no database and no deployed endpoint. `api` mode is an architectural seam that
is ready for a backend — not a working production configuration.

See `docs/production-handoff.md` for the blocker list.
