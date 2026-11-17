<?php

namespace Tests\Feature;

use App\Http\Resources\ClassResource;
use App\Http\Resources\EnrollmentResource;
use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\Student;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * T-02 financial redaction is an allow-list: a missing actor or a role outside
 * the permission vocabulary must omit the financial fields instead of falling
 * through to the unrestricted branch. The resource is exercised directly — an
 * unauthenticated HTTP request only proves the 401, not what a resource emits
 * when it is serialized without an actor.
 */
class ResourceSerializationTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private function classModel(): AcademyClass
    {
        return AcademyClass::factory()->create([
            'organization_id' => $this->defaultOrganization()->id,
            'tuition' => 2500000,
            'attendance_avg' => 77,
            'term_progress' => 33,
        ]);
    }

    private function enrollmentModel(): Enrollment
    {
        $org = $this->defaultOrganization()->id;
        $student = Student::factory()->create(['organization_id' => $org]);
        $class = AcademyClass::factory()->create(['organization_id' => $org]);

        return Enrollment::factory()->create([
            'organization_id' => $org,
            'student_id' => $student->id,
            'class_id' => $class->id,
            'pricing_label' => 'سطح ۳',
            'pricing_amount' => 3200000,
        ]);
    }

    /** A role the permission vocabulary does not define. */
    private function unknownActor(): User
    {
        return (new User())->forceFill(['role' => 'intruder']);
    }

    /** @return array<string, array{0: ?string}> */
    public static function actorsWithoutFinancialVisibility(): array
    {
        return [
            'null actor' => [null],
            'teacher' => ['teacher'],
            'unknown role' => ['intruder'],
        ];
    }

    /** @return array<string, array{0: string}> */
    public static function actorsWithFinancialVisibility(): array
    {
        return [
            'administrator' => ['administrator'],
            'manager' => ['manager'],
            'staff' => ['staff'],
            'accountant' => ['accountant'],
        ];
    }

    private function actorFor(?string $role): ?User
    {
        if ($role === null) {
            return null;
        }

        return $role === 'intruder' ? $this->unknownActor() : $this->makeUser($role);
    }

    #[DataProvider('actorsWithoutFinancialVisibility')]
    public function test_class_resource_omits_financial_fields(?string $role): void
    {
        $wire = ClassResource::toWire($this->classModel(), $this->actorFor($role));

        $this->assertArrayNotHasKey('tuition', $wire);
        $this->assertArrayNotHasKey('attendanceAvg', $wire);
        $this->assertArrayNotHasKey('termProgress', $wire);
        $this->assertArrayNotHasKey('waitlist', $wire);
        // Non-sensitive fields stay available.
        $this->assertArrayHasKey('title', $wire);
        $this->assertArrayHasKey('enrolled', $wire);
    }

    #[DataProvider('actorsWithFinancialVisibility')]
    public function test_class_resource_keeps_financial_fields_for_authorized_roles(string $role): void
    {
        $wire = ClassResource::toWire($this->classModel(), $this->actorFor($role));

        $this->assertSame(2500000, $wire['tuition']);
        $this->assertSame(77, $wire['attendanceAvg']);
        $this->assertSame(33, $wire['termProgress']);
        $this->assertArrayHasKey('waitlist', $wire);
    }

    #[DataProvider('actorsWithoutFinancialVisibility')]
    public function test_enrollment_resource_omits_the_pricing_plan(?string $role): void
    {
        $wire = EnrollmentResource::toWire($this->enrollmentModel(), $this->actorFor($role));

        $this->assertArrayNotHasKey('pricingPlan', $wire);
        // Non-sensitive fields stay available.
        $this->assertArrayHasKey('id', $wire);
        $this->assertArrayHasKey('status', $wire);
    }

    #[DataProvider('actorsWithFinancialVisibility')]
    public function test_enrollment_resource_keeps_the_pricing_plan_for_authorized_roles(string $role): void
    {
        $wire = EnrollmentResource::toWire($this->enrollmentModel(), $this->actorFor($role));

        $this->assertSame(['label' => 'سطح ۳', 'amount' => 3200000], $wire['pricingPlan']);
    }
}
