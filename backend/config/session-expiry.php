<?php

/*
 * Server-enforced session expiry for Sanctum bearer tokens, checked by
 * App\Http\Middleware\EnforceSessionExpiry on every protected request.
 *
 * - `idle_minutes`: an authenticated request must arrive at least this
 *   often, or the token is revoked with AUTH_SESSION_IDLE_EXPIRED.
 *   Approved policy: 30. Activity is any authenticated request — the app
 *   performs no background API polling, so every hit reflects a user
 *   action, an explicit refresh, or session restore (verified: the only
 *   setInterval calls in src/ are the local idle countdown, the login
 *   throttle display, and the clock).
 * - `absolute_minutes`: token age ceiling regardless of activity.
 *   Approved policy: 600 (10 h), deliberately inside Sanctum's own
 *   720-minute expiry so this decision fires first with the distinct code.
 */

return [
    'idle_minutes' => (int) env('AUTH_IDLE_TIMEOUT_MINUTES', 30),
    'absolute_minutes' => (int) env('AUTH_ABSOLUTE_LIFETIME_MINUTES', 600),
];
