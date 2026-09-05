# Authentication, Users & RBAC

Status labels: **IMPLEMENTED** · **PARTIAL** · **DEMO ONLY** · **BACKEND REQUIRED** · **FUTURE**

## Security statement (read first)

This is **demo authentication running entirely in the browser**. It is *not* security.

- The session lives in `localStorage` under `ava:demo:session`. Any user can edit it with devtools.
- The demo "token" (`demo_<32 hex>`) is random client-side bytes. It is **not a JWT** and is not signed or verified by anything.
- Roles and permissions are evaluated **in the client**. Client-side role checks are UI affordance, not authorization. A determined user can bypass every check in this codebase.
- Demo accounts share the passphrase `arena-demo`. It is a **development-only, non-secret** value, deliberately committed so the demo is reproducible.
- No password is stored anywhere, hashed or otherwise. The demo repository compares against the constant above and never persists credential material. Backups never contain credentials or sessions.

**BACKEND REQUIRED:** real authentication (password hashing, session/token issuance, expiry, revocation) and real authorization (per-endpoint permission enforcement) must be implemented server-side. The client contracts below are shaped so that swapping in a server implementation requires no view changes.

## Architecture — IMPLEMENTED

```
View → useAuth()/useUsers()  →  AuthRepository / UserRepository  →  Demo | Api
                                        ↑ chosen in src/domains/registry.ts
```

| File | Role |
| --- | --- |
| `src/domains/auth/types.ts` | `AuthUser`, `Session`, `RoleId`, `AuthError` shapes |
| `src/domains/auth/permissions.ts` | Single source of truth for the permission matrix |
| `src/domains/auth/repository.ts` | `AuthRepository` / `UserRepository` interfaces |
| `src/domains/auth/demoAuthRepository.ts` | DEMO ONLY implementation over `demoStore` |
| `src/domains/auth/apiAuthRepository.ts` | BACKEND REQUIRED implementation over `ApiClient` |
| `src/domains/auth/userRepository.ts` | User CRUD, demo + API variants |
| `src/domains/auth/AuthContext.tsx` | `AuthProvider`, `useAuth()` |
| `src/domains/auth/useUsers.ts` | User-administration hook |
| `src/views/Login.tsx` | Persian-first RTL login screen |
| `src/components/settings/UsersPanel.tsx` | Users + roles administration UI |

Views never touch `localStorage`, `fetch`, or store internals.

## Permission matrix — IMPLEMENTED

Permission ids are `<domain>.<action>`. `X.write` always implies `X.read` (enforced by test).

| Role | Summary |
| --- | --- |
| `administrator` | All permissions, including `users.write`, `roles.write`, `demo.manage` |
| `manager` | Everything except `finance.write`, `users.write`, `roles.write`, `demo.manage` |
| `teacher` | Core reads + `attendance.*` + `messages.*` |
| `staff` | Core reads + `students.write`, `schedule.write`, `attendance.read`, `messages.*`, `reports.read` |
| `accountant` | `students.read`, `classes.read`, `finance.*`, `reports.read`, `messages.read` |

`viewPermissions` maps every `ViewId` to its required permission, so navigation, the command palette, and route protection all derive from one table. There are no scattered `role === "admin"` checks.

## Route protection — IMPLEMENTED

`AuthProvider → AuthGate → AppProvider → Shell`. Unauthenticated users see `Login`; the intended hash destination is preserved across login, so deep links survive. `ViewOutlet` re-checks the view permission and renders an unauthorized state rather than redirecting, which avoids redirect loops. Covered by `src/__tests__/routeProtection.test.tsx`.

## Demo accounts — DEMO ONLY

Passphrase for all: `arena-demo`.

| Email | Role |
| --- | --- |
| `admin@demo.local` | administrator |
| `manager@demo.local` | manager |
| `desk@demo.local` | staff |
| `finance@demo.local` | accountant |
| `teacher1@demo.local` … `teacher8@demo.local` | teacher (linked to `t1`…`t8`) |

Session TTL is 12h. Unknown user and wrong passphrase return an **identical** error (`AUTH_INVALID_CREDENTIALS`) so the demo does not enumerate accounts. Restoration re-reads role and permissions from the matrix, never from stored payload, so editing `localStorage` cannot grant privileges beyond the stored `userId`'s real role.

## Demo lifecycle integration — IMPLEMENTED

Reset / clear / import / restore all run `invalidateSessionIfUserMissing()`. If the signed-in `userId` no longer exists, the session is dropped, so clearing the dataset cannot leave a ghost session. Invalid restores leave state unchanged. Backups carry users and roles but never credentials or sessions.

## Known limitations

- **DEMO ONLY** — everything in the security statement above.
- **PARTIAL** — repository wiring. The auth, users and students domains go through the repository layer. Most other views (Dashboard, Teachers, Classes, Scheduling, Attendance, Finance, Messages, Library, Reports and several panels) still import static fixtures from `@/data/records`; 24 files are affected. They are read-only presentational reads, not a second state store, but they must be migrated before backend integration.
- **BACKEND REQUIRED** — password reset, account lockout, audit logging, refresh tokens, server-enforced permissions.
