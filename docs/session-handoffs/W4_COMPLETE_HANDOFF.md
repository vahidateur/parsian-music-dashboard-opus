# W4 complete — repositories: handoff

**Read this first. W4 implementation is committed. W5 is NOT started.**

| | |
| --- | --- |
| Wave | W4 — repositories become the canonical local implementation |
| Branch | docs/demo-migration-plan (no backticks) |
| Parent / rollback | `6fed2a34b979384a2b94870559391d3a7d304315` |
| Implementation | `59929196888410483b320c6ee883eb8e8316c43a` |
| Evidence | `docs/migration/W4_REPOSITORY_MIGRATION_EVIDENCE.md` |
| Next wave | W5 — one composition, one build. Do not start it. D8 and B1/B2/B3 are still open. |

The docs commit that carries this file cannot quote its own SHA. After it is pushed, the tip is whatever `git ls-remote` returns for this branch.

## 1. What the wave delivered

The twenty repository classes are the local implementation. There is no `export class Demo*Repository` left.

```
Local*Repository     the class, one declaration each
localRepository.ts   seventeen domains
localAuthRepository.ts / localUserRepository.ts / localRoleRepository.ts
demo composition     registry.ts constructs the local classes
client composition   still Api* or unavailable — it does not import these modules
```

Logic was not rewritten. Before the commit, reverting the class-name and path tokens in each new module reproduced the parent blob. Zero mismatches.

## 2. Dispositions a fresh agent must not "fix"

1. Do not delete the four shims at `src/domains/{chat,classes,learning,progress}/demoRepository.ts`. They re-export `./localRepository` and declare no class. Recovery documents name those paths. Editing those documents was not authorized. Nothing should import the shims.

2. Do not rename `demoRepository.test.ts`. Three of those paths are named by the same documents. Vitest would collect a leftover test-file shim. The suites already construct the local classes. Assertions were not weakened.

3. Do not point `registry.client.ts` getters at the local classes. That is W5 and would put the local implementations in the client bundle. The import ban now covers both `demoRepository` and `localRepository`, and both auth module names. Do not delete the old names from that ban.

4. Do not rename `DEMO_SERVED_DOMAINS`, change its 11 members, or change the 12 unavailable ids. D8 is not decided.

5. Do not switch the runtime onto the dataset artifact, fetch it, or import the Node loader from production. B1 stays. The artifact hash is still `0f4c731ccb7ce26f30a2adca1b54e8a4f95980818cdab1b9072383fbd0b40b6f`.

6. Do not retime I19 or change `SEED_DATE`. The only full-suite failure is `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra `ses_cl2_20260929_1400`. Same line as the W3 baseline. The other id in that assertion is generated and changes between runs.

7. Do not rename keys, `DEMO_PASSPHRASE`, `listDemoAccounts`, `demo.manage`, or the `demoStore` / `demoCollection` shims. Domain READMEs still say `demoRepository.ts`. That prose is W9, not a defect to "correct" by editing governance docs.

## 3. Verification at the implementation commit

* Typecheck: all three configs passed.
* Full suite with the three build trees: 199 files, 2603 passed, 1 failed, 2 skipped.
* Baseline before edits, no `dist/`: 198 files, 2587 passed, 1 failed, 15 skipped.
* D9 remeasured, identical to baseline: bare `361039`, demo `361043`, client `306291`. Cap `361144` untouched. Entry `135154`. Headroom 105 B.
* Client bundle: no `ava:demo:dataset`, no `LocalStoreImpl`, no `LocalStudentRepository`.

## 4. Protected state

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP HEAD `eb973eb2758447eff16b60ab4fd4c267f9d85061`, tracked-diff `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f`. Do not write to that checkout.

## 5. Rollback

Revert `59929196888410483b320c6ee883eb8e8316c43a`. No key or env value moved, so revert is total. If a docs commit follows, revert that first, then the implementation.

## 6. Owner decisions still open

* D8 membership — required before W5. Not touched.
* Build strategy B1/B2/B3 — required before W5. B1 is in force.
* Demo credentials — before W7. Untouched.
* Optional `demo.manage` rename — still optional.

## 7. Next wave

**W5 — one composition, one build. NOT STARTED.**

It owns merging `registry.ts` and `registry.client.ts`, the six target pairs, `vite.config.ts`, the package scripts, the two tsconfigs, and the rewrite of `bundleBoundary`. It must not start until the owner decides D8 membership and B1/B2/B3.

W6, W7, W8, W9, and the eradication audit are also not started.
