<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A student working on a piece (TS `PieceAssignment`).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $student_id
 * @property string $piece_id
 * @property string|null $teacher_id
 * @property string $status
 * @property \Illuminate\Support\Carbon $assigned_at
 * @property \Illuminate\Support\Carbon|null $target_date
 * @property \Illuminate\Support\Carbon|null $closed_at
 * @property string $notes
 * @property array<string, mixed>|null $latest
 */
class PieceAssignment extends Model
{
    /** @use HasFactory<\Database\Factories\PieceAssignmentFactory> */
    use BelongsToOrganization, HasFactory;

    /**
     * `paused` and `abandoned` are distinct on purpose: paused implies intent
     * to return, abandoned is a decision. Merging them would lose that.
     */
    public const STATUSES = ['planned', 'learning', 'polishing', 'completed', 'paused', 'abandoned'];

    /** Statuses meaning the student is actively working on the piece. */
    public const ACTIVE_STATUSES = ['planned', 'learning', 'polishing'];

    /** Statuses that close an assignment; a new one may then be created. */
    public const CLOSED_STATUSES = ['completed', 'abandoned'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'student_id',
        'piece_id',
        'teacher_id',
        'status',
        'assigned_at',
        'target_date',
        'closed_at',
        'notes',
        'latest',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'target_date' => 'datetime',
            'closed_at' => 'datetime',
            'latest' => 'array',
        ];
    }

    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    public function piece(): BelongsTo
    {
        return $this->belongsTo(Piece::class);
    }

    /** Provenance only — `teacher_id` never authorizes anything. */
    public function teacher(): BelongsTo
    {
        return $this->belongsTo(Teacher::class);
    }

    public function isClosed(): bool
    {
        return in_array($this->status, self::CLOSED_STATUSES, true);
    }
}
