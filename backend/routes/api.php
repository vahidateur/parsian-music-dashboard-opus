<?php

use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\ClassController;
use App\Http\Controllers\Api\V1\EnrollmentController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\ResourceController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\RoomController;
use App\Http\Controllers\Api\V1\SessionController;
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

    /*
     * Organization settings — one record, two verbs, exactly the contract in
     * src/domains/organization/apiRepository.ts (marked BACKEND REQUIRED).
     * `settings.read` to read, `settings.write` to patch, both enforced by
     * OrganizationPolicy; the row is always the caller's own organization.
     */
    Route::get('organization', [OrganizationController::class, 'show']);
    Route::patch('organization', [OrganizationController::class, 'update']);

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

    /*
     * Scheduling + Attendance.
     *
     * STATIC segments are registered BEFORE the `{id}` routes on purpose:
     * `sessions/generate` must not be swallowed by `sessions/{id}`, and
     * `attendance/bulk` must not be swallowed by `attendance/{id}`.
     */
    Route::get('sessions', [SessionController::class, 'index']);
    Route::post('sessions', [SessionController::class, 'store']);
    Route::post('sessions/generate', [SessionController::class, 'generate']);
    Route::post('sessions/check-conflicts', [SessionController::class, 'checkConflicts']);
    Route::get('sessions/with-attendance', [AttendanceController::class, 'withAttendance']);

    Route::get('sessions/{id}', [SessionController::class, 'show']);
    Route::patch('sessions/{id}', [SessionController::class, 'update']);
    Route::delete('sessions/{id}', [SessionController::class, 'destroy']);
    Route::post('sessions/{id}/cancel', [SessionController::class, 'cancel']);
    Route::post('sessions/{id}/reschedule', [SessionController::class, 'reschedule']);
    Route::get('sessions/{id}/roster', [SessionController::class, 'roster']);
    Route::get('sessions/{id}/attendance', [AttendanceController::class, 'sessionAttendance']);

    Route::get('attendance', [AttendanceController::class, 'index']);
    Route::post('attendance', [AttendanceController::class, 'store']);
    Route::post('attendance/bulk', [AttendanceController::class, 'bulk']);
    Route::get('attendance/corrections', [AttendanceController::class, 'corrections']);
    Route::post('attendance/{id}/correct', [AttendanceController::class, 'correct']);
    Route::get('attendance/{id}', [AttendanceController::class, 'show']);

    /*
     * Library / resources — src/domains/library/apiRepository.ts.
     *
     * METADATA ONLY. The file endpoints the same README names are NOT routed:
     * `POST /uploads` and `GET /resources/{id}/download` carry the bytes, which
     * the client contract keeps out of the resource repository and the spec
     * classifies as back-end-later. `mediaId` is persisted as an opaque
     * reference into the media domain.
     */
    Route::get('resources', [ResourceController::class, 'index']);
    Route::post('resources', [ResourceController::class, 'store']);
    Route::get('resources/{id}', [ResourceController::class, 'show']);
    Route::patch('resources/{id}', [ResourceController::class, 'update']);
    Route::delete('resources/{id}', [ResourceController::class, 'destroy']);
});

