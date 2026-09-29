# W6 delta complete — local mode alias: handoff

**Read this after `docs/session-handoffs/W6_COMPLETE_HANDOFF.md`. That handoff is still true for the lifecycle commit. This file records the later owner decision. Do not edit the earlier file to hide its "config was not authorized" line.**

| | |
| --- | --- |
| Wave | W6 delta: internal mode `local \| api`, `VITE_DATA_SOURCE=demo` alias, login lifecycle label |
| Branch | docs/demo-migration-plan (no backticks) |
| Parent / rollback of this delta | `934a6d62f2d6edc4b06ccb29de118679dc9b038a` |
| Implementation | `896fddd2531d7d72dc9c23f63b3a7657a5035ad7` |
| Evidence | `docs/migration/W6_LOCAL_MODE_EVIDENCE.md` |
| Next | Import/Reset is a later wave. Do not start it. Do not start W7. |

The docs commit that carries this file cannot quote its own SHA. After it is pushed, the tip is whatever `git ls-remote` or the GitHub branch API returns.

## 1. What landed

`DataSourceMode` is `local` or `api`. `VITE_DATA_SOURCE=demo` resolves to `local`. Unset still means `local` in the demo composition and `api` on client. Unknown still refuses boot. Production aliases still mean `api`.

The login sample heading is `دادهٔ نمونه — بدون امنیت واقعی`. The empty heading stays `دادهٔ محلی`. The credential toggle and `DEMO_PASSPHRASE` were not changed.

Lifecycle writes remain `sample`. Stored `demo` still reads as sample. The backup envelope is still `demo | empty`. Keys are still `ava:demo:*`.

## 2. Why no extra compatibility layer

Parent `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac` does not list `sample` as a lifecycle mode. Its reader returns null. Delivery then says `unproven`, not `customer`. Keeping `demo` as the canonical write was not required for rollback safety, and was not done.

## 3. What a fresh agent must not do

1. Do not treat item 3 of `W6_COMPLETE_HANDOFF.md` as still forbidding this alias. The later decision authorized it. Do not rewrite that handoff.
2. Do not start Import Demo / Reset, a marker-only reset, or W7.
3. Do not write `sample` into the backup envelope unless the validator and the locked-restore rejection move together.
4. Do not raise cap `361144`. Headroom after this delta is 21 B (bare `361123`). If a later measurement exceeds the cap, stop.
5. Do not retime I19 or change `SEED_DATE`.
6. Do not rename storage keys, `demo.manage`, or provenance owner `demo`.

## 4. Verification at the implementation commit

Three typechecks passed. Focused slice 113 passed. Full suite 2609 tests, 2605 passed, 2 failed, 2 skipped. The product failure is I19 at `schedulingWrites.test.tsx:1234`. A toast timeout in `emptyEnvironmentPanels.test.tsx` passed 10/10 when rerun alone.
