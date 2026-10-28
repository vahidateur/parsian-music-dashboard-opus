<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * A class (table `classes`; `Class` is reserved in PHP).
 *
 * @property string $id
 * @property string $organization_id
 * @property string $title
 * @property string $instrument
 * @property string $teacher_id
 * @property string $room_id
 * @property string $kind
 * @property string $level
 * @property string|null $program_id
 * @property string|null $level_id
 * @property list<int> $days
 * @property string $time
 * @property int $duration
 * @property int $capacity
 * @property int $attendance_avg
 * @property int $tuition
 * @property int $term_progress
 * @property string $status
 */
class AcademyClass extends Model
{
    /** @use HasFactory<\Database\Factories\AcademyClassFactory> */
    use BelongsToOrganization, HasFactory;

    protected $table = 'classes';

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'title', 'instrument', 'teacher_id', 'room_id', 'kind', 'level', 'program_id',
        'level_id', 'days', 'time', 'duration', 'capacity', 'attendance_avg', 'tuition',
        'term_progress', 'status',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'days' => 'array',
            'duration' => 'integer',
            'capacity' => 'integer',
            'attendance_avg' => 'integer',
            'tuition' => 'integer',
            'term_progress' => 'integer',
        ];
    }

    /** @return HasMany<Enrollment, $this> */
    public function enrollments(): HasMany
    {
        return $this->hasMany(Enrollment::class, 'class_id');
    }
}
