# W5 — composition boundary: evidence

Parent / rollback: `8bd4981c0472d766d3196e1f354368a8413d6d0e`
Implementation: `500d30f151a637ddfd41e60d454210ef406ef908`
Branch: docs/demo-migration-plan (not backticked)

This document records the implementation commit. It does not record its own SHA. Verify the tip after the docs push with `git ls-remote`.

## 1. What was authorized

The owner selected, and only these:

- D8-A: organization is included in the locally-served enumeration.
- B1: two builds remain. The one-artifact half of W5 does not proceed.
- D9: the cap stays `361144`. An overrun would have stopped the wave. The cap was not raised.

W6 was not authorized. Backend, I19, `SEED_DATE`, RBAC semantics, dataset bytes, and B2 fetching were not authorized.

## 2. What changed

Three files. +24 / −4.

| File | Change |
| --- | --- |
| `src/domains/registry.ts` | `DEMO_SERVED_DOMAINS` gains `{ id: "organization", label: "قواعد آموزشگاه" }`, between branding and gallery. That is the label already used by `UNAVAILABLE_DOMAINS`. The getter was not changed. It already returns `LocalOrganizationRepository` in both modes. |
| `src/components/shell/DemoBackedNotice.tsx` | Comment only: the contract text said eleven domains. It now says twelve. The rendered names still come only from the enumeration. |
| `src/components/shell/__tests__/DemoBackedNotice.test.tsx` | The pinned id list is the twelve ids, including organization. The tripwire constructs `getOrganizationRepository()` and requires `LocalOrganizationRepository`. The old assertions (api-only, non-dismissable, no health claim, wording equals the registry set) remain. |

Not changed: `registry.client.ts`, `unavailableDomains.ts`, `vite.config.ts`, `package.json`, both tsconfigs, the six target pairs, storage keys, seed constants, the dataset artifact, I19.

## 3. Behaviour

In the demo composition, api mode now names organization in the disclosure. It was already served by the local organization repository and was omitted from the list. Demo mode still does not render the notice.

The client composition is unchanged. Its `DEMO_SERVED_DOMAINS` stub is still empty. Organization is still an explicit unavailable domain there, not a local repository. The client bundle does not contain `LocalOrganizationRepository` or `LocalStudentRepository` or `ava:demo:dataset`.

B1 is still the build in force. There is no single artifact. The dataset is not fetched and is not bundled. The Node loader is not imported by production code.

The seven-versus-eight `isApiMode()` drift in `docs/engineering/DECISIONS.md` was not rewritten. Those documents were not edited.

## 4. Verification

Typecheck: `tsconfig.json`, `tsconfig.demo.json`, and `tsconfig.client.json` all exit 0.

Full suite, with all three build trees: 199 files, 2603 passed, 1 failed, 2 skipped (2606). Same shape as the W4 tip with `dist/` present. The failure is I19 at `src/views/__tests__/schedulingWrites.test.tsx:1234`, extra `ses_cl2_20260929_1400`. That file is not in the diff. `SEED_DATE` is still `2026-09-01`.

D9, CLI `gzip -6 -n`, JS+CSS+HTML, cap `361144` unchanged:

| Artifact | W4 | W5 | Delta |
| --- | --- | --- | --- |
| bare | 361,039 | 361,056 | +17 |
| demo | 361,043 | 361,055 | +12 |
| client | 306,291 | 306,291 | 0 |
| bare entry | 135,154 | 135,171 | +17 |

Headroom after this wave: 361,144 − 361,056 = 88 B. Largest JS gzip 135,171, under 400,000 and under the entry anchor 273,791. Module counts unchanged (bare/demo 2096, client 2035).

Dataset hash was not in the diff and was not rewritten: `0f4c731ccb7ce26f30a2adca1b54e8a4f95980818cdab1b9072383fbd0b40b6f`.

## 5. Protected state at the implementation push

`main` `15775ea9486cb57fbfb8fefa3268658cbe7eb669`. Backup `62deb84dfbbd9d7ad27002196569d0c7ef4c87f6`. WIP HEAD `eb973eb2758447eff16b60ab4fd4c267f9d85061`, tracked-diff `aed92770c17177712254a5893a87805277a83dcd607612ceb8cb346c14789a3f`. Not modified.

The implementation push was an ordinary push. `git ls-remote` and the GitHub branch API both returned `500d30f151a637ddfd41e60d454210ef406ef908`. The remote tree `3f2969a593a113087bb7222110fee573e7cb582b` equalled the local tree.

## 6. Rollback

Revert `500d30f151a637ddfd41e60d454210ef406ef908`. Parent `8bd4981c0472d766d3196e1f354368a8413d6d0e`. No key moved, so revert is total. B1 and the client boundary come back with it.

## 7. W6

Not started. Environment vocabulary stays as it is. `VITE_DATA_SOURCE=demo` was not renamed.
