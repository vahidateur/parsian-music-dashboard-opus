<?php

namespace Database\Factories;

use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Resource>
 */
class ResourceFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'res_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'teacher_id' => null,
            'title' => 'Resource '.fake()->unique()->numerify('####'),
            'composer' => '',
            'kind' => 'sheet',
            'instrument' => 'piano',
            'level' => 'پایه',
            'media_id' => null,
            'pages' => null,
            'duration_seconds' => null,
            'peaks' => null,
            'uses' => 0,
            'visibility' => 'students',
            'restricted_student_ids' => null,
            'active' => true,
        ];
    }
}
