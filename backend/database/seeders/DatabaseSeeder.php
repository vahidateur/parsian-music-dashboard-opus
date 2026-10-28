<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database. The demo dataset is seeded ONLY in the
     * local and testing environments; everywhere else seeding is a no-op.
     */
    public function run(): void
    {
        if (app()->environment(['local', 'testing'])) {
            $this->call(DemoDatasetSeeder::class);
        }
    }
}
