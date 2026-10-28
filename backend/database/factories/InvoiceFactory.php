<?php

namespace Database\Factories;

use App\Models\Invoice;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/** @extends Factory<Invoice> */
class InvoiceFactory extends Factory
{
    protected $model = Invoice::class;

    public function definition(): array
    {
        return [
            'id' => 'inv_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'student_id' => 'st_'.strtolower((string) Str::ulid()),
            'title' => 'شهریهٔ ترم',
            'amount' => 3000000,
            'status' => 'due',
            'issued_at' => now(),
            'due_at' => null,
            'paid_at' => null,
            'paid_by_user_id' => null,
        ];
    }
}
