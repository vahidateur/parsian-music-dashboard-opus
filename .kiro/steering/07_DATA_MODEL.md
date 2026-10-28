---
inclusion: always
---

# 07 — DATA MODEL

> The legacy `19_CONTENT_MODEL.md` (Teacher/Course/Instrument/Blog/Gallery/Event with
> slug/SEO/hero fields) was modeled for a **public marketing website**. It is kept as
> **product/historical modeling guidance only** and does **not** describe the current panel's
> implemented data. No schema change is proposed or made here.

## Current implemented domains (CURRENT — see `src/domains/`)

attendance · auth · branding · chat · classes · compensation · demo · enrollments · export ·
finance · gallery · import · instruments · learning · library · media · messaging ·
notifications · organization · progress · reports · rooms · scheduling · shared · students · teachers.

Each domain owns one entity shape and a repository contract with `Local*`/`Api*` implementations
(see `01_CURRENT_ARCHITECTURE.md`). The canonical type lives in the domain (e.g.
`src/domains/students/types.ts`), not in a shared fixture module (the old `records.ts`/`academy.ts`
fixtures were dissolved at M10).

## Legacy entities mapped to current reality

| Legacy entity (19_CONTENT_MODEL) | Status | Current reality |
|---|---|---|
| Teacher (profile/hero/quote/features) | **PARTIAL / HISTORICAL** | `teachers` domain exists; marketing hero/quote/scene/SEO fields are HISTORICAL (public-site), not panel data. |
| Course | **ADAPT** | Closest current concepts are `classes` + `learning` + `enrollments`; there is no public "Course" entity with slug/SEO. |
| Instrument | **IMPLEMENTED (partial)** | `instruments` domain (catalog sync); marketing slug/SEO fields not applicable. |
| Blog | **OBSOLETE / FUTURE** | No blog in the panel; public-site concept only. |
| Gallery | **IMPLEMENTED (partial)** | `gallery` domain exists; backend genuineness is an open item (see `12_ROADMAP.md`). |
| Event | **FUTURE** | Not an implemented panel domain. |
| `slug` / `seo` / `og_image` per entity | **OBSOLETE for panel** | A private panel is not indexed (`docs/security.md`); SEO/slug are public-site concerns. |

## Current-only concepts not in the legacy model (CURRENT)

`progress`, `compensation`, `library` (resources), `media`, `messaging`/`chat`, `notifications`,
`organization`, `export`, `import`, `finance`, `reports`, `scheduling`, `attendance` — these are
the real product surfaces and supersede the legacy content model.

## Rules that still hold (ADAPT)

- Fixed value sets → enums; monetary values → integers (smallest unit).
- One owner per entity shape; no duplicate type definitions.
- Any actual schema/migration work is **BACKEND** and requires owner authorization
  (`06_SECURITY_BACKEND.md`); several schema-shaping decisions remain **OPEN** (`12_ROADMAP.md`).
