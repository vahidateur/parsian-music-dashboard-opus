<?php

namespace Tests\Feature;

use App\Domain\Organization\OrganizationRules;
use App\Domain\Organization\OrganizationService;
use App\Models\Organization;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Organization settings: the wire contract of
 * src/domains/organization/apiRepository.ts (marked BACKEND REQUIRED).
 *
 * The vocabulary's asymmetry is asserted rather than assumed: a manager holds
 * `settings.read` but NOT `settings.write`, and teacher/staff/accountant hold
 * neither. Frontend gating is UX; these are the authoritative answers.
 */
class OrganizationTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    /* ------------------------------------------------------------------ */
    /* authorization                                                       */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_is_401(): void
    {
        $this->asGuest();

        $this->getJson('/api/v1/organization')->assertStatus(401);
        $this->patchJson('/api/v1/organization', ['sessionGapMinutes' => 20])->assertStatus(401);
    }

    public function test_reading_requires_settings_read(): void
    {
        $this->actingAsRole('administrator');
        $this->getJson('/api/v1/organization')->assertOk();

        // The manager's read is granted by the shipped vocabulary.
        $this->actingAsRole('manager');
        $this->getJson('/api/v1/organization')->assertOk();

        // teacher, staff and accountant hold no settings permission at all.
        foreach (['teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/organization')
                ->assertStatus(403)
                ->assertJsonPath('error.code', 'FORBIDDEN')
                ->assertJsonPath('error.permission', 'settings.read');
        }
    }

    public function test_writing_requires_settings_write_and_only_the_administrator_has_it(): void
    {
        $body = ['sessionGapMinutes' => 20];

        $this->actingAsRole('administrator');
        $this->patchJson('/api/v1/organization', $body)->assertOk();

        // A manager reads the rules but does not author them.
        $this->actingAsRole('manager');
        $this->patchJson('/api/v1/organization', $body)
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'FORBIDDEN')
            ->assertJsonPath('error.permission', 'settings.write');

        foreach (['teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->patchJson('/api/v1/organization', $body)
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'settings.read');
        }
    }

    /** Authorization precedes validation: no 422 as an oracle for a 403. */
    public function test_the_permission_check_precedes_validation(): void
    {
        $this->actingAsRole('manager');

        $this->patchJson('/api/v1/organization', ['defaultSessionMinutes' => -1])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'settings.write');
    }

    /* ------------------------------------------------------------------ */
    /* GET                                                                  */
    /* ------------------------------------------------------------------ */

    public function test_get_returns_the_shipped_defaults_in_camel_case(): void
    {
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/organization')
            ->assertOk()
            ->assertJsonPath('data.workingDayStart', '08:00')
            ->assertJsonPath('data.workingDayEnd', '21:00')
            ->assertJsonPath('data.closedWeekdays', [6])
            ->assertJsonPath('data.defaultSessionMinutes', 60)
            ->assertJsonPath('data.sessionGapMinutes', 10)
            ->assertJsonPath('data.cancellationGraceHours', 24)
            ->assertJsonPath('data.maxMakeupsPerTerm', 2)
            ->assertJsonPath('data.direction', 'rtl')
            ->assertJsonPath('data.calendar', 'jalali')
            ->assertJsonPath('data.currency', 'toman')
            ->assertJsonPath('data.firstWeekday', 0);
    }

    public function test_get_reports_when_the_rules_last_changed(): void
    {
        $this->actingAsRole('administrator');

        $before = $this->getJson('/api/v1/organization')->json('data.updatedAt');

        $this->patchJson('/api/v1/organization', ['sessionGapMinutes' => 15])->assertOk();

        $after = $this->getJson('/api/v1/organization')->json('data.updatedAt');

        $this->assertNotSame('', $after);
        $this->assertNotSame($before, $after);
    }

    /* ------------------------------------------------------------------ */
    /* PATCH                                                                */
    /* ------------------------------------------------------------------ */

    public function test_a_patch_persists_and_leaves_untouched_fields_alone(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/organization', [
            'sessionGapMinutes' => 20,
            'defaultSessionMinutes' => 90,
        ])
            ->assertOk()
            ->assertJsonPath('data.sessionGapMinutes', 20)
            ->assertJsonPath('data.defaultSessionMinutes', 90)
            // A patch is not a rebuild.
            ->assertJsonPath('data.maxMakeupsPerTerm', 2)
            ->assertJsonPath('data.workingDayStart', '08:00');

        $this->getJson('/api/v1/organization')
            ->assertJsonPath('data.sessionGapMinutes', 20);

        $this->assertDatabaseHas('organizations', [
            'id' => $this->defaultOrganization()->id,
            'session_gap_minutes' => 20,
            'default_session_minutes' => 90,
        ]);
    }

    public function test_a_rule_outside_the_bounds_that_keep_it_usable_is_refused(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/organization', ['defaultSessionMinutes' => 5])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ORGANIZATION_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['defaultSessionMinutes']]]);

        $this->patchJson('/api/v1/organization', ['sessionGapMinutes' => 500])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ORGANIZATION_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['sessionGapMinutes']]]);

        // Nothing was written.
        $this->assertDatabaseHas('organizations', [
            'id' => $this->defaultOrganization()->id,
            'default_session_minutes' => 60,
            'session_gap_minutes' => 10,
        ]);
    }

    public function test_a_clock_that_is_not_a_time_of_day_is_refused(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/organization', ['workingDayStart' => '۸ صبح'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ORGANIZATION_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['workingDayStart']]]);
    }

    /**
     * The window is validated as a pair, so a one-sided patch is checked against
     * the stored other half — otherwise "start 22:00" would pass on its own and
     * leave the academy with a window that closes before it opens.
     */
    public function test_a_one_sided_patch_is_validated_against_the_stored_other_half(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/organization', ['workingDayStart' => '22:00'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ORGANIZATION_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['workingDayEnd']]]);

        $this->getJson('/api/v1/organization')->assertJsonPath('data.workingDayStart', '08:00');
    }

    public function test_a_whole_window_that_opens_and_closes_in_order_is_accepted(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/organization', [
            'workingDayStart' => '22:00',
            'workingDayEnd' => '23:30',
        ])
            ->assertOk()
            ->assertJsonPath('data.workingDayStart', '22:00')
            ->assertJsonPath('data.workingDayEnd', '23:30');
    }

    public function test_closed_weekdays_are_validated(): void
    {
        $this->actingAsRole('administrator');

        // Every day closed leaves no working day at all.
        $this->patchJson('/api/v1/organization', ['closedWeekdays' => [0, 1, 2, 3, 4, 5, 6]])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'ORGANIZATION_INVALID')
            ->assertJsonStructure(['error' => ['fields' => ['closedWeekdays']]]);

        // 9 is not a weekday index.
        $this->patchJson('/api/v1/organization', ['closedWeekdays' => [9]])
            ->assertStatus(422)
            ->assertJsonStructure(['error' => ['fields' => ['closedWeekdays.0']]]);

        $this->patchJson('/api/v1/organization', ['closedWeekdays' => [5, 6]])
            ->assertOk()
            ->assertJsonPath('data.closedWeekdays', [5, 6]);
    }

    public function test_an_enum_field_rejects_an_unknown_value(): void
    {
        $this->actingAsRole('administrator');

        $this->patchJson('/api/v1/organization', ['direction' => 'up'])->assertStatus(422);
        $this->patchJson('/api/v1/organization', ['calendar' => 'mars'])->assertStatus(422);
        $this->patchJson('/api/v1/organization', ['currency' => 'dollar'])->assertStatus(422);
    }

    /* ------------------------------------------------------------------ */
    /* tenancy                                                              */
    /* ------------------------------------------------------------------ */

    public function test_settings_never_cross_organizations(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization();

        $this->actingAsRole('administrator', [], $orgA);
        $this->patchJson('/api/v1/organization', ['sessionGapMinutes' => 33])
            ->assertOk()
            ->assertJsonPath('data.sessionGapMinutes', 33);

        $this->actingAsRole('administrator', [], $orgB);
        $this->getJson('/api/v1/organization')
            ->assertOk()
            // Org B is untouched and reads its own record, not org A's.
            ->assertJsonPath('data.sessionGapMinutes', 10)
            ->assertJsonPath('data.name', $orgB->name);

        $this->assertDatabaseHas('organizations', ['id' => $orgA->id, 'session_gap_minutes' => 33]);
        $this->assertDatabaseHas('organizations', ['id' => $orgB->id, 'session_gap_minutes' => 10]);
    }

    public function test_the_service_scopes_its_row_to_the_tenant_in_context(): void
    {
        $orgA = $this->defaultOrganization();
        $orgB = $this->makeOrganization(['session_gap_minutes' => 77]);

        $this->bindTenant($orgA);
        $this->assertSame($orgA->id, app(OrganizationService::class)->get()->id);

        $this->bindTenant($orgB);
        $this->assertSame($orgB->id, app(OrganizationService::class)->get()->id);
        $this->assertSame(77, app(OrganizationService::class)->get()->session_gap_minutes);
    }

    /* ------------------------------------------------------------------ */
    /* the rules, derived                                                   */
    /* ------------------------------------------------------------------ */

    public function test_working_window_and_inside_working_hours(): void
    {
        $organization = $this->defaultOrganization();

        $this->assertSame(['start' => 480, 'end' => 1260], OrganizationRules::workingWindow($organization));
        $this->assertSame('08:00', OrganizationRules::pad(480));
        $this->assertSame('21:00', OrganizationRules::pad(1260));

        $this->assertTrue(OrganizationRules::isInsideWorkingHours($organization, '10:00', '11:00'));
        $this->assertFalse(OrganizationRules::isInsideWorkingHours($organization, '07:00', '08:00'));
        $this->assertFalse(OrganizationRules::isInsideWorkingHours($organization, '20:00', '22:00'));
    }

    /** An unreadable rule is NOT evaluated — never silently "allowed". */
    public function test_a_rule_that_cannot_be_read_answers_null(): void
    {
        $organization = $this->defaultOrganization();
        $organization->working_day_start = 'not a clock';
        $organization->save();
        $broken = $organization->fresh();

        $this->assertNull(OrganizationRules::workingWindow($broken));
        $this->assertNull(OrganizationRules::isInsideWorkingHours($broken, '10:00', '11:00'));
    }

    public function test_a_window_that_closes_before_it_opens_is_not_a_window(): void
    {
        $organization = $this->defaultOrganization();
        $organization->working_day_start = '18:00';
        $organization->working_day_end = '09:00';
        $organization->save();

        $this->assertNull(OrganizationRules::workingWindow($organization->fresh()));
    }

    public function test_closed_weekdays_fall_back_only_when_never_configured(): void
    {
        $organization = $this->defaultOrganization();

        $organization->closed_weekdays = null;
        $organization->save();
        $this->assertSame([6], OrganizationRules::closedWeekdays($organization->fresh()));
        $this->assertTrue(OrganizationRules::isClosedWeekday($organization->fresh(), 6));

        // An empty list is a real configuration: open every day.
        $organization->closed_weekdays = [];
        $organization->save();
        $this->assertSame([], OrganizationRules::closedWeekdays($organization->fresh()));
        $this->assertFalse(OrganizationRules::isClosedWeekday($organization->fresh(), 6));
    }

    public function test_scheduling_rules_lift_the_values_the_engine_consumes(): void
    {
        $organization = $this->defaultOrganization();

        $this->assertSame([
            'closedWeekdays' => [6],
            'gapMinutes' => 10,
            'workingHours' => ['start' => 480, 'end' => 1260],
        ], OrganizationRules::schedulingRules($organization));
    }

    public function test_a_stored_gap_is_what_the_turnaround_rule_reads(): void
    {
        $organization = $this->defaultOrganization();

        $this->bindTenant($organization);
        app(OrganizationService::class)->update(['sessionGapMinutes' => 45]);

        $this->assertSame(45, OrganizationRules::gapMinutes($organization->fresh()));
    }
}
