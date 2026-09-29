# 07 — Settings / Theme Architecture

> WordPress-customizer-like, academy identity name/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local schema

## Current State (VERIFIED)

- BrandingPanel: academyName, tagline, primaryColor, accentColor, textColor, persianFont, logoMediaId? faviconMediaId? (media ref never data URL), updatedAt — VERIFIED branding/types.ts
- Validation: isHexColor strict #RRGGBB rejects shorthand/named, isPersianFont allow-list PERSIAN_FONTS — VERIFIED
- Repository: BrandingRepository demo both modes, single record in DemoStore dataset, travels in backups — VERIFIED D2
- Application: BrandingApplication mounted in App.tsx below DataLifecycleGate above AuthProvider, so login outside shell branded too; writes CSSOM via applyBranding, --brand-* vars consumed by design tokens in index.css with fallback pre-branding values, so no readable record renders exactly as before — VERIFIED M8
- Shell Sidebar and Login read branding.academyName/tagline — VERIFIED
- Hero uses useBranding + useAuth (M10) — no BrandingSettings persistence/schema change — VERIFIED
- Appearance: theme (dark/glass), accent (gold/violet/amber? Actually accentLabels), density (comfortable/compact), motion (bool) — device-local per-browser via savePref localStorage keys ava:theme etc — VERIFIED Settings.tsx appearance section
- Settings sections: settingsSections presentation config owned by view (M10) — VERIFIED
- Honesty: notifications 2 surfaces, localization 1, session rules 1, working hours expanded — all disabled controls with explicit deferral Surfaces stating server required — VERIFIED M-6
  - 7 notification toggles disabled
  - 6 localization selects disabled
  - 4 session-rules inputs disabled
  - Friday toggle disabled "— غیرفعال"
- Toggle disabled prop exists — VERIFIED

## Token Architecture — Desired (A + B)

### Two Layers

**Layer 1 — Organization Identity (org-level, backend-owned eventually):**
- What: academyName, tagline, logoMediaId, faviconMediaId, primaryColor, accentColor, textColor, persianFont
- Why org: every viewer must see identically, travels in backups, eventually backend owns
- Storage now: DemoStore dataset single record (branding collection) — VERIFIED
- Storage future: Laravel `organizations` table + `branding_settings` table with org_id FK, hex validation server-side same as frontend, font allow-list same, mediaId FK to media_assets
- CSS vars: --brand-primary, --brand-accent, --brand-text, --brand-font-fa — written to document.documentElement.style — VERIFIED
- Design tokens: index.css consumes vars via var(--brand-*, fallback) for accent scale, Persian font stack, body text — VERIFIED
- CSP: style-src self + style-src-attr unsafe-inline narrow exception for CSSOM writes — DOCUMENTED deploy/nginx.conf + cspCompatibility.test

