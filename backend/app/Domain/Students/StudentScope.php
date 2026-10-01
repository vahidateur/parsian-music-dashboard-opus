<?php

namespace App\Domain\Students;

/**
 * Which students an actor may see:
 *   org      — every student of the organization
 *   assigned — T-02: students with an ACTIVE enrollment in a class whose
 *              teacher_id is $teacherId
 */
final class StudentScope
{
    private function __construct(public readonly string $kind, public readonly ?string $teacherId) {}

    public static function org(): self
    {
        return new self('org', null);
    }

    public static function assigned(string $teacherId): self
    {
        return new self('assigned', $teacherId);
    }

    public function isOrg(): bool
    {
        return $this->kind === 'org';
    }
}
