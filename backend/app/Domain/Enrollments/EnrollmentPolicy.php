<?php

namespace App\Domain\Enrollments;

use App\Domain\Classes\ClassPolicy;
use App\Models\User;

/**
 * Enrollment authorization = classes.read / classes.write (PHASE_B gap matrix
 * row M). Delegates to ClassPolicy so the mapping lives in one place.
 */
final class EnrollmentPolicy
{
    public function __construct(private readonly ClassPolicy $classes) {}

    public function authorizeRead(User $actor): void
    {
        $this->classes->authorizeRead($actor);
    }

    public function authorizeWrite(User $actor): void
    {
        $this->classes->authorizeWrite($actor);
    }
}
