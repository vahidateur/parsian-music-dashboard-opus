<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One observation about a student's work on an assigned piece (TS ProgressEvent).
 *
 * APPEND-ONLY. There is no update or delete pathway: the HTTP routes do not
 * expose one, and the analytics contract depends on it — "correcting a mistake
 * appends a new event rather than rewriting the past, so the chart can never
 * silently change shape."
 */
class ProgressEvent extends Model
{
    use BelongsToOrganization, HasFactory;

    public const string SOURCE_TEACHER = 'teacher';
    public const string SOURCE_STUDENT = 'student';
    public const string SOURCE_SYSTEM = 'system';

    /** The closed set of provenance values, mirroring the TS union. */
    public const array SOURCES = [self::SOURCE_TEACHER, self::SOURCE_STUDENT, self::SOURCE_SYSTEM];

    /** Mirrors `RECENT_EVENT_LIMIT` in src/domains/progress/types.ts. */
    public const int RECENT_EVENT_LIMIT = 20;

    protected $table = 'progress_events';
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'organization_id',
        'assignment_id',
        'student_id',
        'piece_id',
        'recorded_at',
        'range_start',
        'range_end',
        'range_label',
        'tempo_bpm',
        'target_tempo_bpm',
        'mastery',
        'practice_minutes',
        'teacher_note',
        'student_note',
        'source',
        'session_id',
    ];

    protected $casts = [
        'recorded_at' => 'datetime',
        'range_start' => 'integer',
        'range_end' => 'integer',
        'tempo_bpm' => 'integer',
        'target_tempo_bpm' => 'integer',
        'mastery' => 'integer',
        'practice_minutes' => 'integer',
    ];

    public function assignment(): BelongsTo
    {
        return $this->belongsTo(PieceAssignment::class, 'assignment_id');
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class, 'student_id');
    }

    public function piece(): BelongsTo
    {
        return $this->belongsTo(Piece::class, 'piece_id');
    }

    /* ---------------------------------------------------------------- */
    /* Range shape — the same rule as Piece, so mixed ranges read the    */
    /* same way everywhere.                                              */
    /* ---------------------------------------------------------------- */

    public function usesFreeformRange(): bool
    {
        return filled($this->range_label);
    }

    public function hasNumericRange(): bool
    {
        return $this->range_start !== null || $this->range_end !== null;
    }

    /* ---------------------------------------------------------------- */
    /* Ordering                                                          */
    /* ---------------------------------------------------------------- */

    /**
     * Chronological, oldest first, stable for equal timestamps — the
     * contract's `sortByTime()`.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<self>  $query
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeChronological($query)
    {
        return $query->orderBy('recorded_at')->orderBy('id');
    }

    /**
     * Newest first — how the overview's recent events are surfaced.
     *
     * @param  \Illuminate\Database\Eloquent\Builder<self>  $query
     * @return \Illuminate\Database\Eloquent\Builder<self>
     */
    public function scopeRecentFirst($query)
    {
        return $query->orderByDesc('recorded_at')->orderByDesc('id');
    }
}
