<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * `teacher_id` is display/assignment data only; it is never read by
 * authorization (T-02 is decided by active enrollments, see
 * App\Domain\Students\StudentAccessPolicy).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $national_id
 * @property string $name
 * @property string $instrument
 * @property string|null $teacher_id
 * @property string $level
 * @property int $level_step
 * @property string $status
 * @property string $payment
 * @property int $age
 * @property string $phone
 * @property string|null $guardian
 * @property string $since
 * @property array<string, mixed> $deferred
 */
class Student extends Model
{
    /** @use HasFactory<\Database\Factories\StudentFactory> */
    use BelongsToOrganization, HasFactory;

    public const STATUSES = ['active', 'at-risk', 'paused', 'waitlist'];

    /** PaymentStatus in src/lib/financeVocabulary.ts. */
    public const PAYMENTS = ['paid', 'due', 'overdue'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'national_id', 'name', 'instrument', 'teacher_id', 'level', 'level_step',
        'status', 'payment', 'age', 'phone', 'guardian', 'since', 'deferred',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'level_step' => 'integer',
            'age' => 'integer',
            'deferred' => 'array',
        ];
    }

    /** @return HasMany<Enrollment, $this> */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class);
    }
}
