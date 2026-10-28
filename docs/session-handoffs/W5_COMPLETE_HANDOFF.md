# W5 complete — disclosure membership, B1 kept: handoff

**Read this first. W5, as authorized, is finished. W6 is NOT started.**

| | |
| --- | --- |
| Wave | W5 under the owner's selections: D8-A, B1, D9 cap unchanged |
| Branch | docs/demo-migration-plan (no backticks) |
| Parent / rollback | `8bd4981c0472d766d3196e1f354368a8413d6d0e` |
| Implementation | `500d30f151a637ddfd41e60d454210ef406ef908` |
| Evidence | `docs/migration/W5_COMPOSITION_EVIDENCE.md` |
| Next wave | W6 — control-flow vocabulary. Do not start it. |

The docs commit that carries this file cannot quote its own SHA. After it is pushed, the tip is whatever `git ls-remote` returns for this branch.

## 1. What this wave was

The written W5 target is one composition and one build. The owner did not select that. They selected B1, so the two builds stay. They selected D8-A, so organization is in the locally-served enumeration. They selected an unchanged D9 cap.

That is the whole wave. The one-artifact collapse was not done, and must not be "finished" from this handoff.

## 2. What landed

`DEMO_SERVED_DOMAINS` in `src/domains/registry.ts` now has 12 ids. Organization is between branding and gallery. The label is `قواعد آموزشگاه`, the same string `UNAVAILABLE_DOMAINS` already uses.

The organization getter was already `LocalOrganizationRepository` in both modes. It was not rewritten.

The api-mode notice renders that label because it reads the enumeration. It still renders only in api mode, still has no dismiss control, and still makes no server-health claim.

## 3. What a fresh agent must not "fix"

1. Do not merge `registry.ts` and `registry.client.ts`. B1 is in force. The client composition must not import a local repository.
2. Do not delete the six `*.client.*` target files, and do not collapse `vite.config.ts`, `package.json`, or the two tsconfigs.
3. Do not remove organization from `DEMO_SERVED_DOMAINS`. That was the owner's D8-A selection.
4. Do not remove organization from `UNAVAILABLE_DOMAINS`. The client build still does not serve it. The two lists are not one list. That unification was the one-build half of W5, which was not selected.
5. Do not raise the D9 cap `361144`. Headroom after this wave is 88 B on the bare build (361,056). Client stayed 306,291.
6. Do not fetch the dataset, bundle it, or import the Node loader from production. B2 was not selected.
7. Do not edit `docs/engineering/DECISIONS.md` to erase the seven-versus-eight drift. That drift was recorded and was not part of D8-A.
8. Do not retime I19 or change `SEED_DATE`. The only full-suite failure is `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra `ses_cl2_20260929_1400`.

## 4. Verification at the implementation commit

* Typecheck: all three configs passed.
* Full suite with the three build trees: 199 files, 2603 passed, 1 failed, 2 skipped.
* D9: bare 361,056 (+17), demo 361,055 (+12), client 306,291 (+0). Cap untouched. Entry 135,171.
* Client bundle: no `ava:demo:dataset`, no `LocalStudentRepository`, no `LocalOrganizationRepository`.
* Dataset hash unchanged: `0f4c731ccb7ce26f30a2adca1b54e8a4f95980818cdab1b9072383fbd0b40b6f`.

## 5. Protected state

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP HEAD `eb973eb2758447eff16b60ab4fd4c267f9d85061`, tracked-diff `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f`. Do not write to that checkout.

## 6. Rollback

Revert `500d30f151a637ddfd41e60d454210ef406ef908`, then any docs commit that follows it. The W4 tip `8bd4981c0472d766d3196e1f354368a8413d6d0e` is the rollback point. No key moved.

## 7. Next wave

**W6 — control flow and lifecycle vocabulary. NOT STARTED.**

It owns `VITE_DATA_SOURCE=demo` becoming `local` with the alias kept. Do not start it from this handoff. B1/B2/B3 was decided for this wave as B1. A later one-build choice is a new owner decision, not unfinished W5.
