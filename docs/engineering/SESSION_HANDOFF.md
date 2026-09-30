# SESSION HANDOFF

> **LIVE POINTER — 2026-09-30, Phase B frontend completion, partial.** This supersedes the history-cleanup pointer below as the work order. It does not delete that pointer, and it does not delete any SHA in this file.
>
> ```text
> CURRENT CLEAN BRANCH:
> cleanup/demo-migration-lineage
>
> CURRENT HEAD:
> the commit whose parent is this documentation commit and whose subject is
> docs(engineering): stamp the Phase B tip
> This documentation commit cannot name itself. The stamp commit cannot name itself either.
> Read the tip with: git ls-remote origin refs/heads/cleanup/demo-migration-lineage
> Match parent and subject. Do not rewind to 33fc214 or to 689de032.
>
> PARENT OF THE STAMP:
> this documentation commit, once the stamp exists
>
> MAIN:
> 15775ea9486cb57fbfb8fefa3268658cbe7eb669
> UNTOUCHED. Do not merge.
>
> OLD MIGRATION BRANCH:
> docs/demo-migration-plan
> 1b233362ef391e4b8f31df9e48c56b3687e36222
> DO NOT MERGE
>
> PROTECTED WIP:
> arena/01a0e8ec-parsian-music-dashboard-opus
> local only, HEAD eb973eb2758447eff16b60ab4fd4c267f9d85061
> Do not push, reset, or clean it.
>
> BACKEND:
> NOT STARTED
>
> TELEGRAM:
> NOT STARTED
>
> PUSH:
> NOT STARTED
>
> CURRENT PHASE:
> Phase B — PARTIAL, not complete
>
> NEXT PHASE:
> Owner decisions PB-1 through PB-5 in OPEN_ITEMS.md.
> Do not implement those decisions.
> Do not start backend, Telegram, or push.
> Do not merge to main.
> ```
>
> Phase B commits already on this branch, parents of this documentation commit:
> - `5e5fa35af30070fa08b1ad6004f2ab29dffc27b0` — gate writes the matrix already names
> - `88fee2665434647f81b05b0f1560270ab56b86e3` — tests for those gates
>
> Completed in those commits, and only that:
> - `finance.write` hides «ثبت پرداخت» on the deferred finance view
> - `messages.write` hides send, create, templates, and conversation management
> - `settings.write` hides branding edit and save
> - `library.write` hides gallery panel writes
> - settings export uses the session permission holder (I22 frontend half)
> - student import is hidden without `students.write`
> - T-02 comment in `src/domains/auth/scope.ts` now says ACCEPTED / ASSIGNED-ONLY
>
> Not completed, and not chosen:
> - PB-1 teacher with no `teacherId`
> - PB-2 privileged account identity, including current-password proof
> - PB-3 room, instrument, learning, and progress write permission
> - PB-4 `useCan(...) || !user`
> - PB-5 notifications domain versus later delivery
> - student portal UI (D1: no student role in this panel)
> - `organization_id` on the session (not added)
>
> Known failure, not touched: I19 `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra id `ses_cl2_20260929_1400`.
>
> Gap matrix: [PHASE_B_FRONTEND_GAP_MATRIX.md](PHASE_B_FRONTEND_GAP_MATRIX.md).
> Owner decisions: [OPEN_ITEMS.md](OPEN_ITEMS.md) PB-1..PB-5.
> Chat / Telegram / notifications / push boundary, no new paths: [../frontend-completion/10-integration-architecture.md](../frontend-completion/10-integration-architecture.md) Phase B boundary.
>
> Protected refs must remain `main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`, `backup/pre-f2-2026-09-29` `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`, archive tag `eb973eb2758447eff16b60ab4fd4c267f9d85061`.
> Two compositions only. Registry paths remain `src/domains/registry.ts`, `src/domains/registry.client.ts`, and `src/domains/registryCore.ts`.
> `PROJECT_STATE.md` was not rewritten. Its tests pin an older checkpoint. This pointer is the live Phase B record.
>
> History-cleanup tip before Phase B: `33fc21443e0c11a83f2039dd5152130fa1dbcab2`, parent `0b5b38f771cc3f82afe9c46883ef5372dcd701ce`, subject `docs(engineering): stamp the cleaned tip SHA`. That commit remains an ancestor. Do not reset to it.

> **HISTORY-CLEANUP POINTER — 2026-09-30, choice B executed on this branch.** Kept verbatim below this heading. It is not the live work order.
> Owner decision B is done **only** on `cleanup/demo-migration-lineage`. `main` has **not** moved.
> `docs/demo-migration-plan` remains the uncleaned lineage and must not be force-updated.
> W7A, W7B, W8, W9, and W10 are **closed**. Do **not** re-run them. Do **not** start backend, Telegram, or push work from this file.
> Do **not** merge this branch to `main` until a separate owner authorization.
>
> **Cleanup checklist**
> 1. Current cleaned tip is the commit that contains this checklist and whose parent is `0b5b38f771cc3f82afe9c46883ef5372dcd701ce`. Subject: `docs(engineering): stamp the cleaned tip SHA`. That parent is the handoff correction. Its own SHA cannot be stored inside itself.
> 2. Previous tip: `1b233362ef391e4b8f31df9e48c56b3687e36222` on `docs/demo-migration-plan`. That ref was not force-updated.
> 3. Old→new mapping is §4. No squash.
> 4. Removed from this lineage only: `1eb6366d0482c55845e5239ed20a9b44a4e6f68b`, `10c815412f4e951b8f05323de4e50927f116ab05`, `22cbd26f17009bdd695cf6900d07f743806f2030`. No other lineage was removed.
> 5. Protected refs must remain `main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`, `backup/pre-f2-2026-09-29` `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`, archive tag `eb973eb2758447eff16b60ab4fd4c267f9d85061`. WIP was not touched.
> 6. W7A–W10 evidence remains reachable. See §7.
> 7. Two compositions only. Registry paths are `src/domains/registry.ts`, `src/domains/registry.client.ts`, and `src/domains/registryCore.ts`. Not `src/app/`.
> 8. Frontend/API readiness is §10. No server exists in this repository.
> 9. Backend implementation has NOT started.
> 10. The next authorized phase is separate from this history cleanup. Do not merge to `main`. Do not start backend. Migration and product completion are NOT proven.
>
> Sibling historical records, still present and not deleted:
> [PROJECT_STATE.md](PROJECT_STATE.md) · [PHASES.md](PHASES.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md) · [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) ·
> [PRE_CLEANUP_HANDOFF.md](PRE_CLEANUP_HANDOFF.md) ·
> [../session-handoffs/DEMO_MIGRATION_CONTINUATION_HANDOFF.md](../session-handoffs/DEMO_MIGRATION_CONTINUATION_HANDOFF.md) ·
> [../migration/W10_ERADICATION_AUDIT.md](../migration/W10_ERADICATION_AUDIT.md)
>
> The body below this live pointer, beginning at “HISTORICAL BODY”, is the previous text of this file.
> Its SHAs are preserved on purpose. None of that body is a live work order. In particular, do **not**
> merge PR #16 or PR #18, do **not** treat `6ca25be` as HEAD, and do **not** start F2 from that body.

**Recorded:** 2026-09-30 · **Nature:** documentation-only recovery checkpoint. Choice B replayed
the migration lineage onto `039b9c82` and dropped only the net-zero dead-end. It does not merge
to `main` and does not authorize backend implementation.

**Rule this file exists to enforce:** Git cleanup without this handoff is unsafe. A later rewrite
must update this same file with the complete old-SHA → new-SHA mapping before anyone may declare
cleanup complete. Old SHAs in this file must not be deleted.

---

## SESSION RECOVERY

```text
Current branch:     cleanup/demo-migration-lineage
Pre-cleanup tip:    1b233362ef391e4b8f31df9e48c56b3687e36222 on docs/demo-migration-plan
                    that ref is preserved and was not force-updated
