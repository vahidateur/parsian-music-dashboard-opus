# W1 — THE DEMO → DATA DECISION BOUNDARY

> **Wave:** W1 of the migration plan (`DEMO_MIGRATION_WAVES.md`).
> **Nature:** documentation and governance **only**. No source file, test, build configuration, registry,
> RBAC semantic, D8 value, D9 value, backend artefact or runtime behaviour is changed by this wave.
> **Branch:** `docs/demo-migration-plan` · **Parent of this wave:** `main` @
> `15775ea9486cb57fbfb8fefa3268658cbe7eb669` (Phase 2A merge).
> **Recorded:** 2026-09-29, under the checkpoint authorization that authorizes **W1 and nothing else**.
> Companion records: `DEMO_MIGRATION_READINESS.md` (the four owner decisions), `DECISIONS.md` §25 (the
> register entry this document backs), and `W1_COMPLETE_HANDOFF.md` (the wave's verification record).

---

## 1. What this boundary is, and what it deliberately is not

**It is** the auditable decision boundary the discovery asked for: it fixes the migration's vocabulary,
records the four decisions that remain the owner's, ratifies the target architecture and the wave model as
the *working plan*, and states — explicitly — everything it does **not** change.

**It is not** an implementation. Nothing below takes effect in the product until its wave runs and is
separately authorized:

| Item | State after W1 |
| --- | --- |
| Source code (`src/**`) | **Untouched** — no file added, renamed, moved or edited |
| Tests | **Untouched** |
| Build configuration (`vite.config.ts`, `package.json`, `tsconfig.*.json`) | **Untouched** |
| Registry composition (`registry.ts`, `registry.client.ts`, `registryCore.ts`) | **Untouched** — byte-identical |
| `DEMO_SERVED_DOMAINS` (11) and `UNAVAILABLE_DOMAINS` (12) | **Untouched** — the 11-vs-12 question is **recorded, not decided** |
| D8 (decision record and behaviour) | **Unchanged** |
| D9 (cap `361144`, constants `343947/273791/361144/400000`, measured `361,037`, 107 B headroom) | **Unchanged** |
| RBAC semantics (`demo.manage`, 5 roles, 23 permissions, scope functions, T-02) | **Unchanged** |
| Backend / Laravel | **Not authorized, not touched** |
| I19 (protected scheduling area) and I22 | **Unchanged** |
| `main`, every landing/backup branch, tags, PR history | **Unchanged** |

## 2. Vocabulary decision — the canonical term is **local**

**Decision (recorded at W1, on this checkpoint's authorization).** The product's on-device implementation
is named **local**, not **demo**. "Demo" survives only where it names **data** (the shipped sample dataset
and its history) — never architecture, never a mode of the application.

| Concept | Today | Canonical (target) | Changes in |
| --- | --- | --- | --- |
| Data-source value | `VITE_DATA_SOURCE=demo` | `local` — **with `demo` kept as a working alias** | W6 |
| Composition selection | "demo composition" / "client composition" | **one** composition; a domain is either *served by the API* or *served locally* | W5 |
| Local persistence | `demoStore` / `DemoStoreImpl` | `localStore` typed by a canonical `LocalDataStore` interface | W3 |
| Domain implementation | `Demo<Domain>Repository` (20) | `Local<Domain>Repository` — **the same logic, renamed and re-framed** | W4 |
| Environment kind (persisted) | `uninitialized \| empty \| demo` | `uninitialized \| empty \| sample` — persisted legacy values must still be read | W6 |
| Enumeration | `DEMO_SERVED_DOMAINS` | the single composition's *locally served* enumeration | W5 (**after** the D8 decision, §3) |
| Dataset | "demo seed / demo dataset" | **sample dataset** (versioned, importable artifact) | W2 |
| Operator affordances | "remove demo", "demo data panel" | "remove local dataset", "data panel" | W7 |
| User-facing Persian copy | mixed, incl. «دمو» | «دادهٔ نمونه» for the dataset; the product is never described as a demo application | W6/W9 |
| Permission id | `demo.manage` | **unchanged** — renaming RBAC ids is an owner decision (§6) | — |

### 2.1 Compatibility register — what MUST NOT be renamed without an alias

These are runtime or governance contracts. Renaming any of them without a read-both/migrate path is a
deployment or history break, and a wave that proposes it must be rejected or shimmed:

1. **Environment value `demo`** — `VITE_DATA_SOURCE=demo` must keep working forever as an alias once `local`
   becomes canonical (W6). The config-error behaviour for invalid values is unchanged.
2. **Storage keys** — `ava:demo:dataset`, `ava:demo:lifecycle` (and the `ava:demo:` prefix), plus the
   dataset credentials/session keys and `ava:delivery:state` / `ava:delivery:pending`. Keys are **not**
   renamed in W3; a key change is a compatibility decision, not a cleanup.
3. **Persisted lifecycle values** — `empty` / `demo` markers written by earlier builds must keep being read.
4. **Permission id `demo.manage`** — referenced by the RBAC matrix (`A-01`, `X-07`) and by provider code;
   renaming requires an explicit owner decision.
5. **Historical documents and records** — `docs/architecture/demo-data.md` keeps its path and H1 until the
   naming wave (W9); `docs/engineering/F*_REPORT.md`, handoffs and audit reports are historical records and
   are never retro-edited to match new vocabulary.
6. **The shipped sample dataset's own identity** — `SEED_VERSION` and `SEED_DATE` are data contracts
   (tests pin them; **I19** depends on the date). They are not renamed by any wave.

## 3. D8 / Organization — preserved, not resolved

**Recorded, unchanged.** This boundary does **not** touch D8's decision text, its enumeration, or the
organization getter. The exact state at W1, for the next reader:

| Fact | Value |
| --- | --- |
| Getters resolving Demo in **both** modes | **12** (instruments, learning, chat, media, library, branding, **organization**, gallery, progress, scheduling, attendance, compensation) |
| `DEMO_SERVED_DOMAINS` (`registry.ts`) | **11** — organization absent |
| `UNAVAILABLE_DOMAINS` (client mirror) | **12** — organization present |
| D8 record says "seven getters switch on `isApiMode()`" | code has **eight** — a recorded documentation drift |
| Status | **PENDING OWNER DECISION** — must be settled **before W5**, or the unified enumeration inherits the discrepancy |

No governance exception is created, and no behaviour changes: the getter and both lists remain
byte-identical to `main`.

## 4. Build strategy — recorded exactly as planned, decision PENDING

The three options are recorded verbatim from `DEMO_TO_DATA_TARGET_ARCHITECTURE.md` §11. **No strategy is
chosen here**; the decision is the owner's, and **B1 remains in force** until it is made.

| Option | Effect | D9 consequence |
| --- | --- | --- |
| **B1 (today)** two builds: `demo` (everything) and `client` (no demo at all) | clearest boundary, two artifacts | client 78 kB entry / demo 135 kB entry; total measured **361,037 / 361,144** |
| **B2 (candidate)** one build, local implementation included, dataset **lazy-loaded** | one application; sample data fetched on demand; no hidden fallback | needs measurement; the static part grows by the local repositories (≈4.3 k lines) |
| **B3** one build with everything eager | simplest to reason about | almost certainly exceeds the 107 B headroom → owner re-baseline or splitting required |

Constraints that bind whichever option is chosen: the local implementation is selected **explicitly** by
configuration (never silently in api mode — the §37 no-dishonest-fallback rule), the api-mode disclosure
continues to name locally-backed domains until the backend serves them, and the D9 cap constant is **never**
moved as a convenience.

## 5. Demo credentials — classification recorded, change PENDING

**Classification: DEMO DATA (Class A).** The dataset's sign-in material (`src/domains/auth/demoCredentials.ts`
plus the seeded users/roles) is **data**, and it is **retained**: it is what makes the sample dataset usable
out of the box. It is already capability-gated (deployment lock; login throttle; `demo.manage`), and those
gates are the mechanism that must survive any rename.

**No deletion, no migration, no renaming** happens at W1 or without an explicit decision. Whether the shipped
dataset keeps usable sign-in material at all is a **pending owner decision** (the first-run story depends on
it).

## 6. Owner decision register introduced by W1

Four decisions are explicitly *not* made here; each is recorded with its deadline:

| # | Decision | Deadline | Status |
| --- | --- | --- | --- |
| 1 | **D8 membership** — 11 vs 12 (organization) and the unified enumeration's content | before **W5** | **PENDING** |
| 2 | **Build strategy** — B1 / B2 / B3 | before **W5** | **PENDING** |
| 3 | **Environment vocabulary** — `local` canonical + `demo` alias (the vocabulary itself is decided; the *runtime* change is not) | execute at **W6** | vocabulary **DECIDED**, execution pending wave authorization |
| 4 | **Demo credentials** — keep usable sign-in material in the shipped dataset? | before **W7** | **PENDING** |

Two further items are recorded as decisions but **not** part of this boundary's authority: renaming the
`demo.manage` permission, and retitling historical documents (the latter is W9 vocabulary work).

## 7. Ratification of the working plan

**The target architecture and the W1–W10 wave model are ratified as the working migration plan** — by the
owner authorization carried by this checkpoint. Ratification means: these documents are the plan of record,
waves run **one at a time**, and each wave still requires its own authorization and its own verification.

Wave status at W1:

| Wave | Status |
| --- | --- |
| W1 (this wave) | **EXECUTED — docs only** |
| W2 dataset extraction · W3 store/plumbing · W4 repositories · W5 one composition/build · W6 control flow · W7 delivery/UI · W8 tests/gates · W9 naming · W10 eradication audit | **NOT AUTHORIZED** — each starts only on an explicit authorization |

The plan's own gates are unchanged: no test may be weakened to make a wave pass; the D9 cap is never raised;
T-02 stays do-not-revisit; the backend stays unauthorized; the protected scheduling area (I19) is untouched.

## 8. What this wave changed (audit of W1 itself)

| File | Change |
| --- | --- |
| `docs/migration/W1_DECISION_BOUNDARY.md` | **new** — this document |
| `docs/engineering/DECISIONS.md` | **appended §25** (register entry; the D8/D9/D-number sections are untouched) |
| `docs/architecture/data-layer.md` | **dated note added** under "Why the DemoStore stays"; the historical paragraph is preserved verbatim |
| `docs/architecture/demo-data.md` | **dated framing note added** under the H1; the body is preserved verbatim (retitle deferred to W9) |
| `docs/session-handoffs/W1_COMPLETE_HANDOFF.md` | **new** — the wave's verification record |

Nothing else. The wave's own verification (diff scope, gates run, protected-state checks) is recorded in the
handoff, not asserted here.

## 9. Rollback

The **parent commit of this wave** — `git revert` of the W1 commits restores every sentence. Because W1
touches no code, configuration, test or runtime artefact, the rollback is total and its blast radius is
documentation only. The branch is never merged into `main` by this wave.
