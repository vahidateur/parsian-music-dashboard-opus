# W4 — Repository migration: evidence

Parent / rollback: `6fed2a34b979384a2b94870559391d3a7d304315`
Implementation: `59929196888410483b320c6ee883eb8e8316c43a`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote`.

## 1. What was asked

W4 converts the twenty `Demo*Repository` implementations into the canonical local implementations. Logic stays. Contracts stay. There must not be a second copy of the same repository class.

W5 was not authorized. B1 stays. D8 is not decided. D9's cap is not raised. The dataset artifact is not fetched and is not bundled. I19 and `SEED_DATE` are not touched.

## 2. Spec versus the tree, and how each disagreement was resolved

These were not silent choices.

1. The wave table says twenty `demoRepository.ts` files. The tree has seventeen of those plus `demoAuthRepository.ts`, `demoUserRepository.ts`, and `demoRoleRepository.ts`. The matrix row `src/domains/auth/demoRepository.ts` does not exist and was not created. W1 names the target `Local<Domain>Repository`. The three auth files moved to `localAuthRepository.ts`, `localUserRepository.ts`, and `localRoleRepository.ts`.

2. The wave says the getters in both compositions. The client composition does not construct a demo repository, and `registryClient` forbids that import. Pointing those getters at the local classes would pull the local implementations into the client bundle. That is W5, and it would change a shipped artifact. B1 forbids it. The demo composition's getters now construct the local classes. The client getters still construct `Api*` or an explicit unavailable repository. The client file's comment and gate now name both the old and the new module names, so the rename cannot open a hole.

3. The wave says the per-domain suites are renamed. `projectState` requires every backticked `src/` path in the four recovery documents to exist, and those documents are not edited by this wave. Three of the suite paths are named there: `src/domains/attendance/__tests__/demoRepository.test.ts`, `src/domains/compensation/__tests__/demoRepository.test.ts`, and `src/domains/learning/__tests__/demoRepository.test.ts`. Renaming them would fail that gate. A leftover `*.test.ts` shim would be collected by Vitest. The suite filenames stay. Their imports and constructors now name the local classes. Assertions were not rewritten.

4. Four implementation paths are also named by those documents: chat, classes, learning, and progress `demoRepository.ts`. Those paths remain as eight-line re-exports of `./localRepository`. They declare no class. Nothing in `src` imports them. The other thirteen `demoRepository.ts` paths, and the three auth paths, were moved and not recreated.

## 3. The twenty dispositions

| Class now | Module now | Old module | Shim |
| --- | --- | --- | --- |
| `LocalAttendanceRepository` | `src/domains/attendance/localRepository.ts` | `demoRepository.ts` | no |
| `LocalAuthRepository` | `src/domains/auth/localAuthRepository.ts` | `demoAuthRepository.ts` | no |
| `LocalBrandingRepository` | `src/domains/branding/localRepository.ts` | `demoRepository.ts` | no |
| `LocalChatRepository` | `src/domains/chat/localRepository.ts` | `demoRepository.ts` | re-export only |
| `LocalClassRepository` | `src/domains/classes/localRepository.ts` | `demoRepository.ts` | re-export only |
| `LocalCompensationRepository` | `src/domains/compensation/localRepository.ts` | `demoRepository.ts` | no |
| `LocalEnrollmentRepository` | `src/domains/enrollments/localRepository.ts` | `demoRepository.ts` | no |
| `LocalGalleryRepository` | `src/domains/gallery/localRepository.ts` | `demoRepository.ts` | no |
| `LocalInstrumentRepository` | `src/domains/instruments/localRepository.ts` | `demoRepository.ts` | no |
| `LocalLearningRepository` | `src/domains/learning/localRepository.ts` | `demoRepository.ts` | re-export only |
| `LocalLibraryRepository` | `src/domains/library/localRepository.ts` | `demoRepository.ts` | no |
| `LocalMediaRepository` | `src/domains/media/localRepository.ts` | `demoRepository.ts` | no |
| `LocalOrganizationRepository` | `src/domains/organization/localRepository.ts` | `demoRepository.ts` | no |
| `LocalProgressRepository` | `src/domains/progress/localRepository.ts` | `demoRepository.ts` | re-export only |
| `LocalRoleRepository` | `src/domains/auth/localRoleRepository.ts` | `demoRoleRepository.ts` | no |
| `LocalRoomRepository` | `src/domains/rooms/localRepository.ts` | `demoRepository.ts` | no |
| `LocalSchedulingRepository` | `src/domains/scheduling/localRepository.ts` | `demoRepository.ts` | no |
| `LocalStudentRepository` | `src/domains/students/localRepository.ts` | `demoRepository.ts` | no |
| `LocalTeacherRepository` | `src/domains/teachers/localRepository.ts` | `demoRepository.ts` | no |
| `LocalUserRepository` | `src/domains/auth/localUserRepository.ts` | `demoUserRepository.ts` | no |

`export class Demo*Repository` does not occur in `src`. Each local class is declared once. `src/domains/__tests__/canonicalRepositories.test.ts` pins that.

Git records a rename for sixteen of the twenty modules. For the four shimmed domains it records the old path as modified (the shim) and `localRepository.ts` as added, because the old path was kept. Before the commit, reverting the class-name and path tokens in each new module reproduced the parent blob exactly. Zero mismatches.

## 4. What did not move

- Domain `repository.ts` contracts. Comments that named the old class now name the local class. Method signatures were not edited.
- `DEMO_SERVED_DOMAINS` membership (11) and `UNAVAILABLE_DOMAINS` (12). D8 is untouched.
- Client composition selection. Comment only, plus a stronger import ban.
- Storage keys, `SEED_VERSION`, `SEED_DATE`, `SEED_TIMESTAMP`, `DEMO_PASSPHRASE`, `listDemoAccounts`, `AUTH_SESSION_KEY`, `demo.manage`, `VITE_DATA_SOURCE=demo`.
- `demoStore` shim, `demoCollection` shim, `demoReferences.ts`, `demoEnvironment.ts`.
- Dataset artifact. Hash still `0f4c731ccb7ce26f30a2adca1b54e8a4f95980818cdab1b9072383fbd0b40b6f`. `SEED_DATE` still `2026-09-01`. Dataset version still `2026.09.2`.
- I19. `schedulingWrites.test.tsx` is not in the diff.
- Domain READMEs still say `demoRepository.ts` in prose. They are not a path gate. They were not rewritten. That is residual naming, not this wave.
- Backend, delivery lock behaviour, build profiles, B1/B2/B3.

`instanceof LocalAttendanceRepository` in the demo composition is the same check as before, against the renamed class. The sync attendance-presence path still works only for that class and still fails closed for any other adapter.

## 5. Import audit

No TypeScript file imports `demoAuthRepository`, `demoUserRepository`, `demoRoleRepository`, or a domain `demoRepository` module, except:

- the four shims, which are the path itself;
- `registry.client.ts` and `registryClient.test.ts`, which name those modules only to forbid them.

`DEMO_PASSPHRASE` and `listDemoAccounts` are imported from `localAuthRepository`. The constant names did not change. `privacyPosture` excludes that file from the quoted `arena-demo` scan, following the move. The assertion still scans every other file.

Students IDOR (`studentsDeepLinkIdor.test.tsx`) changed only the import path and the two constructor names. `studentsScopeLeak.p1.test.tsx` and `auth/__tests__/scope.test.ts` were not edited.

## 6. Baseline, recorded before any edit

Typecheck: all three tsconfigs exit 0.

Full suite, no `dist/`: 198 files, 2587 passed, 1 failed, 15 skipped (2603).

The failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra `ses_cl2_20260929_1400`.

Builds, CLI `gzip -6 -n`, JS+CSS+HTML: bare `361039` (entry `135154`), client `306291` (entry `77448`), demo `361043` (entry `135158`). Cap `361144`. Headroom 105 B.

## 7. After the wave

Typecheck: all three exit 0.

Full suite, with all three build trees: 199 files, 2603 passed, 1 failed, 2 skipped (2606).

The added file is the canonical-repository proof (3 tests). The one failure is the same I19 line and the same extra id. The other id in that assertion is generated and differs between runs; that is not a new failure.

D9, remeasured on the new builds, is identical to the baseline: bare `361039`, client `306291`, demo `361043`. Entry `135154`. No chunk at or over `400000`. Cap unchanged. Module counts unchanged (bare/demo 2096, client 2035). The shims are not imported, so they are not in a bundle. The client bundle does not contain `ava:demo:dataset`, `LocalStoreImpl`, or `LocalStudentRepository`.

Focused battery before the full suite: canonical proof, registry, registry client, architecture, projectState, privacy, dataset artifact and contract, store feed, D8 notice, students, teachers, auth, scheduling, compensation, and the IDOR suite. 16 files, 287 passed.

## 8. Compatibility

Kept: `ava:demo:dataset`, `ava:demo:lifecycle`, `ava:demo:session`, `ava:demo:credentials`, persisted `empty`/`demo`, `demo.manage`, seed constants, the `demoStore` import path, the `demoCollection` import path. No new storage key.

The production store still asks `CanonicalDatasetSource`, whose default is still `createSeedDataset()`. This wave did not switch the runtime onto the artifact.

## 9. Protected state at the implementation commit

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP HEAD `eb973eb2758447eff16b60ab4fd4c267f9d85061`, tracked-diff `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f`. Not modified.

## 10. Rollback

`git revert 59929196888410483b320c6ee883eb8e8316c43a` returns the repositories to the W3 tip. No key moved, so revert is total. Parent: `6fed2a34b979384a2b94870559391d3a7d304315`.

## 11. W5 — not started

W5 is one composition and one build. It needs the D8 membership decision and the B1/B2/B3 decision. Neither was made. B1 remains in force. Do not fold `registry.client.ts` into `registry.ts` from this evidence.
