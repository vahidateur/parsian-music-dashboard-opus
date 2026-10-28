<?php

namespace App\Providers;

use App\Support\Authorization\PermissionGate;
use App\Support\Authorization\PermissionMatrix;
use App\Support\Tenancy\TenantContext;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // One tenant context per request (flushed between requests/jobs).
        $this->app->scoped(TenantContext::class);
        $this->app->singleton(PermissionMatrix::class);
        $this->app->singleton(PermissionGate::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('login', function (Request $request) {
            $email = mb_strtolower(trim((string) $request->input('email')));

            return Limit::perMinute(5)->by($email.'|'.$request->ip());
        });
    }
}
