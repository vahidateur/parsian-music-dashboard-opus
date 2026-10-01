<?php

namespace App\Domain\Scheduling;

/**
 * The derived conflict report — the TS `ConflictReport` shape
 * (`src/domains/scheduling/types.ts`).
 *
 * Conflicts are NEVER stored. The legacy fixture stored them by hand, which
 * meant they could not react to a reschedule.
 *
 * HARD conflicts make a session impossible and are always refused. WARNINGs are
 * legitimate-but-unusual and require explicit acknowledgement
 * (`acknowledgeWarnings`); they never block silently.
 *
 * Deliberately NOT implemented: `SESSION_OUTSIDE_WORKING_HOURS` and
 * `SESSION_TIGHT_TURNOUND`. Both are advisory rules the academy configures in
 * Settings → قواعد جلسه, and there is no server-side working-hours domain yet.
 * Inventing one would be inventing a requirement, so they are omitted and the
 * omission is recorded in BACKEND_STATUS.md.
 */
final class ConflictReport
{
    /** @param  list<array<string, mixed>>  $hard  @param  list<array<string, mixed>>  $warnings */
    public function __construct(
        public readonly array $hard = [],
        public readonly array $warnings = [],
    ) {}

    public function ok(): bool
    {
        return $this->hard === [];
    }

    public function needsAcknowledgement(): bool
    {
        return $this->warnings !== [];
    }

    /** @return array{hard: list<array<string, mixed>>, warnings: list<array<string, mixed>>, ok: bool} */
    public function toWire(): array
    {
        return [
            'hard' => $this->hard,
            'warnings' => $this->warnings,
            'ok' => $this->ok(),
        ];
    }

    /** @return array<string, mixed> */
    public static function item(string $kind, string $severity, string $message, array $extra = []): array
    {
        return ['kind' => $kind, 'severity' => $severity, 'message' => $message, ...$extra];
    }
}
