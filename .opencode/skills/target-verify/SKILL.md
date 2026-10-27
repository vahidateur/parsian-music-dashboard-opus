---
name: Target Verify
description: Verify a change against the correct composition - demo vs client - including the right typecheck profile, the right build and the bundle gates. Use before declaring a change done, after touching a target seam, or when the client build must stay free of demo code. Triggers - "build", "verify", "demo vs client", "bundle", "composition", "does the client build", "ship it".
---

# Target verify

A change can be green in the demo build and broken in the client build. Verify the
composition the change actually affects — and, for shared code, both.

## When to use

- Before declaring any change done.
- After touching `src/targets/*`, a composition root, or anything shared by both targets.
- When asked "is the client build clean?" or "did the bundle get bigger?".

## Minimum context to load

1. This skill.
2. `.opencode/specs/architecture-targets.md` — the boundaries and the gates.
3. `AGENTS.md` — the command list.

## Which checks apply

| What changed | Typecheck | Build | Gates |
|---|---|---|---|
| demo-only code | `npm run typecheck` | `npm run build:demo` | demo gates |
| client-only code | `npm run typecheck` | `npm run build:client` | `bundleBoundary` (client side) |
| shared code, a seam, a registry | **all three** profiles | **all three** builds | `bundleBoundary` + `bundleBudget` + `cspCompatibility` |
| copy/wording that differs per target | all three profiles | demo + client | `bundleBoundary` + `targetCopy` |

`npm run build` (bare → `dist/`) **empties `dist/`**, so run it **before** the composed
builds if you need `dist/demo` and `dist/client` side by side.

## Procedure

1. **Typecheck every profile the change can reach.**

   ```bash
   npm run typecheck                                # default (demo) profile
   npx tsc -p tsconfig.demo.json --noEmit
   npx tsc -p tsconfig.client.json --noEmit
   ```

2. **Build the affected target(s)** — `npm run build` · `npm run build:demo` ·
   `npm run build:client`.

3. **Run the bundle gates against the real output.**

   ```bash
   npx vitest run src/__tests__/bundleBoundary.test.ts \
                  src/__tests__/bundleBudget.test.ts \
                  src/__tests__/cspCompatibility.test.ts \
                  src/targets/__tests__/targetCopy.test.ts
   ```

   `bundleBoundary` reads `dist/client` and `dist/demo` — a missing artifact makes the case
   *skip*, so a green run with skips is not proof. Check which cases ran.

4. **Inspect the artifact, do not infer it.** For a wording or leak question, grep the
   built output:

   ```bash
   grep -ro "<the literal>" dist/demo | wc -l      # must be 0
   grep -ro "<the literal>" dist/client | wc -l     # must be > 0 when it is a disclosure
   ```

5. **Run the focused tests for the area you changed** (not the whole suite).

## Stop conditions

- A gate **skips** because its artifact is missing → build the target, then re-run.
- The demo bundle contains client-only wording, or the client bundle contains demo
  capability → that is a real defect: move the wording into the target seam
  (`@/targets/targetCopy`), one slot, two values. Do not add a runtime `if (demo)`.
- A typecheck profile fails → stop; a client-only error in a demo build is a real leak.

## Definition of done

- [ ] The affected typecheck profile(s) exit 0.
- [ ] The affected build(s) succeed.
- [ ] The bundle gates ran (not skipped) and pass.
- [ ] Any wording check was proven by grepping the artifact.
- [ ] Report names which target was verified and which was not.

## Output format

```
TARGETS    — which profiles and builds ran, and their results
GATES      — which gates ran vs skipped, and the pass/fail counts
ARTIFACT   — what was proven by inspecting the built output
LIMITS     — what was not verified (e.g. a target that was not built)
NEXT       — one concrete next action, or "none"
```
