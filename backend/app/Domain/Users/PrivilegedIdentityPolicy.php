<?php

namespace App\Domain\Users;

use App\Models\User;
use App\Support\Authorization\OwnerDecisionRequired;

/**
 * PB-2 ISOLATION — privileged identity policy is an OWNER DECISION and is not
 * decided here. Every case the owner has not settled is blocked (fail closed)
 * with 403 OWNER_DECISION_REQUIRED_PB2:
 *
 *   (a) any update / delete / password change on the actor's own account
 *       (self-edit policy undecided);
 *   (b) any update / delete / password change on an administrator by another
 *       user (super-admin editing super-admin / rank hierarchy undecided);
 *   (c) assigning the `administrator` role on create or update
 *       (rank hierarchy undecided);
 *   (d) changing the email of an administrator or manager
 *       (privileged email policy undecided).
 *
 * Because no allowed path touches the actor's own credentials, current-password
 * verification is never required; `POST users/{id}/password {password}` keeps
 * the existing client contract. One-name vs two-name fields stays the current
 * single `name` field.
 *
 * When the owner decides PB-2, replace the matching throw — do not widen it.
 */
final class PrivilegedIdentityPolicy
{
    public const ACTIONS = ['create', 'update', 'delete', 'password'];

    /**
     * @param  array<string, mixed>  $changes  validated input (wire keys)
     */
    public function assertAllowed(User $actor, ?User $target, array $changes, string $action): void
    {
        if ($target !== null && $target->id === $actor->id) {
            throw new OwnerDecisionRequired('PB-2', 'case a: self-edit policy (editing, deleting or setting the password of your own account) is not decided.');
        }

        if ($target !== null && $target->role === 'administrator') {
            throw new OwnerDecisionRequired('PB-2', 'case b: whether an administrator may be edited by another user (rank hierarchy) is not decided.');
        }

        if (in_array($action, ['create', 'update'], true) && ($changes['role'] ?? null) === 'administrator') {
            throw new OwnerDecisionRequired('PB-2', 'case c: who may grant the administrator role (rank hierarchy) is not decided.');
        }

        if ($action === 'update'
            && $target !== null
            && array_key_exists('email', $changes)
            && in_array($target->role, ['administrator', 'manager'], true)
            && mb_strtolower(trim((string) $changes['email'])) !== $target->email
        ) {
            throw new OwnerDecisionRequired('PB-2', 'case d: the email-change policy for privileged accounts (administrator, manager) is not decided.');
        }
    }
}
