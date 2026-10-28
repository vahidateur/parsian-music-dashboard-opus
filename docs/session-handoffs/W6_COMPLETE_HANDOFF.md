# W6 complete — sample is the lifecycle write: handoff

**Read this first. W6, as authorized, is finished. The Import/Reset wave is NOT started.**

| | |
| --- | --- |
| Wave | W6 under the owner's corrected authorization: sample canonical, demo read-alias, correctness consumers included |
| Branch | docs/demo-migration-plan (no backticks) |
| Parent / rollback | `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac` |
| Implementation | `bfddc30bce1288f25135f313758bf5fa3bb26949` |
| Evidence | `docs/migration/W6_LIFECYCLE_EVIDENCE.md` |
| Next | Import/Reset is a later wave. Do not start it from this handoff. |

The docs commit that carries this file cannot quote its own SHA. After it is pushed, the tip is whatever `git ls-remote` returns for this branch.

## 1. What this wave was

The owner did not authorize a Demo Mode switch, and did not authorize the full Import/Reset product flow. They authorized one coherent token migration: new lifecycle writes are `sample`; stored `demo` still reads as that kind; delivery and backup stay correct.

## 2. What landed

`LIFECYCLE_MODES` is `empty` and `sample`. The storage key is still `ava:demo:lifecycle`. A raw `demo` marker reads as `sample` and is not rewritten by a read. New initialization, adoption, `resetToSeed`, and `importSeed` write `sample`.

Delivery still classifies that kind as showcase ownership. The verdict token and the provenance owner token stay `demo`, because those stored contracts were not renamed. A sample environment stamps provenance owner `demo`, not `customer`. A locked restore still rejects envelope `demo`. The backup envelope was not given a `sample` value.

The recovery panel still says `محیط دمو` for a sample environment. It does not call that environment customer data.

## 3. What a fresh agent must not "fix"

1. Do not add Import Demo / Reset to Clean State from this handoff. That is a later wave. Reset must delete the dataset, not only flip a flag, and that behaviour was not built here.
2. Do not add a Demo Mode on/off switch.
3. Do not rename `VITE_DATA_SOURCE` in a follow-up that pretends it was unfinished W6. It was not in this authorization. Headroom after this wave is 28 B. If a later measurement exceeds `361144`, stop. Do not raise the cap.
4. Do not write `sample` into the backup envelope unless the validator and the locked-restore rejection are updated in the same change. Today the envelope token `demo` means showcase dataset.
5. Do not rename the provenance owner token `demo` without a read path for existing stamps. Delivery matches sample to that owner.
6. Do not remove organization from `DEMO_SERVED_DOMAINS`. D8-A stands. Do not collapse the two builds. B1 stands.
7. Do not edit `docs/engineering/DECISIONS.md` to erase historical wording.
8. Do not retime I19 or change `SEED_DATE`. The only product-suite failure is `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra `ses_cl2_20260929_1400`.

## 4. Verification at the implementation commit

* Typecheck: all three configs passed.
* Full suite with the three build trees: 2608 tests, 2603 passed, 3 failed, 2 skipped. Two failures were `projectState.test.ts` until the single-branch clone fetched `origin/main` and the preserved-branch objects; that file then passed 52/52. The other failure is I19.
* D9: bare 361,116 (+60), demo 361,112 (+57), client 306,291 (+0). Cap untouched. Entry 135,231. Headroom 28 B.

## 5. Protected state

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP HEAD `eb973eb2758447eff16b60ab4fd4c267f9d85061`. Do not write to that checkout.

## 6. Rollback

Revert `bfddc30bce1288f25135f313758bf5fa3bb26949`. The W5 tip `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac` is the rollback point. A marker already written as `sample` is not readable by that parent. Markers still stored as `demo` are readable by both.

## 7. Next

**Import/Reset and `VITE_DATA_SOURCE=local` are NOT STARTED.**
