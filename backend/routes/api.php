<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\UserController;
use Illuminate\Support\Facades\Route;

/*
 * Prefix `api/v1` is applied in bootstrap/app.php.
 *
 * Every route except login requires a Sanctum Bearer token AND a resolved
 * tenant. Resource ids are plain `{id}` strings resolved inside the services
 * (tenant-scoped), never by implicit route-model binding.
 */

Route::post('auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware(['auth:sanctum', 'tenant'])->group(function () {
    Route::post('auth/logout', [AuthController::class, 'logout']);
    Route::get('auth/me', [AuthController::class, 'me']);

    Route::get('users', [UserController::class, 'index']);
    Route::post('users', [UserController::class, 'store']);
    Route::get('users/{id}', [UserController::class, 'show']);
    Route::patch('users/{id}', [UserController::class, 'update']);
    Route::delete('users/{id}', [UserController::class, 'destroy']);
    Route::get('users/{id}/password', [UserController::class, 'showPassword']);
    Route::post('users/{id}/password', [UserController::class, 'setPassword']);

    Route::get('roles', [RoleController::class, 'index']);
    Route::get('roles/{id}', [RoleController::class, 'show']);
    Route::patch('roles/{id}', [RoleController::class, 'update']);
    Route::post('roles/{id}/reset', [RoleController::class, 'reset']);
});
