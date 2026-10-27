# Spec — API capability availability & error classification

**Status:** CURRENT · **Authority:** the code named below, plus `backend/routes/api.php`.

## Three facts that must not be blurred

| Class | Means | Retry helps? | Where it is produced |
|---|---|---|---|
| **unavailable** | the capability has no server implementation | no | `DOMAIN_UNAVAILABLE` — `src/domains/shared/unavailableRepository.ts` |
| **policy** | the endpoint exists and refused on purpose (403, e.g. an owner decision is pending) | no | `ApiError` with `kind: "authorization"` |
| **failure** | network, 5xx, anything unexpected | yes | anything else |

`classifyError()` and `blockingFailure()` live in `src/domains/shared/errorAvailability.ts`.
A read that only *decorates* a page (a room name beside a class) must degrade to "no data"
when the capability is unavailable or policy-blocked, and must only stop the page on a real
failure. Never render "server not connected" for a policy refusal — the server is connected.

## Currently unserved in the client composition

`UNAVAILABLE_DOMAINS` (`src/domains/shared/unavailableDomains.ts`): `instruments`,
`learning`, `chat`, `media`, `branding`, `gallery`, `compensation`.
Verify the list in code before relying on it — it is the single enumeration and it changes.

**Rooms** are a third case: routed and implemented, but blocked for every actor by
`RoomPolicy` (PB-3, unresolved) → the client sees a *policy* refusal, not an unavailable
capability.

**Served** (see `backend/routes/api.php` for the live list): auth, users, roles, teachers,
students, classes, enrollments, sessions, attendance, resources (metadata only — the bytes
are not served), pieces, piece-assignments, progress-events, progress-overview,
student assignments, organization.

## Rules

- **No demo fallback in API mode.** An unserved domain resolves to the unavailable
  repository — never to local data, never to a speculative endpoint.
- **A control whose contract does not exist must not be offered.** Ask the target seam
  (`unavailableActions` in `@/targets/targetCopy`) instead of shipping a button that can
  only fail after it is used.
- **Empty is not an error.** An empty list is a fact; a failed read is a different fact.
  Do not present "no rows" as a measurement when the read never succeeded.
- **Unknown is not zero.** A metric whose read failed stays unknown (`null` / "—"), never
  `0`.

## Unresolved

- Finance and Reports have no domain/server contract (**I2 / D6**, deferred) — the views
  must keep showing an explicit deferral, not a fabricated figure.
- Library file bytes (`POST /uploads`, download) are not routed; `mediaId` is an opaque
  reference today.
- `docs/engineering/OPEN_ITEMS.md` holds the live list of open capability work. Read it
  before claiming a capability is missing.
