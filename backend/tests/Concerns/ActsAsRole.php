<?php

namespace Tests\Concerns;

use App\Models\AcademyClass;
use App\Models\Enrollment;
use App\Models\Organization;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Support\Tenancy\TenantContext;

/**
 * Test helper: organizations, users of a role, and real Sanctum Bearer tokens
 * (the full auth:sanctum + tenant middleware path runs, nothing is faked).
 *
 * Use in feature tests together with RefreshDatabase.
 */
trait ActsAsRole
{
    protected ?Organization $organization = null;

    /** @param  array<string, mixed>  $attributes */
    protected function makeOrganization(array $attributes = []): Organization
    {
        return Organization::factory()->create($attributes);
    }

    /** The organization shared by makeUser()/actingAsRole() when none is given. */
    protected function defaultOrganization(): Organization
    {
        return $this->organization ??= $this->makeOrganization();
    }

    /** @param  array<string, mixed>  $attributes */
    protected function makeUser(string $role, array $attributes = [], ?Organization $organization = null): User
    {
        $organization ??= $this->defaultOrganization();

        return User::factory()->create([
            'role' => $role,
            'organization_id' => $organization->id,
            ...$attributes,
        ]);
    }

    /** Issues a real personal access token for the user. */
    protected function tokenFor(User $user): string
    {
        return $user->createToken('test')->plainTextToken;
    }

    /**
     * Creates a user of the role and sends subsequent requests with its Bearer
     * token.
     *
     * @param  array<string, mixed>  $attributes
     */
    protected function actingAsRole(string $role, array $attributes = [], ?Organization $organization = null): User
    {
        $user = $this->makeUser($role, $attributes, $organization);
        $this->useToken($this->tokenFor($user));

        return $user;
    }

    /**
     * A teacher linked to a teacher row, with an active enrollment in a class
     * the teacher owns for the given student. This is the T-02 fixture: the
     * student is inside that teacher's assigned scope.
     *
     * @param  array<string, mixed>  $attributes
     */
    protected function actingAsAssignedTeacher(Student $student, array $attributes = []): User
    {
        $organization = Organization::query()->findOrFail($student->organization_id);
        $teacher = Teacher::factory()->create([
            'organization_id' => $organization->id,
            ...$attributes,
        ]);
        $class = AcademyClass::factory()->create([
            'organization_id' => $organization->id,
            'teacher_id' => $teacher->id,
        ]);
        Enrollment::factory()->create([
            'organization_id' => $organization->id,
            'student_id' => $student->id,
            'class_id' => $class->id,
            'status' => 'active',
        ]);

        return $this->actingAsRole('teacher', ['teacher_id' => $teacher->id], $organization);
    }

    /** Sends subsequent requests with this Bearer token. */
    protected function useToken(string $token): void
    {
        $this->forgetAuthState();
        $this->withToken($token);
    }

    /** Sends subsequent requests without credentials. */
    protected function asGuest(): void
    {
        $this->forgetAuthState();
        $this->withoutToken();
    }

    /**
     * Every test request starts like a fresh PHP request: no memoized guard
     * user, no tenant context left over from the previous request.
     */
    public function call($method, $uri, $parameters = [], $cookies = [], $files = [], $server = [], $content = null)
    {
        $this->forgetAuthState();

        return parent::call($method, $uri, $parameters, $cookies, $files, $server, $content);
    }

    /**
     * The auth manager memoizes the resolved user across requests inside one
     * test; forget it so each request authenticates from its own token.
     */
    protected function forgetAuthState(): void
    {
        $this->app['auth']->forgetGuards();
        $this->app->make(TenantContext::class)->clear();
    }

    /** Binds the tenant context for tests that call services without HTTP. */
    protected function bindTenant(Organization|string $organization): void
    {
        $this->app->make(TenantContext::class)->set(
            $organization instanceof Organization ? $organization->id : $organization,
        );
    }
}
