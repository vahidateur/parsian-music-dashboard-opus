<?php

namespace App\Http\Requests;

use App\Models\ClassSession;
use App\Models\GalleryAlbum;
use App\Models\MediaAsset;
use App\Models\Piece;
use App\Models\Room;
use App\Models\Student;
use App\Models\Teacher;
use Closure;

/** Existence rules for references that must live in the caller's organization. */
final class TenantRules
{
    /**
     * The referenced teacher must exist in the caller's organization. The
     * tenant-scoped model query means another organization's id fails too.
     */
    public static function teacherExists(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value === null || $value === '') {
                return;
            }
            if (! is_string($value) || ! Teacher::query()->whereKey($value)->exists()) {
                $fail('مدرس انتخاب‌شده وجود ندارد.');
            }
        };
    }

    /**
     * The referenced student must exist in the caller's organization. Used for
     * `restrictedToStudentIds`, where a cross-tenant id must fail the same way
     * an unknown one does.
     */
    public static function studentExists(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value === null || $value === '') {
                return;
            }
            if (! is_string($value) || ! Student::query()->whereKey($value)->exists()) {
                $fail('هنرجوی انتخاب‌شده وجود ندارد.');
            }
        };
    }

    /**
     * The piece must exist in the caller's organization AND be active.
     *
     * An inactive piece cannot be assigned: the client contract refuses it with
     * a `pieceId` field error, and the same rule is enforced here so a direct
     * API call cannot bypass the panel. This is an existence/state check, not
     * an authorization decision.
     */
    public static function assignablePiece(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $piece = is_string($value) ? Piece::query()->whereKey($value)->first() : null;
            if ($piece === null) {
                $fail('قطعه یافت نشد.');
            } elseif (! $piece->active) {
                $fail('این قطعه غیرفعال است.');
            }
        };
    }

    /** Teacher must exist in the organization and not be inactive. */
    public static function assignableTeacher(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $teacher = is_string($value) ? Teacher::query()->whereKey($value)->first() : null;
            if ($teacher === null) {
                $fail('مدرس یافت نشد.');
            } elseif ($teacher->status === 'inactive') {
                $fail('مدرس غیرفعال است.');
            }
        };
    }

    /**
     * A progress event may be linked to a class session, but only to one in the
     * caller's organization. The link is provenance for the timeline, never
     * authorization, yet a cross-tenant id must not be storable.
     */
    public static function sessionExists(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value === null || $value === '') {
                return;
            }
            if (! is_string($value) || ! ClassSession::query()->whereKey($value)->exists()) {
                $fail('جلسه انتخاب‌شده وجود ندارد.');
            }
        };
    }

    /**
     * Room must exist in the organization and be active. Data integrity only:
     * this is a model query, not room authorization (that lives in
     * RoomPolicy, checked before any request reaches validation).
     */
    public static function assignableRoom(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $room = is_string($value) ? Room::query()->whereKey($value)->first() : null;
            if ($room === null) {
                $fail('اتاق یافت نشد.');
            } elseif (! $room->active) {
                $fail('اتاق غیرفعال است.');
            }
        };
    }

    /**
     * The gallery album must exist in the caller's organization. Data
     * integrity only: an image row that names a missing album would render
     * under no heading, and a cross-tenant id must fail the same way an
     * unknown one does.
     */
    public static function galleryAlbumExists(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if (! is_string($value) || ! GalleryAlbum::query()->whereKey(trim($value))->exists()) {
                $fail('آلبوم یافت نشد.');
            }
        };
    }

    /**
     * The referenced media asset must exist in the caller's organization.
     *
     * The tenant-scoped model query means an id from ANOTHER organization
     * fails the same way an unknown one does, and so does an id whose asset
     * was deleted after upload. Without this rule a record could carry a
     * `photoMediaId` that names nothing — the UI would render "no image"
     * forever and the row would point at bytes that may never have existed.
     *
     * A CLEARED field travels as `''` or `null` and never fails: the media
     * domain stores a cleared photo as an empty string, which is "no photo",
     * not "a photo that is missing".
     *
     * This is an existence check, not an authorization decision: whether the
     * actor may READ the asset is decided when the bytes are fetched.
     */
    public static function mediaAssetExists(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            if ($value === null || $value === '') {
                return;
            }
            if (! is_string($value) || ! MediaAsset::query()->whereKey(trim($value))->exists()) {
                $fail('فایل ارسالی یافت نشد.');
            }
        };
    }
}