Replay base:        039b9c827d54aabbec9e90557c3efb49eb37678a
                    tree 4afa9351d3b797e8a4444609c9ab50bd37051ec3
                    identical to 22cbd26f17009bdd695cf6900d07f743806f2030^{tree}
Pre-handoff tree:   a89fa7324a9fcab7f8c8477db05abfea11698663
                    tree afba3b8e48f4668459b2b0930522590dcc23a756
                    old equivalent 13599bbfc4fdce42de975ef28d104a8264bf88bf
Rewritten handoff:  98842129c75e5f8e5ecd128f8276e6c8e1f5e1b5
                    old ca8afba365e375a9c150fef5441f200f3e9f9dc4
                    same tree f5198ed4655af85b8ac4884bda4d491ef0c8743f
SHA-record replay:  f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8
                    old 1b233362ef391e4b8f31df9e48c56b3687e36222
                    same tree d15d1ce02a1472e88664ba98eca5ece22b4fbb3e
Mapping tip:        689de032b658a2eebf50a2b54d184d855336f54d
                    parent f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8
                    subject: docs(engineering): record the cleaned-history mapping
Handoff correction: 0b5b38f771cc3f82afe9c46883ef5372dcd701ce
                    parent 689de032b658a2eebf50a2b54d184d855336f54d
                    subject: docs(engineering): record the cleaned tip SHA
Current cleaned tip: this stamp commit
                    parent must be 0b5b38f771cc3f82afe9c46883ef5372dcd701ce
                    subject: docs(engineering): stamp the cleaned tip SHA
Remote check:       git ls-remote origin refs/heads/cleanup/demo-migration-lineage
Main:               15775ea9486cb57fbfb8fefa3268658cbe7eb669
                    UNTOUCHED. Do not merge yet.
Backup:             backup/pre-f2-2026-09-29 @ 62deb84dfbbd9d7ad27002196569d0c7ef4c87f6
Archive:            archive/gallery-library-storage-eb973eb @ eb973eb2758447eff16b60ab4fd4c267f9d85061
                    archive/frontend-session-handoff-94d32de @ 94d32de3220cee314606c0c4705e20e0fdcfb2af
                    archive/palette-focus-251af96 @ 251af96f405df5935ee17ddc9ba6b490f7989c2d
                    archive/mountain-sanctuary-bb275d6 @ bb275d6c8063a3ca34eb3a24c0539e43ea991182
                    archive/premium-academy-login-afe6b02 @ afe6b0278c7aed447552eec76ee2caf0f6a7e616
                    archive/project-state-gate-7180082 @ 7180082fac85f4451ac8e7d2ed1312a26bcfb486

Last completed operation:
  Owner decision B. Rebase --onto 039b9c82 22cbd26 on a new branch only.
  Eleven commits replayed. Each replayed tree SHA equals the old commit's tree SHA.
  The three rejected commits are not ancestors of this branch.

Last verified operation:
  039b9c82^{tree} == 22cbd26^{tree} == 4afa9351d3b797e8a4444609c9ab50bd37051ec3
  a89fa732^{tree} == 13599bb^{tree} == afba3b8e48f4668459b2b0930522590dcc23a756
  git diff 13599bb a89fa732 is empty.
  Dead-end SHAs are not ancestors of this HEAD.
  They remain ancestors of local docs/demo-migration-plan at 1b23336.

Pending operation:
  None on this branch. Do not merge to main. Do not start backend.

Safe to continue from:
  cleanup/demo-migration-lineage after ls-remote matches the tip predicate above.
  Do not continue from docs/demo-migration-plan if the task is the cleaned lineage.
  Do not continue from the historical body below.

Do NOT repeat:
  W7A, W7B, W8, W9, W10.
  The rejected three-artifact attempt or its revert.
  This rebase.

Do NOT modify:
  main, backup/pre-f2-2026-09-29, any archive tag, docs/demo-migration-plan.
  The protected dirty WIP at /home/user/parsian-music-dashboard-opus
    branch arena/01a0e8ec-parsian-music-dashboard-opus
    HEAD eb973eb2758447eff16b60ab4fd4c267f9d85061
  APP_TARGET, vite.config.ts, the two registries, the D9 cap, SEED_DATE,
  SEED_VERSION, ava:demo: keys, schedulingWrites.test.tsx.

Next exact step:
  Stop. Do not merge to main. Wait for a separate owner authorization before any merge.
