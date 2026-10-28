<?php

use App\Http\Controllers\Api\V1\AttendanceController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\BrandingController;
use App\Http\Controllers\Api\V1\ChatController;
use App\Http\Controllers\Api\V1\ClassController;
use App\Http\Controllers\Api\V1\CompensationController;
use App\Http\Controllers\Api\V1\EnrollmentController;
use App\Http\Controllers\Api\V1\GalleryController;
use App\Http\Controllers\Api\V1\InstrumentController;
use App\Http\Controllers\Api\V1\InvoiceController;
use App\Http\Controllers\Api\V1\LearningController;
use App\Http\Controllers\Api\V1\MediaController;
use App\Http\Controllers\Api\V1\OrganizationController;
use App\Http\Controllers\Api\V1\PieceAssignmentController;
use App\Http\Controllers\Api\V1\PieceController;
use App\Http\Controllers\Api\V1\ProgressEventController;
use App\Http\Controllers\Api\V1\ProgressOverviewController;
use App\Http\Controllers\Api\V1\ResourceController;
use App\Http\Controllers\Api\V1\RoleController;
use App\Http\Controllers\Api\V1\RoomController;
use App\Http\Controllers\Api\V1\SessionController;
use App\Http\Controllers\Api\V1\StudentAssignmentController;
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

