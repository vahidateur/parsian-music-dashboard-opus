<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use RuntimeException;

/**
 * Seeds the demo dataset (repo-root data/dataset/*.json) into the demo
 * organization. LOCAL / TESTING ONLY: throws in any other environment.
 *
 * No credential lives in a committed file: users get a password only when the
 * DEMO_SEED_PASSWORD environment variable (config('demo.seed_password')) is
 * non-empty; otherwise their
 * password is null and they cannot sign in.
 *
 * One method per collection; later slices add teachers, rooms, students,
 * classes and enrollments in dataset order.
 */
class DemoDatasetSeeder extends Seeder
{
    public const ORGANIZATION_ID = 'org_demo';

    public function run(): void
    {
        if (! app()->environment(['local', 'testing'])) {
            throw new RuntimeException('DemoDatasetSeeder runs only in the local and testing environments.');
        }

        DB::transaction(function (): void {
            $this->seedOrganization();
            $this->seedUsers();
            $this->seedRoles();
        });
    }

    protected function seedOrganization(): void
    {
        $organization = $this->dataset('organization');
        $now = now();

        DB::table('organizations')->insert([
            'id' => self::ORGANIZATION_ID,
            'slug' => 'demo',
            'name' => (string) $organization['name'],
            'status' => 'active',
            'created_at' => $now,
            'updated_at' => $now,
        ]);
    }

    protected function seedUsers(): void
    {
        $seedPassword = (string) config('demo.seed_password', '');
        $hash = $seedPassword !== '' ? Hash::make($seedPassword) : null;

        foreach ($this->dataset('users') as $user) {
            DB::table('users')->insert([
                'id' => (string) $user['id'],
                'organization_id' => self::ORGANIZATION_ID,
                'name' => (string) $user['name'],
                'email' => mb_strtolower(trim((string) $user['email'])),
                'phone' => $user['phone'] ?? null,
                'role' => (string) $user['role'],
                'status' => (string) ($user['status'] ?? 'active'),
                'teacher_id' => $user['teacherId'] ?? null,
                'password' => $hash,
                'created_at' => $this->timestamp($user['createdAt'] ?? null),
                'updated_at' => $this->timestamp($user['updatedAt'] ?? null),
            ]);
        }
    }

    protected function seedRoles(): void
    {
        foreach ($this->dataset('roles') as $role) {
            $permissions = $role['permissions'] ?? null;

            DB::table('roles')->insert([
                'organization_id' => self::ORGANIZATION_ID,
                'id' => (string) $role['id'],
                'label' => (string) $role['label'],
                'scope' => (string) ($role['scope'] ?? ''),
                'permissions' => is_array($permissions) ? json_encode(array_values($permissions)) : null,
                'updated_at' => isset($role['updatedAt']) ? $this->timestamp($role['updatedAt']) : null,
            ]);
        }
    }

    /** @return array<mixed> */
    protected function dataset(string $name): array
    {
        $path = base_path('../data/dataset/'.$name.'.json');
        if (! is_file($path)) {
            throw new RuntimeException("Demo dataset file missing: data/dataset/{$name}.json");
        }

        return json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    protected function timestamp(?string $iso): string
    {
        return ($iso ? Carbon::parse($iso) : now())->utc()->format('Y-m-d H:i:s');
    }
}