```

The pre-cleanup handoff content remains `ca8afba365e375a9c150fef5441f200f3e9f9dc4` on `docs/demo-migration-plan`, rewritten here as `98842129c75e5f8e5ecd128f8276e6c8e1f5e1b5` with the same tree `f5198ed4655af85b8ac4884bda4d491ef0c8743f`. Its SHA-record child is rewritten as `f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8`. Neither text was dropped. The mapping commit is `689de032b658a2eebf50a2b54d184d855336f54d`. The current cleaned tip is its child.

---

## 1. Current remote refs

The table below is the pre-cleanup verification. After this commit is pushed, the cleaned ref is `cleanup/demo-migration-lineage`. `main`, backup, archive tags, and `docs/demo-migration-plan` must still match the protected values below. Re-verify with `git ls-remote` before any later action.

| Ref | SHA at verification | Role |
| --- | --- | --- |
| `main` | `15775ea9486cb57fbfb8fefa3268658cbe7eb669` | Untouched. Tree `6eb78338ec19880adf5f97735f61de32e11cbf20`. |
| `docs/demo-migration-plan` | `13599bbfc4fdce42de975ef28d104a8264bf88bf` | Pre-handoff tip. This commit's parent. |
| `backup/pre-f2-2026-09-29` | `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6` | Backup. Do not move. |
| `archive/gallery-library-storage-eb973eb` | `eb973eb2758447eff16b60ab4fd4c267f9d85061` | Archive tag. Do not move. |
| `archive/frontend-session-handoff-94d32de` | `94d32de3220cee314606c0c4705e20e0fdcfb2af` | Archive tag. Do not move. |
| `archive/palette-focus-251af96` | `251af96f405df5935ee17ddc9ba6b490f7989c2d` | Archive tag. Also an `arena/` branch tip. Do not move. |
| `archive/mountain-sanctuary-bb275d6` | `bb275d6c8063a3ca34eb3a24c0539e43ea991182` | Archive tag. Do not move. |
| `archive/premium-academy-login-afe6b02` | `afe6b0278c7aed447552eec76ee2caf0f6a7e616` | Archive tag. Do not move. |
| `archive/project-state-gate-7180082` | `7180082fac85f4451ac8e7d2ed1312a26bcfb486` | Archive tag. Do not move. |

Other `arena/*` branches exist on the remote. They are not the migration line and are not backup.
The protected WIP branch `arena/01a0e8ec-parsian-music-dashboard-opus` was local-only at verification
and must not be pushed, reset, or cleaned.

`docs/demo-migration-plan` at `13599bb` was 32 commits ahead of `main` and 0 behind. A fast-forward
of `main` was possible and was **not** performed.

## 2. Exact pre-cleanup HEAD

`13599bbfc4fdce42de975ef28d104a8264bf88bf`

| Field | Value |
| --- | --- |
| Subject | `docs(migration): W10 eradication audit` |
| Parent | `c783bec7ae334e30e9b557f6b331ac5a1d9ed556` |
| Tree | `afba3b8e48f4668459b2b0930522590dcc23a756` |

This is the pre-cleanup tip. Any later cleaned history must preserve this tree, then add this
handoff. The tree that must be preserved through a rewrite of the 32 commits is `afba3b8e`. The
tree of the branch after this handoff commit is that tree plus this documentation change only.

## 3. Exact post-cleanup HEAD

Choice B is executed on `cleanup/demo-migration-lineage` only.

| Role | SHA |
| --- | --- |
| Pre-handoff cleaned commit | `a89fa7324a9fcab7f8c8477db05abfea11698663` |
| Pre-handoff tree | `afba3b8e48f4668459b2b0930522590dcc23a756` |
| Rewritten handoff content | `98842129c75e5f8e5ecd128f8276e6c8e1f5e1b5` |
| Rewritten SHA-record | `f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8` |
| Mapping tip | `689de032b658a2eebf50a2b54d184d855336f54d` |
| Handoff correction | `0b5b38f771cc3f82afe9c46883ef5372dcd701ce` |
| Current cleaned tip | this stamp commit; parent `0b5b38f771cc3f82afe9c46883ef5372dcd701ce`; subject `docs(engineering): stamp the cleaned tip SHA` |

`main` is not the post-cleanup HEAD. It is still `15775ea9486cb57fbfb8fefa3268658cbe7eb669`.
`docs/demo-migration-plan` is not the post-cleanup HEAD. It remains the uncleaned lineage.

## 4. Complete commit mapping

Executed on `cleanup/demo-migration-lineage` by `git rebase --onto 039b9c827d54aabbec9e90557c3efb49eb37678a 22cbd26f17009bdd695cf6900d07f743806f2030`. No squash was performed. Unchanged commits keep the same SHA. Rewritten commits keep the same tree SHA as the old commit. Old SHAs below are not deleted from this file, and the three removed commits remain reachable from `docs/demo-migration-plan` at `1b233362ef391e4b8f31df9e48c56b3687e36222`.

| Old SHA | Purpose | Fate on this branch | New SHA |
| --- | --- | --- | --- |
| `85345c932c4ac510b1e74c9e16fa329c4c7f82cd` | W1 discovery plan | unchanged ancestor | `85345c932c4ac510b1e74c9e16fa329c4c7f82cd` |
| `379076f63915e46f34e73236041bd95725ffefa8` | W1 decision boundary | unchanged ancestor | `379076f63915e46f34e73236041bd95725ffefa8` |
| `c5ba4a96e554bf59d8d7fde2695f6cede350efa2` | W1 handoff and document-reference fix | unchanged ancestor | `c5ba4a96e554bf59d8d7fde2695f6cede350efa2` |
| `bab9e460b603f9499a9b0735050e1cb729384602` | W1 remote-verification note | unchanged ancestor; not squashed | `bab9e460b603f9499a9b0735050e1cb729384602` |
| `25b432a4f3ed5c7cb924878477fceaf93b54fa85` | W2 dataset extraction | unchanged ancestor | `25b432a4f3ed5c7cb924878477fceaf93b54fa85` |
| `d954ba95c4299d5df852cfd398a2c0cb1f805987` | W2 evidence | unchanged ancestor | `d954ba95c4299d5df852cfd398a2c0cb1f805987` |
| `713d9b3a43d825fb9f3cca01a05878f813ba60bd` | W2 remote-verification note | unchanged ancestor; not squashed | `713d9b3a43d825fb9f3cca01a05878f813ba60bd` |
| `5fadf0769273178bd07c770f907871753f541768` | W3 local store canonical | unchanged ancestor | `5fadf0769273178bd07c770f907871753f541768` |
| `2cb4b1e29a83350ca17fa02ddf4786d2546b09ae` | W3 evidence | unchanged ancestor | `2cb4b1e29a83350ca17fa02ddf4786d2546b09ae` |
| `6fed2a34b979384a2b94870559391d3a7d304315` | W3 remote-verification note | unchanged ancestor; not squashed | `6fed2a34b979384a2b94870559391d3a7d304315` |
| `59929196888410483b320c6ee883eb8e8316c43a` | W4 local repositories canonical | unchanged ancestor | `59929196888410483b320c6ee883eb8e8316c43a` |
| `8bd4981c0472d766d3196e1f354368a8413d6d0e` | W4 evidence | unchanged ancestor | `8bd4981c0472d766d3196e1f354368a8413d6d0e` |
| `500d30f151a637ddfd41e60d454210ef406ef908` | W5 organization in the locally-served enumeration | unchanged ancestor | `500d30f151a637ddfd41e60d454210ef406ef908` |
| `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac` | W5 evidence | unchanged ancestor | `6cd44e2460ed16f5a5e59ff8be9af38ae8db46ac` |
| `bfddc30bce1288f25135f313758bf5fa3bb26949` | W6 lifecycle marker | unchanged ancestor | `bfddc30bce1288f25135f313758bf5fa3bb26949` |
| `934a6d62f2d6edc4b06ccb29de118679dc9b038a` | W6 lifecycle evidence | unchanged ancestor | `934a6d62f2d6edc4b06ccb29de118679dc9b038a` |
| `896fddd2531d7d72dc9c23f63b3a7657a5035ad7` | W6 `demo` env alias to local | unchanged ancestor | `896fddd2531d7d72dc9c23f63b3a7657a5035ad7` |
| `b3d417e287afda009c12d03ee88e9bfa078f224f` | W6 alias evidence | unchanged ancestor | `b3d417e287afda009c12d03ee88e9bfa078f224f` |
| `b8f62877cf50815394e9f1ae26c86fb7da060c7e` | W7A client refuses local and demo sources | unchanged ancestor | `b8f62877cf50815394e9f1ae26c86fb7da060c7e` |
| `039b9c827d54aabbec9e90557c3efb49eb37678a` | W7A evidence | unchanged ancestor; replay base | `039b9c827d54aabbec9e90557c3efb49eb37678a` |
| `1eb6366d0482c55845e5239ed20a9b44a4e6f68b` | rejected three-artifact build | removed from this lineage only | removed from this lineage |
| `10c815412f4e951b8f05323de4e50927f116ab05` | rejected three-artifact evidence | removed from this lineage only | removed from this lineage |
| `22cbd26f17009bdd695cf6900d07f743806f2030` | revert of that rejected attempt | removed from this lineage only | removed from this lineage |
| `9357704a62b3c8b0d341c77a7d0390c7d28358d3` | W7B Import and Reset | rewritten; same tree `73855a6d9efe8a761b93c7e8c439f6553c12c6a7` | `f3e96a32f5b81151e5aa5475d20cfd6f88d9b524` |
| `619c2bb3efc07308568c0c646e683a0e3a1182d4` | W7B first evidence | rewritten; same tree `ab2784a8fc823247fea5a08e24b907e287c1b2b0` | `b25e025fb6a239e606b9e6cd9ab67d24235d8562` |
| `f791f90c6e1d7956bf0c9bfd46cf02ebc3cb9f53` | W7B contract close | rewritten; same tree `d855475b258eb3ffd6b8c871390a859c85191aea` | `a97235fda962d7ba753789ebffa3b51bf3b395e9` |
| `186f3b7b14f6283834fb391c7cd6dcd8d254b432` | W7B contract evidence | rewritten; same tree `99ac9f95930effc6e9e08725a2e60526e84e4ae5` | `b9fd0d17a329fa96e80d2009c45dce9d3196e6b9` |
| `318c0f2ea2d68a62f2273797c547a584546a3a5d` | W8 two-composition gates | rewritten; same tree `35deaae8e0f8f8c2ed4a64847665a6e23a9ad2f3` | `63cd034164bc0c4cbd7c420b16ef9900a16faacf` |
| `bc5f1cfa67170ff106f8811cee476ea241d140d4` | W8 evidence | rewritten; same tree `72c869963529c180581fb35005cb8c44c16e4aec` | `7477349e5debf140fda55636ad7d2d1356daa31d` |
| `14a62fd720878a3bdf5f40cf2d7cbb8c52415a16` | W9 two Class-H renames | rewritten; same tree `6e8dc6b78430821fab03bcf06403c92b648ff655` | `7efa032c450fd180d7158ff217162c24fe2454ff` |
| `c783bec7ae334e30e9b557f6b331ac5a1d9ed556` | W9 evidence | rewritten; same tree `05b0e72c0ecb254760990398c3ac3029ba335c94` | `7894a9a4a5ec8dd601b5a41a2ccd3fa27f1d5bb3` |
| `13599bbfc4fdce42de975ef28d104a8264bf88bf` | W10 eradication audit | rewritten; same tree `afba3b8e48f4668459b2b0930522590dcc23a756` | `a89fa7324a9fcab7f8c8477db05abfea11698663` |
| `ca8afba365e375a9c150fef5441f200f3e9f9dc4` | pre-cleanup handoff content | rewritten; same tree `f5198ed4655af85b8ac4884bda4d491ef0c8743f` | `98842129c75e5f8e5ecd128f8276e6c8e1f5e1b5` |
| `1b233362ef391e4b8f31df9e48c56b3687e36222` | handoff SHA-record | rewritten; same tree `d15d1ce02a1472e88664ba98eca5ece22b4fbb3e` | `f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8` |

The mapping commit is `689de032b658a2eebf50a2b54d184d855336f54d`. Its parent is `f06fdc707d0d212fe9d2ee29c4bf7f6def458ac8`. It is not a product commit. The current cleaned tip is the following documentation commit.

No implementation commit has been squashed. The three remote-verification commits are content-bearing documentation and were not squashed.

## 5. Commits intentionally removed

Removed from `cleanup/demo-migration-lineage` only. Not deleted from the repository. Still reachable from `docs/demo-migration-plan` at `1b233362ef391e4b8f31df9e48c56b3687e36222`. Not reachable from this branch.

| Old SHA | Parent | Tree | Class | Why it left this lineage |
| --- | --- | --- | --- | --- |
| `1eb6366d0482c55845e5239ed20a9b44a4e6f68b` | `039b9c827d54aabbec9e90557c3efb49eb37678a` | `ad250ca5a50a27789f197c389e8b9705574fb362` | rejected architecture attempt | Built customer, client, and operator as three artifacts. Owner rejected it. |
| `10c815412f4e951b8f05323de4e50927f116ab05` | `1eb6366d0482c55845e5239ed20a9b44a4e6f68b` | `281f5b7e24927d67d39511eaad30d535d9d84996` | evidence of that rejected attempt | Added `docs/migration/W7_THREE_TARGET_EVIDENCE.md`. That file is not in the required tree. |
| `22cbd26f17009bdd695cf6900d07f743806f2030` | `10c815412f4e951b8f05323de4e50927f116ab05` | `4afa9351d3b797e8a4444609c9ab50bd37051ec3` | revert of that experiment | Restored the W7A tree. Its tree equals `039b9c82`. |

The replay was run. `a89fa7324a9fcab7f8c8477db05abfea11698663` has tree `afba3b8e48f4668459b2b0930522590dcc23a756`, identical to old `13599bb`. Evidence commits, verification notes, and both W7B batches were kept. No other commit was removed.

## 6. Final tree contract

Required tree of the pre-handoff tip: `afba3b8e48f4668459b2b0930522590dcc23a756`.

What remains, relative to `main`:

- Versioned dataset extraction and local store as the persistence authority.
- Local repositories as the canonical demo/local implementation.
- The 12-id locally-served enumeration, including `organization`, in both lists.
- Lifecycle marker and the `demo` env alias to local.
- Client composition refusal of local and demo sources.
- Fixture-only Import and Reset.
- W8 boundary gates.
- W9 renames: `demoReferences.ts` → `mediaReferences.ts`; `demoCollection.ts` removed and importers pointed at `repositoryPlumbing.ts`.
- W10 audit at `docs/migration/W10_ERADICATION_AUDIT.md`.
- This handoff, after this commit.

What was removed from the tip tree and must stay removed:

- A third composition.
- `dist/customer` and `dist/operator` as build outputs.
- `docs/migration/W7_THREE_TARGET_EVIDENCE.md`.

What was renamed and must stay renamed:

- `src` reference module `demoReferences.ts` → `mediaReferences.ts`.
- Class-H collection import path away from `demoCollection.ts` onto `repositoryPlumbing.ts`.

What must not be touched:

- `main`, the backup branch, archive tags, and the dirty WIP.
- `vite.config.ts` and `APP_TARGET` selection.
- Registry split: `registry.ts`, `registry.client.ts`, `registryCore.ts`. No merge. No third composition.
- D9 subject `dist/client`, cap exactly `361144`, recorded size `306416`. Fixture `362149` is not under that cap.
- `SEED_DATE`, `SEED_VERSION`, `ava:demo:` storage keys, Import/Reset credentials, dataset schema.
- `src/views/__tests__/schedulingWrites.test.tsx`.
- `src/__tests__/projectState.test.ts`. Do not weaken it to hide clone-only failures.

## 7. Demo migration state

| Wave | Closure | Old SHA | SHA on this branch |
| --- | --- | --- | --- |
| W7A implementation | closed | `b8f62877cf50815394e9f1ae26c86fb7da060c7e` | same |
| W7A evidence | closed | `039b9c827d54aabbec9e90557c3efb49eb37678a` | same |
| W7B Import/Reset | closed | `9357704a62b3c8b0d341c77a7d0390c7d28358d3` | `f3e96a32f5b81151e5aa5475d20cfd6f88d9b524` |
| W7B first evidence | closed | `619c2bb3efc07308568c0c646e683a0e3a1182d4` | `b25e025fb6a239e606b9e6cd9ab67d24235d8562` |
| W7B contract close | closed | `f791f90c6e1d7956bf0c9bfd46cf02ebc3cb9f53` | `a97235fda962d7ba753789ebffa3b51bf3b395e9` |
| W7B contract evidence | closed | `186f3b7b14f6283834fb391c7cd6dcd8d254b432` | `b9fd0d17a329fa96e80d2009c45dce9d3196e6b9` |
| W8 gates | closed | `318c0f2ea2d68a62f2273797c547a584546a3a5d` | `63cd034164bc0c4cbd7c420b16ef9900a16faacf` |
| W8 evidence | closed | `bc5f1cfa67170ff106f8811cee476ea241d140d4` | `7477349e5debf140fda55636ad7d2d1356daa31d` |
| W9 rename | closed | `14a62fd720878a3bdf5f40cf2d7cbb8c52415a16` | `7efa032c450fd180d7158ff217162c24fe2454ff` |
| W9 evidence | closed | `c783bec7ae334e30e9b557f6b331ac5a1d9ed556` | `7894a9a4a5ec8dd601b5a41a2ccd3fa27f1d5bb3` |
| W10 audit | closed as a read-only audit, not an implementation | `13599bbfc4fdce42de975ef28d104a8264bf88bf` | `a89fa7324a9fcab7f8c8477db05abfea11698663` |

W10 records `Migration Complete = NOT PROVEN`. That sentence is still true. Closed waves are not a license to repeat them. The rejected three-artifact line is not a closure state. It is absent from this branch and still present on `docs/demo-migration-plan`.

W1 still records the membership decision as pending in `docs/migration/W1_DECISION_BOUNDARY.md`. W5 code put `organization` in the 12-id lists. Do not “resolve” that record in a cleanup. Do not confuse it with `DECISIONS.md` D8. Those are different namespaces.

## 8. Current known failures

Not re-run in the handoff turn. Do not mark them fixed.

| Failure | State |
| --- | --- |
| I19 | `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra id `ses_cl2_20260929_1400`. Pre-existing frontend seed-date failure. Not a backend contract. Do not edit the test to make it pass. |
| `projectState` on a shallow or single-branch clone | Missing historical objects, including tip `251af96f405df5935ee17ddc9ba6b490f7989c2d`, and missing `origin/main` in a clone that only has the migration branch. Environmental. Do not edit `src/__tests__/projectState.test.ts` or the engineering docs to hide them. |
| Newly discovered in this handoff turn | None. Tests and builds were not run. |

## 9. Current architecture

Two compositions only.

| Fact | Contract |
| --- | --- |
| Client build | `build:client` → `dist/client` |
| Demo build | `build:demo` → `dist/demo` |
| Registries | `src/domains/registry.ts`, `src/domains/registry.client.ts`, `src/domains/registryCore.ts`. Do not merge them. |
| `APP_TARGET=client` | Selects the client composition. |
| `APP_TARGET=demo`, empty, or any unknown value, including `operator` and `customer` | Selects demo. This is recorded behavior, not a defect to fix in cleanup. |
| Client isolation | The client graph does not import the demo store, seed, credentials, or local repositories. Twelve domains are `DOMAIN_UNAVAILABLE` in the client composition. |
| D9 | Subject is `dist/client` only. Cap is exactly `361144`. Recorded gzip size is `306416`. Do not quote a new measurement. No rebuild was run for this handoff. |
| Migration membership list | Two mirrored 12-id lists, both including `organization`. The W1 owner decision record is still pending. |
| Remaining demo compatibility surface | `demoStore.ts`, four `demoRepository.ts` shims, `demoCredentials.ts`, `DemoDataPanel`, `DemoBackedNotice`, `DemoNote`, `DemoServedDomain`, and `ava:demo:` keys. Do not rename or remove them in cleanup. |

“One application” means the client composition is the application boundary. It does not authorize merging compositions.

## 10. Backend readiness

No Laravel, PHP, `composer.json`, or `artisan` exists in this repository. An `apiRepository.ts` is a frontend client contract, not a running server.

Client base is `/api/v1`. `ApiClient` is JSON-only (`get`, `post`, `patch`, `delete`, `getPage`), unwraps `{ data }` or `{ data, meta }`, and sends `Authorization: Bearer`. It cannot carry a binary body. Timeout is `15000`.

### Wired client contracts — server absent

The client composition can call these. Building them does not require inventing paths.

| Domain | Contract present in source |
| --- | --- |
| Authentication | `POST auth/login` body `{ email, password }` → `{ data: { user, permissions, token, expires_at } }`; `POST auth/logout`; `GET auth/me`. Server is the identity and authorization authority. |
| Users | `GET/POST users`, `GET/PATCH/DELETE users/{id}`, `POST users/{id}/password` `{ password }`, `GET users/{id}/password` → `{ has_password }`. |
| Roles | `GET roles`, `GET/PATCH roles/{id}`, `POST roles/{id}/reset`. |
| Students | `students` CRUD. Query: `search`, `status`, `instrument`, `payment`, `teacher_id`, `sort`, `page`, `per_page`. Wire DTO mapping is explicitly deferred in the client file. |
| Teachers | `teachers` CRUD plus `POST teachers/{id}/deactivate`. Query also has `assignable` and `dir`. |
| Rooms | `rooms` CRUD plus `POST rooms/{id}/deactivate`. |
| Classes | `classes` CRUD plus `POST classes/{id}/archive`. |
| Enrollments | `enrollments` CRUD plus `POST enrollments/{id}/withdraw`. Capacity and duplicates are server-side. |

### Contract present, not registered

The client composition returns `DOMAIN_UNAVAILABLE`. Do not wire these during cleanup.

| Domain | Named contract | Gap |
| --- | --- | --- |
| Library | `resources` CRUD. Query adds `kind`, `level`, `visibility`. | `POST /uploads` and `GET /resources/{id}/download` are named and not called. Download is not implemented. |
| Organization | `GET /organization`, `PATCH /organization` | Not selected. Writes name `settings.read` / `settings.write` and require server validation. |
| Progress | pieces and piece-assignments CRUD; `GET/POST progress-events`; `GET students/{id}/progress-overview` | Events are append-only. No PATCH or DELETE on events. |
| Scheduling | sessions CRUD, `cancel`, `reschedule`, `POST sessions/generate?preview=1`, `POST sessions/check-conflicts`, `GET sessions/{id}/roster` | Conflicts must be rechecked in the write transaction. Preview is read-only. Roster is enrollment-backed and caller-scoped. |
| Attendance | listed GET/POST routes including `bulk`, `{id}/correct`, corrections, session attendance reads, `sessions/with-attendance` | No PATCH or DELETE. `UNIQUE(session_id, student_id)`. Bulk is one transaction. Corrections are append-only. Actor ids come from the session, not the body. |

### CONTRACT MISSING — OWNER DECISION REQUIRED

No HTTP class exists. Do not invent endpoints.

- Instruments
- Learning
- Chat
- Media (`getBlob` only; bytes are local blobs)
- Branding
- Gallery
- Compensation (`list`, `get`, `register`, `schedule`, `complete`; source says there is deliberately no API class)

Finance, reports, messaging, and notifications are not empty directories, but they have no API repository. Export and student import are frontend file tools.

### Security

`docs/security.md` §8 is identified and not implemented. Required before a production backend can be called ready: server password hashing, authorization on every endpoint, rate limiting, server session revocation, CSRF if cookies are used, tenant isolation, IDOR checks, an append-only progress log, audit logging, breached-password checks, admin MFA, the upload pipeline, and encrypted backups.

`organization_id` is a type comment on several domain types, not a field on the auth wire session. Do not assume the current JSON body carries it.

Frontend RBAC is UX only. Named permissions used by the client include `students`, `teachers`, `classes`, `schedule`, `attendance`, `finance`, `messages`, and `library` read/write, plus `reports.read`, `settings.read`, `settings.write`, and `demo.manage`. Do not invent a permission count. `demo.manage` is the fixture Import/Reset gate, not a production API contract. `T-02` remains the live governance decision in `GOVERNANCE_CHECKPOINT.md` (accepted, assigned-only). Do not reopen it. Server enforcement of that decision does not exist yet.

### Telegram, Bale, and push

Required product capabilities, contract now, backend later. Source: `docs/frontend-completion/16-telegram-bale-backup-integration.md`. No Telegram Bot API implementation in React. Current backup is the local JSON envelope in `src/domains/demo/backup.ts`. Chat provider labels include `telegram` and `bale` and report unavailable without a backend. No web-push or service-worker implementation was found in `src` at this tip. Do not start that work from this handoff.

### Required backend work, not authorized now

First slice the current client composition can call, after an explicit owner authorization that is separate from cleanup: authentication, then users and roles, then teachers, rooms, and students, then classes, then enrollments. Students stay field-incomplete until the deferred wire mapping is decided. The twelve unavailable domains are not in that slice.

## 11. Git cleanup decision

**Executed as owner decision B, on `cleanup/demo-migration-lineage` only. `main` is still untouched.**

What was done:

- New branch, not a force-update of `main`, backup, archive tags, or `docs/demo-migration-plan`.
- `git rebase --onto 039b9c827d54aabbec9e90557c3efb49eb37678a 22cbd26f17009bdd695cf6900d07f743806f2030`.
- Dropped only `1eb6366`, `10c8154`, and `22cbd26` from this lineage.
- Kept every other commit, including evidence and both handoff commits, with identical trees.
- Did not squash the remote-verification notes.
- Pre-handoff tree is `afba3b8e48f4668459b2b0930522590dcc23a756`.

Merge strategy now:

- Do not merge to `main` yet.
- Do not fast-forward `main`.
- Do not force-push `docs/demo-migration-plan`. The old SHAs must stay reachable there.
- A later merge requires a separate owner authorization and a PR from this branch. It has not been opened.

## 12. Exact next action

Stop. Do not merge to `main`.

Do not:

- rewrite this branch again
- force-push `main`, backup, archive tags, or `docs/demo-migration-plan`
- touch the protected WIP
- re-run W7A, W7B, W8, W9, or W10
- fix I19
- change D9, `APP_TARGET`, registries, seeds, or storage keys
- invent API endpoints
- start backend, Telegram, Bale, or push implementation

Cleanup of this branch is recorded here. Merge to `main` is not done and is not authorized by this commit.

---

## HISTORICAL BODY — preserved, not a live work order

> The following text is the previous contents of `docs/engineering/SESSION_HANDOFF.md` at
> `13599bbfc4fdce42de975ef28d104a8264bf88bf`. It is preserved so its SHAs are not deleted.
> Do not execute its next-action lines. The live pointer at the top of this file supersedes them.


# SESSION HANDOFF — post-consolidation

> This file is the recovery document for the next agent session. Conversation memory is not
> durable; this file, Git history, and the test suite are.
>
> Sibling: [PROJECT_STATE.md](PROJECT_STATE.md) · [PHASES.md](PHASES.md) · [DECISIONS.md](DECISIONS.md) ·
> [OPEN_ITEMS.md](OPEN_ITEMS.md) · [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) ·
> [PRE_CLEANUP_HANDOFF.md](PRE_CLEANUP_HANDOFF.md)

**Recorded:** 2026-09-21 · **Nature:** documentation-only. No product, test, dependency, backend or
Git-history change is authorized by this file.

> **⚠️ LIVE POINTER — added 2026-09-26.** The most recent session closed with **PR #16** (Library
> document preview + clearing the role-policy projection at session boundaries) open and **unmerged**
> on `arena/01a0daeb-parsian-music-dashboard-opus`, head `8fa81a1` on base `main` @ `6c9aa4c`. Its
> full durable record — decisions, verification numbers, mutation evidence, exclusions, the Browser QA
> checklist and the next-session start point — is
> [../session-handoffs/PR16_FINAL_SESSION_HANDOFF.md](../session-handoffs/PR16_FINAL_SESSION_HANDOFF.md).
> Everything below this blockquote remains valid **as the post-consolidation record of 2026-09-21**,
> but its §1 SHA and working-branch rows are historical: `6ca25be` was later pushed, `main` has since
> advanced past the PR #15 merge, and `arena/01a0cef8` is not the live branch. Read §1 as provenance,
> and take current values from `git ls-remote`, never from this table.
>
> **⚠️ LIVE POINTER — 2026-09-27, supersedes the PR #16 pointer above.** The current session closed
> with **PR #18** (**G-7 CLOSED** — a real Library → Teacher relationship, so `composer` is no longer a
> teacher proxy) **open and intentionally unmerged** on
> `arena/01a0e006-parsian-music-dashboard-opus`, G-7 head `096723b` on base `main` @ `8e6bce9`.
> **F2 is NOT STARTED**; backend/Laravel is untouched; **Browser QA remains NOT VERIFIED**. Its full
> durable record — the approved decision, the seed migration, the LearningContent propagation fix,
> the verification numbers, the mutation evidence, the ref-integrity audit, the known
> documentation discrepancy, and the next-session start point — is
> [../session-handoffs/PR18_FINAL_SESSION_HANDOFF.md](../session-handoffs/PR18_FINAL_SESSION_HANDOFF.md),
> with the merge-time Git-object consequences in
> [../session-handoffs/PR18_PRE_MERGE_CONSERVATION.md](../session-handoffs/PR18_PRE_MERGE_CONSERVATION.md).
>
> **Next intended sequence: merge PR #18 → read-only post-merge integrity audit → record the merged
> `main` SHA → only then F2.** Do not begin F2 before that audit completes.
>
> **Do not trust this file's table for the current position — it is a historical record. Take current
> values from `gh pr view 18` and `git ls-remote`, never from §1.**

---

## 1. Canonical state — read this first

| Field | Value |
|---|---|
| Canonical branch | **`main`** |
| Canonical HEAD | **`6ca25be654b56579054c88cd498a42f57ea63582`** — the **D1 documentation checkpoint**, committed locally and **not yet pushed**; the **consolidation merge base** beneath it is `f63ebaab37096fcb25063aca51c713e26d3b3da7` (PR #5), which is still the remote `main` until the push happens. **D1 is not the consolidation merge.** |
| How to verify | `git rev-parse HEAD` and `git rev-parse --abbrev-ref HEAD`; verify the remote independently with `git ls-remote origin refs/heads/main`. **Do not trust a local clone's ancestry — measure whether it is shallow** (`git rev-parse --is-shallow-repository`). |
| F0–F10 frontend product completion | ✅ **COMPLETE / DELIVERED** on canonical history — `docs/frontend-completion/` 01–17 + README |
| Arena Frontend Freeze (M-1..M-6, D7, D9) | ✅ **COMPLETE** — frozen at `a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb`, preserved |
| M10 / M11 chains | ✅ preserved — M10 `e7a64b7777be36ddd97fc3337898fad794118e5b`; M11 `3ed0bfe4ac928451a4bddf9de3a34f7be681c33f` → … → `f7eb86762dc11f7d5dd3c7218e7c697fad29488e` |
| Consolidation | ✅ **COMPLETE** — PR #5 *Consolidate frontend F0–F10 + governance into main* **MERGED** 2026-09-20T21:11:18Z |
| Laravel / backend | ❌ **NOT STARTED and NOT AUTHORIZED** |
| Current gate | **Completion and verification of the documentation pass (D1/D2)** — **D1 committed (`6ca25be…`), D2 being recorded now**; the evidence for D1 is that this handoff's live state rows name it, and no entry may carry its own SHA |
| Working branch — D9 A-lite / B (row added 2026-09-25) | ✅ `arena/01a0cef8-parsian-music-dashboard-opus` @ `046771d` — A2 (`tailwind-merge` → in-repo `mergeClassNames`, `cn()` call sites unchanged) and the D9 re-baseline (**baseline 343 947 B → cap 361 144 B**), committed and pushed fast-forward (`bcacdcb..046771d`); `main` (`ece060d`) untouched. Records: [DECISIONS.md](DECISIONS.md) §22. |

### 1.1 Live vs historical — do not conflate these

| Document | Status |
|---|---|
| [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) (recorded 2026-09-20) | ✅ **LIVE LAW** for `T-02` / `O-*` / `PERF` / `HELP`. Reached from [DECISIONS.md](DECISIONS.md) **§20**, which is a *pointer* and amends no D-entry. |
| `docs/frontend-completion/13-open-decisions.md` (F0 / 2026-09-19) | ⛔ **HISTORICAL SNAPSHOT.** Its `O-01..O-20` **and** `T-02` statuses are superseded by the 2026-09-20 governance checkpoint. Do **not** treat it as current law and do **not** rewrite its rows. |
| [archive/SESSION_HANDOFF-2026-09-18-pre-M1.md](archive/SESSION_HANDOFF-2026-09-18-pre-M1.md) (64 KB, pre-M1) | ⛔ **HISTORICAL.** Preserved unedited — do not rewrite, delete or concatenate. Never a live work order. |
| [PRE_CLEANUP_HANDOFF.md](PRE_CLEANUP_HANDOFF.md) (2026-09-20) | Consolidation **provenance**. Its "not yet safe to consolidate" verdict is now **discharged**; its rationale is retained. |

**The single most important correction this handoff makes:** the earlier operational text in this
file (the F1-kickoff document) described the pre-consolidation world — branch
`arena/frontend-completion-spec`, `CURRENT_HEAD a251e69`, `PR #4 OPEN`, `NEXT ACTION F1`. **All of
that is historical.** PR #4 is **CLOSED and was never merged**; its line
`f00f85e6f817369a32b8921ffb64f58e17ea154e` reached canonical history through PR #5's merge commit
`112f1160104d375481b930517d08592bb67a0a72` instead.

### 1.2 Governance: T-02 and the O-* items

**`T-02` is NOT unresolved.** The live status is **ACCEPTED / ASSIGNED-ONLY** — teacher
student-read = active enrollment ∩ `class.teacherId`; `Student.teacherId` is not authorization;
fail-closed; do not revisit. Report it that way. The older text saying *"T-02 OPEN — EVIDENCE
CONFLICTING — do NOT change"* belongs to the superseded 2026-09-19 snapshot, not to current law.

Do **not** port the two registers into each other: the governance checkpoint's IDs are a separate
namespace from [DECISIONS.md](DECISIONS.md) D1–D20 (collisions: `D7 ≠ O-07`, `D15 ≠ O-15`).

---

## 2. Recovery path for a fresh session

1. Read **this file**, then [PROJECT_STATE.md](PROJECT_STATE.md) §1–§3.
2. Verify Git **before** trusting anything: `git status --porcelain`, `git rev-parse HEAD`,
   `git rev-parse --abbrev-ref HEAD`, `git rev-parse --is-shallow-repository`, and
   `git ls-remote origin refs/heads/main`.
3. Read [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) for the live decision register, and
   [PHASES.md](PHASES.md) → "Consolidation — 2026-09-20" for the ledger event.
4. Read [OPEN_ITEMS.md](OPEN_ITEMS.md) before starting any work.
5. **Never** reset, re-clone, delete, stash or discard uncommitted work without explicit owner
   authorization. If the tree is dirty, record `git status --porcelain` and `git diff --stat` and ask.
6. Re-establish a green baseline before changing anything — and **`npm ci`, never `npm install`**.

---

## 3. Known environmental condition: a shallow clone

The provisioned workspace has been observed **shallow** (`.git/shallow` present, history grafted).
Consequences, recorded rather than papered over:

- `src/__tests__/projectState.test.ts` contains a Git-object block
  (`describe.skipIf(!gitAvailable)("the recorded checkpoints are real Git objects")`). On a shallow
  clone **nine** of its ten assertions fail because recorded historical commits are simply absent
  locally — they are real commits on GitHub, they are just not in this object store. These are
  **environmental**, not documentation defects.
- **The tenth assertion — "the recorded working branch is the branch actually checked out" — was a
  genuine documentation defect** and has been corrected: [PROJECT_STATE.md](PROJECT_STATE.md) §2 now
  records `main`, so that assertion passes.
- **Do not** "fix" environmental failures by editing documents or the test.
  `src/__tests__/projectState.test.ts` must not be modified, skipped or weakened. Deepening the
  clone (`git fetch --unshallow origin`) is a read-only widening but is **not authorized** by this
  handoff — ask first.

---

## 4. Next gate — documentation D1/D2, then (and only then) backend planning

**Current gate: complete and verify the documentation pass (D1/D2).** That means:

- `PROJECT_STATE.md` / `PHASES.md` / `OPEN_ITEMS.md` / this file agree on the canonical branch,
  the canonical HEAD, the consolidation event, the governance source of truth and the Laravel
  status.
- The historical artifacts (`13-open-decisions.md`, the 64 KB archive) are clearly marked
  historical and are **not** presented as current law.
- The recovery quartet leads a fresh session to [DECISIONS.md](DECISIONS.md) §20 and
  [GOVERNANCE_CHECKPOINT.md](GOVERNANCE_CHECKPOINT.md) without telling it that `T-02` is unresolved.
- `src/__tests__/projectState.test.ts` has **no non-Git assertion red**. Remaining reds, if any, are
  the shallow-clone Git-object class and must be reported as such.

**After that gate, and only on an explicit owner authorization**, the next phase may be Laravel /
backend planning or implementation. **It is NOT started and NOT authorized now.** Neither this
handoff nor the consolidation ledger authorizes a milestone beyond M11, any F-series
implementation, or any `src/` change.

Standing boundary from the freeze, still in force: the frontend is frozen at
`a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb`; all future frontend fixes require an explicit decision
to reopen that freeze. **Browser QA remains NOT VERIFIED** — no browser tooling exists in this
environment, and no claim of browser verification may be made without external evidence.

---

## 4b. Machine-Readable CONTINUE HERE

```json
{
  "CURRENT_PHASE": "POST_CONSOLIDATION — documentation gate (D1/D2)",
  "CANONICAL_BRANCH": "main",
  "CANONICAL_HEAD": "6ca25be654b56579054c88cd498a42f57ea63582",
  "CONSOLIDATION_MERGE_BASE": "f63ebaab37096fcb25063aca51c713e26d3b3da7",
  "PUSH_STATE": "D1 committed locally, NOT pushed — remote main is still f63ebaab",
  "CONSOLIDATION": "COMPLETE — PR #5 merged 2026-09-20T21:11:18Z",
  "FRONTEND_PRODUCT_COMPLETION": "F0–F10 COMPLETE / DELIVERED",
  "FRONTEND_FREEZE": "COMPLETE — M-1..M-6, D7, D9 at a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb",
  "PR_4": "CLOSED — never merged",
  "PR_5": "MERGED into main",
  "GOVERNANCE_SOURCE_OF_TRUTH": "docs/engineering/GOVERNANCE_CHECKPOINT.md (@ DECISIONS.md §20)",
  "T_02_STATUS": "ACCEPTED / ASSIGNED-ONLY — do not revisit",
  "HISTORICAL_NOT_CURRENT_LAW": [
    "docs/frontend-completion/13-open-decisions.md",
    "docs/engineering/archive/SESSION_HANDOFF-2026-09-18-pre-M1.md"
  ],
  "LARAVEL_BACKEND": "NOT STARTED and NOT AUTHORIZED",
  "NEXT_GATE": "Completion and verification of the documentation pass (D1/D2) — D1 committed, D2 being recorded",
  "AFTER_GATE": "Laravel/backend planning or implementation — only on explicit owner authorization",
  "PRESERVED_SHAS": [
    "f00f85e6f817369a32b8921ffb64f58e17ea154e",
    "02b74996e6458d10a5d9e8d1023890239342c4e4",
    "112f1160104d375481b930517d08592bb67a0a72",
    "59fdacf9606fdc2ded3f060603405f94c7408d30"
  ],
  "HISTORY_REWRITTEN": false,
  "BROWSER_QA": "NOT VERIFIED",
  "DO_NOT_MODIFY": [
    "src/__tests__/projectState.test.ts",
    "any src/ file",
    "docs/engineering/archive/**",
    "DECISIONS.md D1–D20 body",
    "GOVERNANCE_CHECKPOINT.md statuses",
    "README and branding"
  ]
}
```

---

## 5. Historical records — preserved, clearly marked, NOT current state

> ⛔ **Everything in this section is historical.** It is kept for audit only. None of it is a live
> instruction, and none of its `CURRENT_BRANCH` / `CURRENT_HEAD` values are today's.

### 5.1 Frontend freeze closure — 2026-09-19 — historical

Frozen HEAD `a3867a60ac25c81adc5c1bc10122f4eeeedbc0cb` on `arena/01a0b6be-parsian-music-dashboard-opus`.
**M-1 Quick Actions CLOSED, D7 Accessibility CLOSED, M-2 Teacher Photo CLOSED, M-3 Student Photo
CLOSED, M-4 I15 Failure Disclosure CLOSED, M-5 I16 Deep Links CLOSED, M-6 Settings Honesty CLOSED,
D9 Performance CLOSED.** Measured at `a3867a6`: entry CSS gzip 16.39 kB, vendor 60.29 kB, index
118.50 kB, operations 47.07 kB, academic 47.86 kB; total JS+CSS+HTML ~300 kB within the +5% cap
305 805 B; no chunk ≥400 kB; 2037 modules; `npx tsc --noEmit --skipLibCheck` 0 errors; focused 92
tests pass; full suite 2102 passed / 10 failed — the 10 being the known historical
`projectState.test.ts` SHA/branch expectations, test not altered. **Browser QA NOT VERIFIED** as the
formal final-audit disposition. **Deferred items do NOT modify the frozen frontend:** Classes
deep-link beyond the capped list, Finance/Reports backend/domain, notification server wiring,
localization/settings server wiring, working-hours/session-rules server wiring, free-slot search,
external browser QA. *Superseded status: the freeze was intentionally reopened for Frontend Product
Completion, which is itself now delivered — see §1.*

### 5.2 F1-KICKOFF correction — 2026-09-19 — historical

Branch `arena/frontend-completion-spec`, `CURRENT_HEAD a251e6942b2a645987286de6e822607554e84df9`,
`PLANNING_CHECKPOINT e57bf1922e4ca3b80796715028445cfe8a077c9c`, `PREVIOUS_PLANNING_CHECKPOINT
c244fec142fcc35faff8e8548c8ebbc05cb53bf5`, base `arena/01a0b6be-parsian-music-dashboard-opus` HEAD
`02b74996`. Previous correction commits `9695097` + `a251e69` were documentation-only and are **not**
planning milestones. Spec path `docs/frontend-completion/` v14 @ `e57bf19`. PR #4 was **OPEN** at that
date and is **now CLOSED, never merged**. `NEXT ACTION F1` was that pass's next slice; the F-series is
now delivered (§1). **No `src/`, test, package or backend change was made by that pass, and no branch
or history was rewritten by it.**

### 5.3 Consolidation — 2026-09-20 — historical provenance

PR #5 merged into `main`; merge commit `f63ebaab37096fcb25063aca51c713e26d3b3da7`; merge parents
`a6469759fea743b9332702bb9a20e69fc4abc1be` (previous `main` tip — **an ancestor, preserved**) and
`112f1160104d375481b930517d08592bb67a0a72` (PR #5 head). PR #4 **CLOSED, never merged**, head
`f00f85e6f817369a32b8921ffb64f58e17ea154e`. Four historical SHAs preserved:
`f00f85e6f817369a32b8921ffb64f58e17ea154e`, `02b74996e6458d10a5d9e8d1023890239342c4e4`,
`112f1160104d375481b930517d08592bb67a0a72`, `59fdacf9606fdc2ded3f060603405f94c7408d30` (the last in
`main`'s own first-parent history: `…7a44c6a → 59fdacf9 → 112f1160 → f63ebaab`). **No history was
rewritten:** `a646975…main` is ahead 49 / behind 0, so the advance was merge-only. Full record:
[PHASES.md](PHASES.md) → "Consolidation — 2026-09-20" and [PRE_CLEANUP_HANDOFF.md](PRE_CLEANUP_HANDOFF.md).
