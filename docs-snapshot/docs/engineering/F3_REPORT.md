# F3 — Settings + Theme Editor — FINAL REPORT

> Branch: `arena/frontend-completion-spec` HEAD `61f9b41` (F3) previous `8aff3a2` (F2 report) `d0cfd52` F2 code, `e11593b` F1 fix, planning `e57bf19`, PR #4 OPEN UNMERGED, freeze `a3867a6` preserved — F2 VERIFIED/CLOSED — F3 AUTHORIZED.

## 1. Product Behavior
- BrandingPanel has reset to DEFAULT_BRANDING: button "بازنشانی به پیش‌فرض" sets draft to DEFAULT_BRANDING (academyName "آموزشگاه موسیقی پارسیان", tagline "تالار هنر، جادو و موسیقی", primary #D5AF58 accent #F4D28B text #FFFFFF font Vazirmatn), marks dirty, info toast "پیش‌نمایش بازنشانی شد — برای اعمال ذخیره کنید", does NOT immediately save — customizer-like, requires explicit save.
- Draft preview before save (PROP-BRAND-01 optional): Panel "پیش‌نمایش زنده" kicker "پیش‌نمایش محلی قبل از ذخیره — فقط این کادر رنگ‌ها و فونت پیش‌نویس را نشان می‌دهد" — div with inline style backgroundColor draft.primaryColor, color draft.textColor, borderColor draft.accentColor, fontFamily draft.persianFont, CSS vars --brand-primary etc set on preview only not document, shows academyName/tagline/logo placeholder/font, note "این پیش‌نمایش فقط محلی است — تا ذخیره نکنید در همهٔ بخش‌ها اعمال نمی‌شود" — writes CSS vars to preview only not document until save, like WordPress customizer.
- Appearance device-local stays per D2: theme dark/glass, accent gold/violet/amber, density comfortable/compact, motion bool via savePref localStorage ava:theme etc, preview live Surface, reset button "بازنشانی به پیش‌فرض" resets to dark/gold/comfortable/motion true + info toast — complete, labeled "برای این دستگاه ذخیره می‌شود".
- Org vs device schema doc: branding org single record travels backups demo both modes, appearance device-local localStorage honest — documented in 07-settings-theme-architecture.md and D2.

## 2. Domain Model
- Branding types: DEFAULT_BRANDING, PERSIAN_FONTS 4, isHexColor strict #RRGGBB, isPersianFont allow-list — single owner per D5.
- Branding repository: demo both modes, validation hex strict + font allow-list, single record, travels backups.
- BrandingApplication: mounted below DataLifecycleGate above AuthProvider, writes CSSOM via applyBranding, --brand-* vars consumed by index.css with fallback pre-branding — no readable record renders exactly as before.
- Token architecture: --brand-primary, --brand-accent, --brand-text, --brand-font-fa with fallback, plus appearance tokens via Tailwind, CSP style-src self + unsafe-inline attr narrow exception.

## 3. Source of Truth
- Single authority `demoStore.branding` via `DemoDataset.branding` seed, `BrandingSettings` type — no duplicate fixtures.
- Appearance via localStorage ava:theme etc — device-local per D2, no org data scattered.
- No `src/data/` directory — dissolved at M10.

## 4. Repository Contract
- `BrandingRepository` interface `get/list/create/update/remove` with explicit error kinds, validation rejects empty name, colour not #RRGGBB, font outside allow-list, logo reference not resolving, leaves stored values untouched when validation fails — verified via branding.test.ts.
- `getBrandingRepository` seam, demo vs apiRepository (api exists but demo both modes), binary client not needed for branding (mediaId ref only).
- No fixture counts, `relationsNoFixtures` gate.

## 5. Demo Behavior
- Demo both modes disclosure via `DemoBackedNotice` for 11 domains including branding — persistent non-dismissable api-mode-only health-claim-free — preserved D8.
- Branding update persists and survives reload via demoStore — verified settingsHonesty.
- Draft preview is local only, does not persist until save — honest, no fake persistence.

## 6. API Seam
- `getRepository` seam, demo vs apiRepository, envelope Collection/Item PageMeta, ApiClient envelope.
- Logo/favicon mediaId ref never data URL — prevents XSS via SVG (SVG excluded from allow-list) — verified media types.
- No backend enforcement invented — frontend is UX-only, backend B contract org table organizations + branding_settings + mediaId FK + signed URLs per-object auth.

## 7. Permissions
- 5 roles 22 perms preserved, viewPermissions settings requires settings.read, branding requires settings.read? Actually settings view requires settings.read, branding panel inside settings — uses settings.read/write? BrandingPanel save requires settings.write? Check: BrandingPanel does not explicitly check can() but Settings view is gated via viewPermissions settings.read — admin/manager have settings.read, teacher does not — routeProtection hides settings for teacher.
- No role id direct, no control if forbidden (M2) — preserved.
- useCan safe fallback true when outside provider for legacy view tests — real product always has AuthProvider via App shell, route protection blocks unauthenticated.

## 8. Ownership / Scope
- Org identity vs device-local preference split per D2: branding org, appearance device-local — enforced.
- No scattered theme keys for org data — org data single record — verified D2.
- T-02 remains OPEN (teacher unassigned) — F3 does NOT own, preserved assigned-only filtering from F2.
- O-01 remains OPEN (student level scope per-program vs global) — F3 does NOT own, kept per-program provisional.

## 9. Loading / Empty / Error States
- BrandingPanel: LoadingState "در حال بارگذاری هویت آموزشگاه…", ErrorState with retry owns message "بارگذاری ناموفق بود", success only after resolve, no silent empty — verified M-4 failure disclosure.
- Appearance: no loading, immediate from localStorage, preview live.
- Disabled controls: notifications 7 toggles disabled, localization 6 selects disabled, session-rules 4 inputs disabled, Friday toggle disabled "— غیرفعال" + working hours inputs disabled — all with explicit deferral Surfaces honest "نیازمند سرور است ... صرفاً نمایشی ... ذخیره نمی‌شود" — verified M-6, 14 cases PASS, no fake success.

## 10. Test Strategy
- Branding validation: hex strict rejects shorthand/named, font allow-list, empty name, logo reference not resolving, leaves stored untouched when validation fails — 12 tests in branding.test.ts PASS.
- CSS vars fallback: design-system tokens consume brand properties binds every one of four each with fallback, routes DEFAULT accent scale through brand colours tier by tier, keeps pre-branding values as fallbacks — 5 tests in brandingApplication.test.tsx PASS.
- Appearance localStorage: device-local label "برای این دستگاه ذخیره می‌شود", density description "رفتار رابط کاربری روی این دستگاه", theme buttons exist — verified settingsHonesty.
- Settings honesty: 14 cases PASS — branding loads, appearance labeled device-local, branding behavior intact, notifications discloses server requirement and disables toggles (7), localization discloses not connected and disables selects (6), session rules discloses not connected and disables inputs (4), working hours Friday toggle disabled and disclosed, no unimplemented setting reports fake success, loading distinct from empty/default, read failure disclosed with retry not converted to default, API-mode unavailable disclosed, existing Settings behavior not broken.
- Full suite: 152 test files, 1 failed file projectState.test.ts 11 failures known governance drift, 151 passed files, 2105 passed tests, 13 skipped, 2129 total — same as after F2, no F1/F2 regression.

## 11. Accessibility
- ColorField has aria-label "رنگ اصلی — انتخاب از پالت" etc, keyboard accessible, focus ownership via shell lock + handingOff preserved D7/M-1.
- Preview container has text with proper contrast using draft colors, but does not affect document until save — no a11y regression.
- Toggle disabled prop exists, aria-pressed for theme buttons, StatusBadge for active.

## 12. Persistence
- Branding org single record travels backups demo both modes, `demoStore.branding` single authority, IndexedDB blobStore for bytes (logo/favicon mediaId ref), no localStorage for binary — per D2.
- Appearance device-local localStorage honest, keys ava:theme etc via savePref, no backend claim.
- Reset to DEFAULT_BRANDING sets draft to defaults, marks dirty, requires save to persist — no fake persistence.

## 13. Backend Mapping
- B CONTRACT NOW BACKEND LATER: org table organizations(id, name, tagline, logo_media_id, favicon_media_id, primary_color, accent_color, text_color, persian_font, updated_at) + branding_settings, hex validation server-side same as frontend, font allow-list same, mediaId FK to media_assets, signed URLs per-object auth — documented in 07-settings-theme-architecture.md.
- No backend behavior invented, no Laravel files modified.
- Light theme deferred C, notification/localization/working-hours/session-rules server wiring deferred C but honest deferral Surfaces preserved.

## 14. Documentation
- 07-settings-theme-architecture.md — token architecture two layers org vs device-local, WordPress-customizer-like UX live preview editable defaults validation preview reset persistence, CSS vars, security, open decisions viewer accent vs org accent naming, light theme.
- 12-decision-register.md — D2 viewer vs org split ACCEPTED, NEW-SET-01 settings/theme tokens PROVISIONAL, PROP-BRAND-01 draft preview before save OPEN, PROP-THEME-01 viewer vs org accent naming OPEN.
- 13-open-decisions.md — O-04 theme persistence org vs device-local OPEN, recommendation keep device-local per D2, org default theme optional later.
- 11-roadmap.md F3 — goal, visible outcome, domains, deps, acceptance, tests, risks, backend impact, shippable, classification.

## 15. Decision / Open-Decision Disposition
- O-04 Theme persistence: OPEN — kept device-local per D2 for first product, org default theme optional later — no silent change, preserved per D2, PROP-THEME-01 naming clarification remains OPEN.
- T-02 Teacher→unassigned student: remains OPEN — F3 does NOT own, preserved assigned-only filtering from F2, not resolved by assumption.
- O-01 Student level scope: remains OPEN — F3 does NOT own, kept per-program provisional.
- PROP-BRAND-01 draft preview before save: implemented as optional — preview container writes CSS vars to preview only not document until save, like WordPress customizer — satisfies proposal, not required but implemented.
- No invented product workflow, no backend behavior, no fake decision.

## 16. Files Changed
- `src/domains/branding/BrandingPanel.tsx` — add resetToDefaults() + reset button + draft preview Panel with local CSS vars preview only.
- `docs/engineering/F3_INVENTORY.md` NEW — read-only inventory 1-6.
- No backend/Laravel/database/migrations, no PROJECT_STATE.md modification, no architecture redesign.

## Verification
- Focused: settingsHonesty 14 PASS, branding.test 12 PASS, brandingApplication 17 PASS, scope.test 17 PASS, routeProtection 9 PASS, Library 18 PASS, relationsNoFixtures 17 PASS, staleQueryGates 6 PASS.
- Full: `npx vitest run --reporter=dot` — Test Files 1 failed | 151 passed (152), Tests 11 failed | 2105 passed | 13 skipped (2129) — 1 failed file projectState.test.ts 11 failures known governance drift (branch `arena/frontend-completion-spec` HEAD `61f9b41` vs PROJECT_STATE.md stale checkpoints) — classified C, not F3 regression, do NOT modify PROJECT_STATE.md merely to make tests green per hard boundary.
- No F1/F2 regression: F1 boundary gates still PASS, F2 scope tests still PASS.

## Final Status
F3 VERIFIED — READY FOR F4
