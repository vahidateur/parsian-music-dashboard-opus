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

## Demo-only material must not leak

`isDemoMode()` gates every demo affordance. Two independent layers:

1. `listDemoAccounts()` returns `[]` outside demo mode.
2. The login screen renders no demo panel, passphrase or "بدون امنیت واقعی" banner.

Both are asserted in `src/views/__tests__/loginDemoIsolation.test.tsx`.

## What `api` mode does **not** yet give you

Selecting `api` today wires `ApiAuthRepository`, `ApiUserRepository` and
`ApiStudentRepository` to a backend that **does not exist**. There is no server,
no database and no deployed endpoint. `api` mode is an architectural seam that
is ready for a backend — not a working production configuration.

See `docs/production-handoff.md` for the blocker list.
