# F3 — READ-ONLY INVENTORY — Settings + Theme Editor

> Branch: `arena/frontend-completion-spec` HEAD `8aff3a2` (F2 VERIFIED) previous `e11593b` F1 fix, planning `e57bf19`, PR #4 OPEN UNMERGED, freeze `a3867a6` preserved — F2 VERIFIED/CLOSED — F3 AUTHORIZED — strict read-only inventory, no code modification.

## 1. F3 Goal from Canonical Roadmap (11-roadmap.md F3)

- **Goal:** WordPress-customizer-like academy identity name/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local schema
- **Visible outcome:** BrandingPanel has reset to DEFAULT_BRANDING, draft preview before save (local preview container writes CSS vars to preview only not document until save) — proposal PROP-BRAND-01 optional, appearance device-local stays per D2, org vs device schema doc, academyName/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence
- **Domains:** branding/types + useBranding + BrandingPanel + BrandingApplication + index.css tokens, settings/Settings.tsx appearance prefs savePref localStorage ava:theme etc, media logo/favicon mediaId ref never data URL, ds primitives
- **Dependencies:** branding types already, D2 viewer vs org split (appearance device-local, branding org)
- **Acceptance:** academy identity name/tagline/logo/color system typography light/dark tokens CSS vars --brand-* fallback pre-branding, editable defaults validation hex strict #RRGGBB font allow-list PERSIAN_FONTS, preview live (draft preview container optional), reset to defaults, persistence org vs device-local schema (branding org single record travels backups demo both modes, appearance device-local localStorage honest), disabled controls notifications 7 toggles localization 6 selects session-rules 4 inputs working-hours expanded Friday toggle disabled — all disabled with explicit deferral Surfaces honest, Toggle disabled prop exists, application below lifecycle gate above AuthProvider so login outside shell branded too, Sidebar/Login read branding.academyName/tagline, Hero uses useBranding + useAuth M10 no BrandingSettings persistence/schema change
- **Tests:** branding validation hex + font allow-list, CSS vars fallback, appearance localStorage, settingsHonesty.test 14 cases
- **Risks:** viewer accent vs org accent naming confusion O-04 — decision needed keep both clarified PROP-THEME-01, light theme deferred C, branding draft preview before save optional
- **Backend impact:** org table organizations + branding_settings + mediaId FK + signed URLs per-object auth — B contract REQUIRED but implementation deferred until backend/integration layer
- **Classification:** A spec + reset + draft preview NOW, B org persistence LATER — org identity REQUIRED

## 2. F3 Domains/Slices

- **Branding Identity:** `src/domains/branding/types.ts` (DEFAULT_BRANDING, PERSIAN_FONTS, isHexColor, isPersianFont), `useBranding.ts` (applyBranding, CSS vars), `BrandingPanel.tsx` (draft, dirty, save), `BrandingApplication.tsx` (mounted in App.tsx below DataLifecycleGate above AuthProvider), `demoRepository.ts` (validation hex strict, font allow-list), `index.css` tokens consuming --brand-* with fallback
- **Appearance Viewer Preference:** `src/views/Settings.tsx` appearance section (theme dark/glass, accent gold/violet/amber, density comfortable/compact, motion bool), `src/lib/theme.ts` (accentLabels, accentHex), `src/context/AppContext.tsx` (theme, setTheme, accent, setAccent, density, setDensity, motion, setMotion, savePref localStorage ava:theme etc), preview Surface live, reset to defaults
- **Disabled Honest Controls:** notifications 7 toggles disabled, localization 6 selects disabled, session-rules 4 inputs disabled, working-hours Friday toggle disabled + expanded working hours inputs? — all with explicit deferral Surfaces honest per M-6
- **Token Architecture:** CSS vars --brand-primary, --brand-accent, --brand-text, --brand-font-fa, plus appearance tokens via Tailwind classes, fallback pre-branding values, CSP style-src self + unsafe-inline attr narrow exception

## 3. Current Implementation State

