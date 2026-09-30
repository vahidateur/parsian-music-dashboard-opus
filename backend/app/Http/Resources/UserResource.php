<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Support\Iso;

/**
 * Managed-user wire shape = TS `AuthUser` (camelCase), which
 * ApiUserRepository reads unmapped. Never carries organization_id or password.
 */
final class UserResource
{
    /** @return array<string, mixed> */
    public static function toWire(User $user): array
    {
        $wire = [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
        ];
        if ($user->phone !== null && $user->phone !== '') {
            $wire['phone'] = $user->phone;
        }
        $wire['role'] = $user->role;
        $wire['status'] = $user->status;
        if ($user->teacher_id !== null && $user->teacher_id !== '') {
            $wire['teacherId'] = $user->teacher_id;
        }
        $wire['createdAt'] = Iso::format($user->created_at);
        $wire['updatedAt'] = Iso::format($user->updated_at);

        return $wire;
    }
}
