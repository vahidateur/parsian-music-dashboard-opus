<?php

use App\Http\Middleware\ResolveTenant;
use App\Support\Api\ApiException;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/*
 * Error body for every API failure: { "error": { code, message, fields?, ... } }.
 * Kinds follow `kindForStatus` in src/api/errors.ts (401 authentication,
 * 403 authorization, 404 not_found, 409 conflict, 422 validation, 429, 5xx).
 */
$apiError = static function (int $status, string $code, string $message, array $extra = []): JsonResponse {
    return new JsonResponse(['error' => ['code' => $code, 'message' => $message, ...$extra]], $status, [], JSON_UNESCAPED_UNICODE);
};

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        apiPrefix: 'api/v1',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->alias(['tenant' => ResolveTenant::class]);
        // API guests get a 401 envelope, never a redirect to a login page.
        $middleware->redirectGuestsTo(fn (Request $request) => $request->is('api/*') ? null : '/');
    })
    ->withExceptions(function (Exceptions $exceptions) use ($apiError) {
        $exceptions->dontReport([ApiException::class]);

        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());

        $exceptions->render(function (ApiException $e) {
            return $e->render();
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($apiError) {
            if ($request->is('api/*')) {
                return $apiError(401, 'AUTH_UNAUTHENTICATED', 'برای ادامه وارد شوید.');
            }
        });

        $exceptions->render(function (ValidationException $e, Request $request) {
            if ($request->is('api/*')) {
                return (new ApiException(422, 'VALIDATION_FAILED', 'اطلاعات ارسالی معتبر نیست.', $e->errors()))->render();
            }
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) use ($apiError) {
            if ($request->is('api/*')) {
                return $apiError(429, 'RATE_LIMITED', 'تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.')
                    ->withHeaders($e->getHeaders());
            }
        });

        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) use ($apiError) {
            if ($request->is('api/*')) {
                return $apiError(403, 'FORBIDDEN', 'شما دسترسی لازم برای این کار را ندارید.');
            }
        });

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) use ($apiError) {
            if ($request->is('api/*')) {
                return $apiError(404, 'NOT_FOUND', 'منبع درخواست‌شده یافت نشد.');
            }
        });

        $exceptions->render(function (HttpExceptionInterface $e, Request $request) use ($apiError) {
            if ($request->is('api/*')) {
                $status = $e->getStatusCode();
                $code = match ($status) {
                    401 => 'AUTH_UNAUTHENTICATED',
                    403 => 'FORBIDDEN',
                    404 => 'NOT_FOUND',
                    405 => 'METHOD_NOT_ALLOWED',
                    429 => 'RATE_LIMITED',
                    default => $status >= 500 ? 'SERVER_ERROR' : 'HTTP_ERROR',
                };

                return $apiError($status, $code, $status >= 500 ? 'خطای داخلی سرور.' : 'درخواست پذیرفته نشد.')
                    ->withHeaders($e->getHeaders());
            }
        });

        $exceptions->render(function (Throwable $e, Request $request) use ($apiError) {
            if ($request->is('api/*')) {
                $extra = config('app.debug')
                    ? ['exception' => get_class($e), 'detail' => $e->getMessage()]
                    : [];

                return $apiError(500, 'SERVER_ERROR', 'خطای داخلی سرور.', $extra);
            }
        });
    })->create();