### Branding Identity
- **Status:** partial — types complete (DEFAULT_BRANDING academyName "آموزشگاه موسیقی پارسیان" tagline "تالار هنر، جادو و موسیقی" primary #D5AF58 accent #F4D28B text #FFFFFF font Vazirmatn, PERSIAN_FONTS 4, isHexColor strict #RRGGBB, isPersianFont allow-list), repository demo both modes single record travels backups, validation hex strict + font allow-list, application below lifecycle gate above AuthProvider writes CSSOM via applyBranding --brand-* vars consumed by index.css with fallback — complete, Sidebar/Login read branding.academyName/tagline, Hero uses useBranding + useAuth — complete, BUT reset to DEFAULT_BRANDING missing (no reset button in BrandingPanel), draft preview before save missing (preview is live after save only, not before — gap per PROP-BRAND-01 optional), logo/favicon mediaId ref never data URL — complete but upload UI says needs object storage, honest Surface.
- **Source of truth:** `demoStore.branding` single record via `DemoDataset.branding` seed, `BrandingSettings` type
- **Repo seams:** `BrandingRepository` demo both modes, `getBrandingRepository`, `useBranding` hook with loading/error/retry, `DEFAULT_BRANDING` constant
- **Tests:** `settingsHonesty.test.tsx` branding panel loads and shows academy name, branding behavior intact update persists and survives reload, loading distinct from empty/default, read failure disclosed with retry — PASS

### Appearance Viewer Preference
- **Status:** complete — theme dark/glass, accent gold/violet/amber etc from accentLabels, density comfortable/compact, motion bool device-local via savePref localStorage keys ava:theme etc, preview live Surface showing sample level in selected theme, reset button exists (بازنشانی به پیش‌فرض) resets to dark/gold/comfortable/motion true + info toast — complete per D2, labeled as device-local "برای این دستگاه ذخیره می‌شود", no backend claim.
- **Source of truth:** localStorage ava:theme etc via `savePref`, `AppContext` theme state
- **Repo seams:** none — device-local only, no repository, per D2
- **Tests:** settingsHonesty appearance section labeled as device-local, not server-persisted, theme buttons exist — PASS

### Disabled Honest Controls
- **Status:** complete — notifications 7 toggles disabled with deferral Surface "اعلان‌ها نیازمند سرور است — دامنهٔ اعلان‌ها هنوز پیاده‌سازی نشده و این تنظیمات ذخیره نمی‌شود. ... صرفاً نمایشی", localization 6 selects disabled with Surface "بومی‌سازی هنوز به دامنهٔ تنظیمات متصل نشده ... صرفاً نمایشی", session-rules 4 inputs disabled with Surface "قواعد جلسه هنوز به دامنهٔ زمان‌بندی متصل نشده ... صرفاً نمایشی", working-hours Friday toggle disabled "— غیرفعال" + expanded working hours inputs disabled with Surface "ساعات کاری هنوز به دامنهٔ زمان‌بندی متصل نشده ... صرفاً نمایشی" — all disabled with explicit deferral, Toggle disabled prop exists — complete per M-6, 14 cases in settingsHonesty.test PASS.

### Token Architecture
- **Status:** partial — CSS vars --brand-primary, --brand-accent, --brand-text, --brand-font-fa written to document.documentElement.style via applyBranding, isHexColor guard prevents injection, index.css consumes vars via var(--brand-*, fallback) for accent scale, Persian font stack, body text — complete, fallback pre-branding values — complete, CSP style-src self + unsafe-inline attr narrow exception documented in deploy/nginx.conf + cspCompatibility.test — complete, BUT light/dark tokens: currently dark + glass themes, not light/dark per task — light theme deferred C, token architecture should support light/dark via CSS vars --bg --text --border but currently Tailwind uses ink-900 etc dark only — gap but C deferred, not blocking F3; viewer accent vs org accent naming confusion O-04 remains OPEN per PROP-THEME-01.

## 4. Dependencies/Blockers

- **No blocker for branding reset**: DEFAULT_BRANDING exists, repository update exists, dirty check exists, save exists — reset is simply setDraft(toDraft(DEFAULT_BRANDING)) + save or local reset + dirty true — frontend-only, no backend.
- **No blocker for draft preview before save (PROP-BRAND-01 optional)**: draft state exists, CSS vars application exists via applyBranding, but currently writes to document only on save via BrandingApplication reading persisted branding. For draft preview, need local preview container that writes CSS vars to preview only (e.g., div with style) not document until save — requires new component BrandingPreview that takes draft and applies vars to its own style, not document — frontend-only, no backend, optional per roadmap.
- **No blocker for appearance**: already complete, reset exists.
- **Potential blocker for O-04 theme persistence org vs device**: O-04 OPEN — should theme be org or device-local? Currently appearance device-local per D2, branding org — task says theme editor WordPress-customizer-like academy identity — D2 decision says viewer preference stays preference, academy identity becomes domain data — so O-04 should keep device-local for first product per D2, org default theme optional later — no change required for F3, keep OPEN but implement per D2.
- **No blocker for disabled controls**: already honest, no fake save, no new workflow.
- **T-02 remains OPEN unless F3 explicitly owns its product decision**: F3 does NOT own T-02 (F2 owns RBAC), so T-02 remains OPEN, do NOT resolve in F3 — preserve assigned-only filtering implemented in F2.
- **O-01 remains OPEN unless F3 explicitly owns it**: F3 does NOT own O-01 (student level scope per-program vs global) — keep OPEN per-program provisional, do NOT resolve.

## 5. Exact Files Likely to Change

- `src/domains/branding/BrandingPanel.tsx` — add reset to DEFAULT_BRANDING button, add draft preview container (optional PROP-BRAND-01) that writes CSS vars to preview only not document until save, dirty check, save via repo, loading/error/retry preserved.
- `src/domains/branding/types.ts` — no change expected (DEFAULT_BRANDING, PERSIAN_FONTS, isHexColor already), but may add helper for reset if needed.
- `src/domains/branding/useBranding.ts` — no change expected, but may add draft preview helper that applies vars to element ref not document.
- `src/views/Settings.tsx` — appearance section already has reset, but may add branding reset integration or ensure branding preview container uses draft vars; disabled controls already honest, no change.
- `src/lib/theme.ts` — accentLabels, accentHex already, no change unless PROP-THEME-01 naming clarification.
- `src/index.css` — tokens consuming --brand-* with fallback already, no change unless light/dark tokens added (C deferred).
- `src/domains/branding/__tests__/` — add branding validation hex + font allow-list tests, CSS vars fallback tests, reset tests.
- `src/views/__tests__/settingsHonesty.test.tsx` — 14 cases already PASS, may add reset test for branding.

## 6. Implementation Order

1. **F3-1 Branding Reset to DEFAULT_BRANDING**
   - Goal: BrandingPanel has reset button that sets draft to DEFAULT_BRANDING and marks dirty, save via repo, success only after resolve, error with retry, dirty check preserved.
   - Files: `BrandingPanel.tsx`, `types.ts` (DEFAULT_BRANDING already), `useBranding.ts`
   - Tests: branding reset sets draft to defaults, dirty true, save persists, survives reload, loading distinct, failure disclosed.
   - DoD: product behavior reset functional, domain model single source, source of truth demoStore, repo contract, demo behavior, API seam, permissions (settings.read/write), loading/empty/error, test strategy, a11y, persistence org, backend mapping B, documentation, decision disposition.

2. **F3-2 Draft Preview Before Save (PROP-BRAND-01 optional)**
   - Goal: WordPress-customizer-like live preview — draft preview container writes CSS vars to preview only not document until save, like customizer, prevents accidental org-wide change without preview.
   - Files: `BrandingPanel.tsx` — add `BrandingPreview` component that takes draft and applies vars to its own div style (not document), shows Sidebar sample with new name/tagline + tokens + logo placeholder; save writes repo which then updates document via BrandingApplication.
   - Tests: draft preview does not affect document until save, preview shows draft name/tagline/colors/font, save updates document, reset clears preview.
   - DoD: preview live but isolated, no fake persistence, honest states.

3. **F3-3 Token Architecture + Org vs Device Schema Doc**
   - Goal: Ensure CSS vars --brand-* fallback pre-branding, hex strict #RRGGBB, font allow-list, org vs device-local schema documented, viewer accent vs org accent naming clarified per PROP-THEME-01 (optional).
   - Files: `types.ts`, `useBranding.ts`, `index.css`, `07-settings-theme-architecture.md` (doc already exists, but ensure code matches D2 split).
   - Tests: hex validation rejects shorthand/named, font allow-list, CSS vars fallback, appearance localStorage device-local label.
   - DoD: security hex strict prevents injection, no data URL for logo/favicon, CSP narrow exception preserved.

4. **F3-4 Disabled Controls Honesty Preservation**
   - Goal: Verify notifications 7 toggles, localization 6 selects, session-rules 4 inputs, Friday toggle disabled all with explicit deferral Surfaces honest, no fake save, Toggle disabled prop — already complete per M-6, but ensure no regression from F3-1/F3-2.
   - Files: `Settings.tsx` — no change expected, but verify.
   - Tests: `settingsHonesty.test.tsx` 14 cases PASS.

**Order rationale**: Reset first (leaf, no dependency, required visible outcome), then draft preview (depends on reset + draft state, optional but improves UX), then token architecture doc + naming clarification (depends on reset/preview), then disabled controls verification (leaf, ensures no regression).

**Blockers requiring decision**: None for F3-1, F3-3, F3-4 — all frontend-only. For F3-2 draft preview, need decision: should preview write to document live (current after save) or to preview container only before save? PROP-BRAND-01 proposes preview container only until save — optional, nice to have, not blocking first usable — can implement as optional, keep current live-after-save as fallback if product wants simpler. So no blocker, can proceed with reset first.

**No files modified during inventory — read-only verified.**
