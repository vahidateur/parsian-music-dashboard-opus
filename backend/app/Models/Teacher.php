<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

/**
 * @property string $id
 * @property string $organization_id
 * @property string $name
 * @property string|null $photo_media_id
 * @property string $instrument
 * @property string $title
 * @property int $students
 * @property int $utilization
 * @property int $weekly_hours
 * @property int $contract_hours
 * @property int $attendance_rate
 * @property int $retention
 * @property list<string> $today_classes
 * @property list<list<int>> $availability
 * @property string $since
 * @property string $phone
 * @property string $status
 * @property string $bio
 */
class Teacher extends Model
{
    /** @use HasFactory<\Database\Factories\TeacherFactory> */
    use BelongsToOrganization, HasFactory;

    public const STATUSES = ['active', 'absent-tomorrow', 'light-load', 'inactive'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'name', 'photo_media_id', 'instrument', 'title', 'students', 'utilization',
        'weekly_hours', 'contract_hours', 'attendance_rate', 'retention',
        'today_classes', 'availability', 'since', 'phone', 'status', 'bio',
    ];

    protected $hidden = ['organization_id'];

    protected function casts(): array
    {
        return [
            'students' => 'integer',
            'utilization' => 'integer',
            'weekly_hours' => 'integer',
            'contract_hours' => 'integer',
            'attendance_rate' => 'integer',
            'retention' => 'integer',
            'today_classes' => 'array',
            'availability' => 'array',
        ];
    }
}
