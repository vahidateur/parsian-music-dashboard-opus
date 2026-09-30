<?php

namespace App\Http\Resources;

use App\Models\User;
use App\Support\Iso;

/**
 * The auth session's user, snake_case as `toUser` in
 * src/domains/auth/apiAuthRepository.ts reads it. Never carries organization_id.
 */
final class AuthUserResource
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

        return [
            ...$wire,
            'role' => $user->role,
            'status' => $user->status,
            'teacher_id' => $user->teacher_id,
            'created_at' => Iso::format($user->created_at),
            'updated_at' => Iso::format($user->updated_at),
        ];
    }
}
