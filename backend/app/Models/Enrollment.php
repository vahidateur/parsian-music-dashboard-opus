<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $student_id
 * @property string $class_id
 * @property string $status
 * @property string $start_date
 * @property string|null $end_date
 * @property string $pricing_label
 * @property int $pricing_amount
 */
class Enrollment extends Model
{
    /** @use HasFactory<\Database\Factories\EnrollmentFactory> */
    use BelongsToOrganization, HasFactory;

    public const STATUSES = ['active', 'waitlist', 'completed', 'cancelled'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'student_id', 'class_id', 'status', 'start_date', 'end_date', 'pricing_label', 'pricing_amount',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return ['pricing_amount' => 'integer'];
    }

    /** @return BelongsTo<Student, $this> */
    public function student(): BelongsTo
    {
        return $this->belongsTo(Student::class);
    }

    /** @return BelongsTo<AcademyClass, $this> */
    public function academyClass(): BelongsTo
    {
        return $this->belongsTo(AcademyClass::class, 'class_id');
    }
}
