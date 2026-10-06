---
inclusion: always
---

# 04 — ACCESSIBILITY & RESPONSIVE

> Preserves legacy `09_ACCESSIBILITY.md` and `10_RESPONSIVE.md` principles, re-expressed
> for React. Alpine-specific mechanics are **OBSOLETE**; everything else is **CURRENT/ADAPT**.

## Accessibility (CURRENT/ADAPT)

- Full keyboard navigation on every interactive element; semantic elements
  (`<a>` for navigation, `<button>` for actions).
- Visible focus ring; never `outline: none` without a replacement.
- `aria-current="page"` on the active nav item; `aria-label` on icon-only buttons.
- Dialog/drawer: `role="dialog"`, `aria-modal="true"`, **React-managed focus trap**, ESC to close,
  focus returned to the trigger. (Replaces legacy `@alpinejs/focus`/`x-trap` — **OBSOLETE**.)
  The shipped behavior is covered by tests such as `commandPaletteFocusReturn`.
- `aria-hidden="true"` on decorative layers; meaningful images get `alt`, decorative get `alt=""`.
- Logical heading structure (one `h1`, then `h2`/`h3`).
- Honor `prefers-reduced-motion`.
- Contrast target WCAG AA. **Note:** full WCAG conformance requires manual testing with assistive
  technology and expert review — treat automated checks as necessary, not sufficient.

## Responsive (CURRENT/ADAPT)

- Mobile-first; RTL complete via logical properties.
- No horizontal overflow at any size; containers/images capped so large monitors do not stretch.
- Touch targets ≥ 44×44px on mobile; responsive font/spacing where needed.
- Legacy breakpoints (Mobile <768 · Tablet 768–1023 · Laptop 1024–1279 · Desktop ≥1280) and the
  manual test widths (390/430/768/1024/1366/1600/1920) are retained **only as compatible QA
  guidance**. The actual breakpoint tokens live in `src/index.css` (e.g. `--breakpoint-wide: 1400px`)
  and are authoritative; do not invent new breakpoints in steering.

## Verification status (CURRENT — honest)

**Browser/visual QA is NOT VERIFIED** as a formal disposition across the current line
(`docs/engineering/PROJECT_STATE.md`). Accessibility and responsive behavior that is not
covered by an automated test should be reported as *unverified*, never as done.
