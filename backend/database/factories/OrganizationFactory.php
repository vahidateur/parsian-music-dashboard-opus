<?php

namespace Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\Organization>
 */
class OrganizationFactory extends Factory
{
    public function definition(): array
    {
        return [
            'id' => 'org_'.strtolower((string) Str::ulid()),
            'slug' => 'org-'.strtolower(Str::random(10)),
            'name' => fake()->company(),
            'status' => 'active',

            /*
             * The shipped defaults from `DEFAULT_ORGANIZATION_SETTINGS`
             * (src/domains/organization/types.ts), stated here rather than left
             * to the column defaults: a column default is applied by the
             * database and does NOT appear on the model instance returned by
             * `create()`, so a factory row read straight out of memory would
             * otherwise have a null bookable window and no closed weekday.
             */
            'tagline' => 'تالار هنر، جادو و موسیقی',
            'locale' => 'fa-IR',
            'direction' => 'rtl',
            'calendar' => 'jalali',
            'currency' => 'toman',
            'first_weekday' => 0,
            'default_session_minutes' => 60,
            'session_gap_minutes' => 10,
            'cancellation_grace_hours' => 24,
            'max_makeups_per_term' => 2,
            'working_day_start' => '08:00',
            'working_day_end' => '21:00',
            'closed_weekdays' => [6],
        ];
    }

    public function suspended(): static
    {
        return $this->state(fn () => ['status' => 'suspended']);
    }
}
