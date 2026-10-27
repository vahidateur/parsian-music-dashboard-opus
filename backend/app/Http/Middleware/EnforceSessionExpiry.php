<?php

namespace App\Http\Middleware;

use App\Support\Api\ApiException;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Laravel\Sanctum\PersonalAccessToken;
use Symfony\Component\HttpFoundation\Response;

/**
 * Server-enforced session expiry for Sanctum bearer tokens.
 *
 * Two independent ceilings, applied to every protected API request:
 *
 *   - idle: no authenticated request for `idle_minutes` (default 30) —
 *     code `AUTH_SESSION_IDLE_EXPIRED`;
 *   - absolute: token age past `absolute_minutes` (default 600 = 10 h),
 *     regardless of activity — code `AUTH_SESSION_ABSOLUTE_EXPIRED`.
 *
 * ORDERING. This middleware is listed first in the protected group, before
 * `auth:sanctum`, so a dead token is rejected before tenant resolution — but
 * first position alone does NOT guarantee it runs first: Laravel sorts the
 * `Authenticate` middleware ahead of custom route middleware by priority
 * (verified empirically: with Sanctum's own touch enabled, this check
 * observed an already-touched timestamp). The REAL invariant is that
 * Sanctum's own `last_used_at` touch is DISABLED
 * (`config/sanctum.php: 'last_used_at' => false`), so whatever runs first,
 * the value observed here is always the PREVIOUS request's. This middleware
 * is therefore the SOLE writer of the activity timestamp: it reads the
 * pre-request value, decides, and only then records the request.
 * Re-enabling Sanctum's touch without revisiting this check would silently
 * break idle expiry.
 *
 * On breach the token row is deleted (single-row delete by key: safe under
 * concurrency, repeat attempts simply find nothing) and a 401 with a
 * distinct code is thrown. Missing, malformed or already-deleted tokens are
 * left for `auth:sanctum`, which keeps answering `AUTH_UNAUTHENTICATED` —
 * existing codes and the `{ error: { code, message } }` envelope are
 * unchanged, and no token or account detail ever leaves in an error.
 */
final class EnforceSessionExpiry
{
    public const IDLE_CODE = 'AUTH_SESSION_IDLE_EXPIRED';

    public const ABSOLUTE_CODE = 'AUTH_SESSION_ABSOLUTE_EXPIRED';

    public function handle(Request $request, Closure $next): Response
    {
        $raw = $request->bearerToken();
        if (! is_string($raw) || $raw === '') {
            return $next($request);
        }

        $token = PersonalAccessToken::findToken($raw);
        if ($token === null) {
            return $next($request);
        }

        $now = Carbon::now();
        $absoluteMinutes = max(1, (int) config('session-expiry.absolute_minutes', 600));
        $idleMinutes = max(1, (int) config('session-expiry.idle_minutes', 30));

        $createdAt = Carbon::parse($token->created_at);
        if ($createdAt->lte($now->copy()->subMinutes($absoluteMinutes))) {
            $token->delete();
            throw new ApiException(401, self::ABSOLUTE_CODE, 'مدت نشست شما به پایان رسید. لطفاً دوباره وارد شوید.');
        }

        $lastActivity = $token->last_used_at !== null
            ? Carbon::parse($token->last_used_at)
            : $createdAt;
        if ($lastActivity->lte($now->copy()->subMinutes($idleMinutes))) {
            $token->delete();
            throw new ApiException(401, self::IDLE_CODE, 'نشست شما به دلیل عدم فعالیت به پایان رسید. لطفاً دوباره وارد شوید.');
        }

        // The request proved the token live: record it as activity for the
        // next check. This write is the ONLY last_used_at update in the
        // request lifecycle (Sanctum's own touch is disabled on purpose).
        $token->forceFill(['last_used_at' => $now])->save();

        return $next($request);
    }
}
