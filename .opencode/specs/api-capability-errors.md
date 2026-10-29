# Spec — API capability availability & error classification

**Status:** CURRENT · **Authority:** the code named below, plus `backend/routes/api.php`.
Re-verified against source and tests on 2026-10-29.

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

**None.** `UNAVAILABLE_DOMAINS` (`src/domains/shared/unavailableDomains.ts`) is an empty
list, and `src/domains/registry.client.ts` wires every domain to its `Api*` repository.
The mechanism is kept on purpose: `createUnavailableRepository` / `DOMAIN_UNAVAILABLE` still
back Finance in the demo composition (`src/domains/registry.ts`), and a domain that lost its
server route would reappear in that one list. Verify the list in code before relying on it —
it is the single enumeration and it changes.

Controls whose contract does not exist are a separate seam: the client target's
`unavailableActions` (`src/targets/targetCopy.client.ts`) currently holds `finance-export`,
`reports-export`, `portals` and `notifications`; the demo target's set is empty.

**Rooms** are served and authorized like any other domain. PB-3 is lifted for them
(DECISIONS §35): `rooms.read` is granted to every role and `rooms.write` to administrator
and manager (`RoomPolicy`, `backend/config/permissions.php`). A refused room write is an
ordinary *policy* refusal for an actor without the id, not a blanket block.

**Served** (see `backend/routes/api.php` for the live list): auth, users, roles, teachers,
students, classes, enrollments, sessions, attendance (incl. corrections), rooms,
instruments, learning, chat, branding, gallery, compensations, invoices, resources
(metadata), media (metadata and authorized bytes — see below), pieces, piece-assignments,
progress-events, progress-overview, student assignments, organization.

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

- **Reports** has no domain and no server route (**I2 / D6**, deferred):
  `src/domains/reports/` is README-only, and the view must keep showing an explicit
  deferral, not a fabricated figure.
- **Finance** differs by composition. The client serves invoices v1 (`GET/POST /invoices`,
  `PATCH /invoices/{id}`, `POST /invoices/{id}/pay`; DECISIONS §40–§41 with `finance.read`,
  `finance.write`, `finance.pay`; no partial payments, no balance sync). The demo
  composition keeps Finance deferred. Anything beyond invoices (exports, payment plans,
  balances) has no contract; `finance-export` stays in the client's `unavailableActions`.
- **File bytes** travel through the media domain, not through resources: `POST /media`
  stores a file and `GET /media/{id}/bytes` returns it, authorized against the record that
  references the asset (`MediaPolicy::authorizeReadAsset`, org-scoped). The Library and
  Gallery views use that path (`MediaRepository`, `useMediaObjectUrl`). The contract's own
  `POST /uploads` and `GET /resources/{id}/download` are still not routed
  (`backend/tests/Feature/ResourceTest.php` asserts it).
- `docs/engineering/OPEN_ITEMS.md` holds the live list of open capability work. Read it
  before claiming a capability is missing.
