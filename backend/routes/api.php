<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ClassController;
use App\Http\Controllers\Api\V1\EnrollmentController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\RoomController;
use App\Http\Controllers\Api\V1\StudentController;
use App\Http\Controllers\Api\V1\TeacherController;
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

    Route::get('teachers', [TeacherController::class, 'index']);
    Route::post('teachers', [TeacherController::class, 'store']);
    Route::get('teachers/{id}', [TeacherController::class, 'show']);
    Route::patch('teachers/{id}', [TeacherController::class, 'update']);
    Route::delete('teachers/{id}', [TeacherController::class, 'destroy']);
    Route::post('teachers/{id}/deactivate', [TeacherController::class, 'deactivate']);

    // PB-3: routed and implemented, but RoomPolicy blocks every actor (403).
    Route::get('rooms', [RoomController::class, 'index']);
    Route::post('rooms', [RoomController::class, 'store']);
    Route::get('rooms/{id}', [RoomController::class, 'show']);
    Route::patch('rooms/{id}', [RoomController::class, 'update']);
    Route::delete('rooms/{id}', [RoomController::class, 'destroy']);
    Route::post('rooms/{id}/deactivate', [RoomController::class, 'deactivate']);

    Route::get('students', [StudentController::class, 'index']);
    Route::post('students', [StudentController::class, 'store']);
    Route::get('students/{id}', [StudentController::class, 'show']);
    Route::patch('students/{id}', [StudentController::class, 'update']);
    Route::delete('students/{id}', [StudentController::class, 'destroy']);

    Route::get('classes', [ClassController::class, 'index']);
    Route::post('classes', [ClassController::class, 'store']);
    Route::get('classes/{id}', [ClassController::class, 'show']);
    Route::patch('classes/{id}', [ClassController::class, 'update']);
    Route::delete('classes/{id}', [ClassController::class, 'destroy']);
    Route::post('classes/{id}/archive', [ClassController::class, 'archive']);

    Route::get('enrollments', [EnrollmentController::class, 'index']);
    Route::post('enrollments', [EnrollmentController::class, 'store']);
    Route::get('enrollments/{id}', [EnrollmentController::class, 'show']);
    Route::patch('enrollments/{id}', [EnrollmentController::class, 'update']);
    Route::delete('enrollments/{id}', [EnrollmentController::class, 'destroy']);
    Route::post('enrollments/{id}/withdraw', [EnrollmentController::class, 'withdraw']);
});