Route::middleware(['session.expiry', 'auth:sanctum', 'tenant'])->group(function () {
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

    /*
     * Branding — the academy's identity: one record, two verbs, exactly the
     * contract in src/domains/branding/repository.ts. `branding.read` to
     * read, `branding.write` to patch (DECISIONS.md §38), both enforced by
     * BrandingPolicy; the row is always the caller's own organization.
     */
    Route::get('branding', [BrandingController::class, 'show']);
    Route::patch('branding', [BrandingController::class, 'update']);

    /*
     * Instruments — runtime catalogue. Reads are allowed to every authenticated
     * member of the organization (it is a lookup table, not personal data);
     * writes require `instruments.write` (administrator + manager, per §33).
     */
    Route::get('instruments', [InstrumentController::class, 'index']);
    Route::post('instruments', [InstrumentController::class, 'store']);
    Route::get('instruments/{id}', [InstrumentController::class, 'show']);
    Route::patch('instruments/{id}', [InstrumentController::class, 'update']);
    Route::post('instruments/{id}/active', [InstrumentController::class, 'setActive']);
    Route::delete('instruments/{id}', [InstrumentController::class, 'destroy']);

    /*
     * Learning — programs, ordered levels, linked content, placements. One
     * repository for the whole aggregate: eligibility is derived at read time
     * and never stored (DECISIONS.md §34).
     *
     * STATIC segments are registered BEFORE the `{id}` routes on purpose:
     * `levels/{id}/links` must not be swallowed by `levels/{id}`, and the
     * `students/{id}/…` reads live under their own prefix for the same reason.
     */
    Route::get('learning/programs', [LearningController::class, 'indexPrograms']);
    Route::post('learning/programs', [LearningController::class, 'storeProgram']);
    Route::get('learning/programs/{id}', [LearningController::class, 'showProgram']);
    Route::patch('learning/programs/{id}', [LearningController::class, 'updateProgram']);
    Route::delete('learning/programs/{id}', [LearningController::class, 'destroyProgram']);

    Route::get('learning/levels', [LearningController::class, 'indexLevels']);
    Route::post('learning/levels', [LearningController::class, 'storeLevel']);
    Route::get('learning/levels/{id}', [LearningController::class, 'showLevel']);
    Route::patch('learning/levels/{id}', [LearningController::class, 'updateLevel']);
    Route::post('learning/levels/{id}/reorder', [LearningController::class, 'reorderLevel']);
    Route::delete('learning/levels/{id}', [LearningController::class, 'destroyLevel']);
    Route::get('learning/links', [LearningController::class, 'indexLinks']);
    Route::post('learning/levels/{id}/links', [LearningController::class, 'storeLink']);
    Route::delete('learning/levels/{id}/links/{contentId}', [LearningController::class, 'destroyLink']);

    Route::get('learning/content', [LearningController::class, 'indexContent']);
    Route::post('learning/content', [LearningController::class, 'storeContent']);
    Route::get('learning/content/{id}', [LearningController::class, 'showContent']);
    Route::patch('learning/content/{id}', [LearningController::class, 'updateContent']);
    Route::delete('learning/content/{id}', [LearningController::class, 'destroyContent']);
    Route::get('learning/content/{id}/eligible-students', [LearningController::class, 'eligibleStudents']);

    Route::get('learning/placements', [LearningController::class, 'indexPlacements']);
    Route::post('learning/placements', [LearningController::class, 'storePlacement']);
    Route::get('learning/students/{id}/placement', [LearningController::class, 'showPlacement']);
    Route::delete('learning/students/{id}/placement', [LearningController::class, 'destroyPlacement']);
    Route::get('learning/students/{id}/eligible-content', [LearningController::class, 'eligibleContent']);
    Route::get('learning/students/{id}/locked-content', [LearningController::class, 'lockedContent']);

    /*
     * Gallery — the academy's showcase: albums and their images.
     *
     * Authorized by the owner for v1 under `gallery.read` / `gallery.write`
     * (DECISIONS.md §36). Images reference the media domain by `mediaId`; the
     * bytes are served (and authorized) by the media endpoints, never here.
     * Deleting an album removes its images; an image that leaves frees its
     * media asset only when no record still references it.
     *
     * Albums and images live under their own prefixes, so no STATIC segment
     * can swallow an `{id}` route here.
     */
    Route::get('gallery/albums', [GalleryController::class, 'indexAlbums']);
    Route::post('gallery/albums', [GalleryController::class, 'storeAlbum']);
    Route::get('gallery/albums/{id}', [GalleryController::class, 'showAlbum']);
    Route::patch('gallery/albums/{id}', [GalleryController::class, 'updateAlbum']);
    Route::delete('gallery/albums/{id}', [GalleryController::class, 'destroyAlbum']);

    Route::get('gallery/images', [GalleryController::class, 'indexImages']);
    Route::post('gallery/images', [GalleryController::class, 'storeImage']);
    Route::get('gallery/images/{id}', [GalleryController::class, 'showImage']);
    Route::patch('gallery/images/{id}', [GalleryController::class, 'updateImage']);
    Route::delete('gallery/images/{id}', [GalleryController::class, 'destroyImage']);
    Route::post('gallery/images/{id}/reorder', [GalleryController::class, 'reorderImage']);

    /*
     * Chat — threads, participation and messages.
     *
     * Authorized by the owner for v1 under the existing `messages.read` /
     * `messages.write` ids (DECISIONS.md §37): no new permission is needed
     * because the vocabulary already names exactly this capability, and §26.3
     * only forbids borrowing an id for a DIFFERENT domain. Participation is
     * the read boundary inside every endpoint: a non-participant gets 404,
     * never another user's messages.
     */
    Route::get('chat/conversations', [ChatController::class, 'indexConversations']);
    Route::post('chat/conversations', [ChatController::class, 'storeConversation']);
    Route::get('chat/conversations/{id}', [ChatController::class, 'showConversation']);
    Route::patch('chat/conversations/{id}', [ChatController::class, 'updateConversation']);
    Route::post('chat/conversations/{id}/archive', [ChatController::class, 'archiveConversation']);
    Route::post('chat/conversations/{id}/read', [ChatController::class, 'markRead']);
    Route::get('chat/conversations/{id}/messages', [ChatController::class, 'indexMessages']);
    Route::post('chat/conversations/{id}/messages', [ChatController::class, 'storeMessage']);

    /*
     * Compensation — private-lesson make-up obligations and their bookings.
     *
     * Authorized under the existing `schedule.read` / `schedule.write` ids
     * (the make-up IS a session; see the repository contract and §37-style
     * planning handoff) — no new permission is invented. Reads are scoped to
     * the actor's own classes for teachers (PB-1 fail-closed for unlinked
     * teacher accounts, same as sessions); every other role reads
     * organization-wide.
     */
    Route::get('compensations', [CompensationController::class, 'index']);
    Route::post('compensations', [CompensationController::class, 'store']);
    Route::get('compensations/{id}', [CompensationController::class, 'show']);
    Route::post('compensations/{id}/schedule', [CompensationController::class, 'schedule']);
    Route::post('compensations/{id}/complete', [CompensationController::class, 'complete']);

    /*
     * Invoices — tuition billing and its one accepted payment (v1, §40).
     *
     * Served under the existing `finance.read` / `finance.write` ids
     * (administrator, manager-read, accountant) — no new permission is
     * invented. v1 issues due invoices and discharges each with exactly one
     * payment; partial payments and student-balance sync are explicitly out.
     */
    Route::get('invoices', [InvoiceController::class, 'index']);
    Route::post('invoices', [InvoiceController::class, 'store']);
    Route::get('invoices/{id}', [InvoiceController::class, 'show']);
    Route::patch('invoices/{id}', [InvoiceController::class, 'update']);
    Route::post('invoices/{id}/pay', [InvoiceController::class, 'pay']);

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

    // Rooms — runtime lookup table. Reads are allowed to every authenticated
    // member of the organization; writes require `rooms.write` (administrator
    // + manager, per §35). PB-3 has no blocked domain left.
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
     * Media — the binary store behind profile photos, library files and
     * (since §36) gallery images. Learning material and branding stay
     * unserved: their tables do not exist yet, so there is nothing to scan.
     *
     * METADATA AND BYTES, BOTH AUTHENTICATED. The bytes live on the private
     * disk and are reachable only through `/bytes`, which authorizes the
     * READER against the record that shows the asset — a teacher sees the
     * photos of their own students, not of the whole academy.
     */
    Route::get('media', [MediaController::class, 'index']);
    Route::post('media', [MediaController::class, 'store']);
    Route::get('media/{id}/bytes', [MediaController::class, 'bytes']);
    Route::get('media/{id}', [MediaController::class, 'show']);
    Route::delete('media/{id}', [MediaController::class, 'destroy']);

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

    /*
     * Progress — pieces, piece-assignments, the append-only event log and the
     * derived overview.
     *
     * Authorized by the owner for v1 on 2026-10-03 under `progress.read` /
     * `progress.write` (DECISIONS.md §29).
     *
     * STILL DEFERRED, with NO placeholder routes here: analytics and plateau
     * detection as standalone endpoints (they are computed inside the overview
     * instead), and workflow automation.
     */
    Route::get('pieces', [PieceController::class, 'index']);
    Route::post('pieces', [PieceController::class, 'store']);
    Route::get('pieces/{id}', [PieceController::class, 'show']);
    Route::patch('pieces/{id}', [PieceController::class, 'update']);
    Route::delete('pieces/{id}', [PieceController::class, 'destroy']);

    Route::get('piece-assignments', [PieceAssignmentController::class, 'index']);
    Route::post('piece-assignments', [PieceAssignmentController::class, 'store']);
    Route::get('piece-assignments/{id}', [PieceAssignmentController::class, 'show']);
    Route::patch('piece-assignments/{id}', [PieceAssignmentController::class, 'update']);
    Route::delete('piece-assignments/{id}', [PieceAssignmentController::class, 'destroy']);

    /*
     * The progress log. APPEND-ONLY: only GET and POST exist, and no
     * PUT/PATCH/DELETE route for an event is registered anywhere. Correcting a
     * mistake appends a new event rather than rewriting the past.
     */
    Route::get('progress-events', [ProgressEventController::class, 'index']);
    Route::post('progress-events', [ProgressEventController::class, 'store']);

    // The derived read: insights and recommendations, recomputed on the server
    // over the full history.
    Route::get('students/{id}/progress-overview', [ProgressOverviewController::class, 'show']);

    // The 14th endpoint, authorized 2026-10-03 to close the contract gap found
    // by the post-closure audit: `studentAssignments()` was required by
    // `ProgressRepository` and implemented by `ApiProgressRepository`, but no
    // server route existed. Read-only, under progress.read, unpaginated.
    Route::get('students/{id}/assignments', [StudentAssignmentController::class, 'index']);
});

