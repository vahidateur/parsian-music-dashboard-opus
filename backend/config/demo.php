<?php

return [
    /*
     * Local/testing demo seed only (Database\Seeders\DemoDatasetSeeder).
     * Blank = seeded users get no password and cannot sign in. Never commit a
     * value; set DEMO_SEED_PASSWORD in the shell or an uncommitted .env.
     */
    'seed_password' => (string) env('DEMO_SEED_PASSWORD', ''),
];