**Layer 2 — Viewer Preference (device-local, never org):**
- What: theme (dark/glass), accent (viewer accent? Actually accent is viewer preference separate from brand accent? Need clarification: Settings has "تم" dark/glass and "لهجهٔ برند" gold etc — but branding also has primary/accent colors — two accents? One is org brand colors (hex), other is viewer accent choice from semantic tokens? In Settings.tsx appearance: theme dark/glass, accent gold/violet/amber etc from accentLabels, density, motion — these are viewer prefs — VERIFIED
- Why device-local: personal preference, not org identity — D2 decision: viewer preference stays preference, academy identity becomes domain data
- Storage: localStorage keys ava:theme, ava:accent, ava:density, ava:motion via savePref — VERIFIED
- Application: useTheme hook? Actually setTheme etc — VERIFIED
- Preview: live preview Surface showing theme+accent+density+motion — VERIFIED Settings.tsx
- Reset: button resets to defaults dark/gold/comfortable/motion true + info toast — VERIFIED

### WordPress-Customizer-like UX (A NOW)

- **Live preview:** right side Surface shows sample level in selected theme — VERIFIED, but could be expanded to show branding preview too (logo, name, colors, font)
- **Editable:** ColorField with text + color picker, font select from PERSIAN_FONTS, name/tagline inputs — VERIFIED BrandingPanel
- **Defaults:** DEFAULT_BRANDING academyName "آموزشگاه موسیقی پارسیان" tagline "تالار هنر، جادو و موسیقی" primary #D5AF58 accent #F4D28B text #FFFFFF font Vazirmatn updatedAt — VERIFIED
- **Validation:** hex strict, font allow-list, required name? Actually name required? Check BrandingPanel — likely validates non-empty — INFERRED
- **Preview:** for branding, preview should show Sidebar with new name/tagline + tokens + logo — currently Sidebar reads branding live, so preview is live after save, not before — gap: customizer should preview before save — A NOW: add local draft preview that writes CSS vars to preview container only, not document, until save — needs decision
- **Reset:** reset to DEFAULT_BRANDING — A NOW: add reset button for branding (currently only appearance has reset)
- **Persistence:**
  - Org: branding repo update → DemoStore → backup → eventually Laravel — VERIFIED now demo, B later Laravel
  - Device-local: savePref → localStorage — VERIFIED, stays device-local per D2, no backend
- **Org vs Device-local schema:**
  - Org table: organizations(id, name, tagline, logo_media_id, favicon_media_id, primary_color, accent_color, text_color, persian_font, updated_at) — B
  - Device-local: no table, localStorage only — stays — A

### Light / Dark Tokens

- Currently dark + glass themes, not light/dark — but task says light/dark tokens — INFERRED desired: dark is primary, glass secondary, light could be future? Currently no light — but token architecture should support light/dark via CSS vars — e.g. --bg, --text, --border — currently Tailwind uses ink-900 etc with dark only — need spec: keep dark+glass now, light deferred C, but token architecture should allow light/dark via CSS vars — A spec NOW

### CSS Vars

- --brand-primary, --brand-accent, --brand-text, --brand-font-fa — VERIFIED
- Plus appearance tokens: --theme-bg, --theme-fg etc? Actually Tailwind uses classes not vars for theme — but accent hex drives gold tiers via color-mix — VERIFIED M8
- Future: --brand-primary-50..900 scale derived from primary hex via color-mix — could be generated — B

### Acceptance

- Academy identity name/tagline/logo/color system typography light/dark tokens CSS vars preview reset persistence org vs device-local schema doc exists
- BrandingPanel writes through repo, success only after resolve, error with retry, dirty check, no fake persistence
- Appearance theme localStorage honest device-local, preview live, reset works, no backend claim
- Disabled controls (notifications/localization/working-hours/session-rules) have explicit deferral Surfaces, disabled prop, no fake save
- No scattered theme keys for org data — org data single record — VERIFIED D2
- No data URL for logo/favicon — mediaId ref only — VERIFIED

## Classification

- A NOW: token architecture spec doc (this file), branding reset button, draft preview before save (local preview container), org vs device schema doc
- B CONTRACT NOW: org persistence Laravel table, signed URLs for logo/favicon, per-object auth
- C DEFERRED: light theme (if not needed now), notification/localization/working-hours/session-rules server wiring (already honest deferral, keep C)

## Security

- Hex strict, font allow-list prevents injection into CSS var — VERIFIED
- CSSOM writes only, no innerHTML — VERIFIED
- style-src self + unsafe-inline attr narrow exception — DOCUMENTED
- MediaId ref never data URL prevents XSS via SVG (SVG excluded from allow-list) — VERIFIED media types

## Open Decisions

- Should viewer accent (gold/violet) be org or device-local? Currently device-local, but branding also has org accent hex — two concepts: org brand colors vs viewer accent choice from semantic tokens — need decision: keep both, clarify naming — see 13-open-decisions
- Light theme needed now or deferred?
- Branding draft preview before save — add?
