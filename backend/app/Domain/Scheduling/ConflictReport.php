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
 * `SESSION_OUTSIDE_WORKING_HOURS` and `SESSION_TIGHT_TURNAROUND` are advisory
 * rules the academy configures in Settings → قواعد جلسه. They were omitted while
 * the server had no copy of the organization rules; Organization settings now
 * provides that copy (`OrganizationRules`), and `ConflictDetector` emits both as
 * WARNINGS — never as hard conflicts, which is how the frontend classifies them.
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

    /**
     * Teacher disclosure (owner decision R5 / Option B).
     *
     * Detection stays organization-wide; only the serialized answer is narrowed.
     * A teacher receives the conflict kind/severity/message and the id of the
     * session sharing the resource they selected. Any student ids must already
     * be inside that teacher's authorized student scope — foreign identities,
     * foreign class metadata and any future extra keys are dropped here.
     *
     * @param  list<string>  $visibleStudentIds
     * @return array{hard: list<array<string, mixed>>, warnings: list<array<string, mixed>>, ok: bool}
     */
    public function toWireForTeacher(array $visibleStudentIds = []): array
    {
        $redact = static function (array $items) use ($visibleStudentIds): array {
            return array_values(array_map(static function (array $item) use ($visibleStudentIds): array {
                $wire = [
                    'kind' => $item['kind'],
                    'severity' => $item['severity'],
                    'message' => $item['message'],
                ];
                if (array_key_exists('conflictingSessionId', $item)) {
                    $wire['conflictingSessionId'] = $item['conflictingSessionId'];
                }
                if (array_key_exists('studentIds', $item)) {
                    $ids = array_values(array_intersect((array) $item['studentIds'], $visibleStudentIds));
                    if ($ids !== []) {
                        $wire['studentIds'] = $ids;
                    }
                }

                return $wire;
            }, $items));
        };

        return [
            'hard' => $redact($this->hard),
            'warnings' => $redact($this->warnings),
            'ok' => $this->ok(),
        ];
    }
}
