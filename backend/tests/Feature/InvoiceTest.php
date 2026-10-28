<?php

namespace Tests\Feature;

use App\Models\Invoice;
use App\Models\Student;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private function makeStudent(): Student
    {
        return Student::factory()->create(['organization_id' => $this->defaultOrganization()->id]);
    }

    private function payload(Student $student, array $overrides = []): array
    {
        return [
            'studentId' => $student->id,
            'title' => 'شهریهٔ ترم پاییز',
            'amount' => 3000000,
            ...$overrides,
        ];
    }

    /** @return list<array{0: string, 1: string, 2: array<string, mixed>}> */
    private function endpoints(string $id): array
    {
        return [
            ['GET', '/api/v1/invoices', []],
            ['GET', "/api/v1/invoices/$id", []],
            ['POST', '/api/v1/invoices', ['studentId' => 'st_x', 'title' => 'x', 'amount' => 1]],
            ['PATCH', "/api/v1/invoices/$id", ['title' => 'y']],
            ['POST', "/api/v1/invoices/$id/pay", ['method' => 'pos']],
        ];
    }

    public function test_unauthenticated_is_401_before_the_policy(): void
    {
        foreach ($this->endpoints('inv_x') as [$method, $uri, $body]) {
            $this->json($method, $uri, $body)->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        }
    }

    public function test_reading_requires_finance_read(): void
    {
        $this->actingAsRole('accountant');
        $id = $this->postJson('/api/v1/invoices', $this->payload($this->makeStudent()))->assertCreated()->json('data.id');

        foreach (['administrator', 'manager', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/invoices')->assertOk();
            $this->getJson("/api/v1/invoices/$id")->assertOk();
        }

        // Teachers and reception hold no finance id.
        foreach (['teacher', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/invoices')->assertStatus(403)->assertJsonPath('error.permission', 'finance.read');
        }
    }

    public function test_writing_requires_finance_write(): void
    {
        $student = $this->makeStudent();

        foreach (['administrator', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/v1/invoices', $this->payload($student))->assertCreated();
        }

        // Issuing stays with administrator/accountant: manager reads finance
        // and staff holds no finance id for authoring.
        foreach (['manager', 'teacher', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/v1/invoices', $this->payload($student))
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'finance.write');
        }
    }

    public function test_paying_requires_finance_pay(): void
    {
        $this->actingAsRole('accountant');
        $student = $this->makeStudent();

        // Administrator, accountant, manager and staff confirm payments;
        // teachers hold no finance id at all.
        $ids = [];
        foreach (['administrator', 'accountant', 'manager', 'staff'] as $role) {
            $this->actingAsRole('accountant');
            $ids[$role] = $this->postJson('/api/v1/invoices', $this->payload($student))->assertCreated()->json('data.id');
        }
        foreach (['administrator', 'accountant', 'manager', 'staff'] as $role) {
            $this->actingAsRole($role);
            $this->postJson("/api/v1/invoices/{$ids[$role]}/pay", ['method' => 'pos'])->assertOk();
        }
        $this->actingAsRole('accountant');
        $id = $this->postJson('/api/v1/invoices', $this->payload($student))->assertCreated()->json('data.id');
        $this->actingAsRole('teacher');
        $this->postJson("/api/v1/invoices/$id/pay", ['method' => 'pos'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'finance.pay');
    }

    public function test_issue_validates_its_inputs(): void
    {
        $this->actingAsRole('accountant');
        $student = $this->makeStudent();

        // Missing fields.
        $this->postJson('/api/v1/invoices', ['title' => 'x', 'amount' => 1])
            ->assertStatus(422)->assertJsonPath('error.code', 'INVOICE_INVALID')
            ->assertJsonPath('error.fields.studentId.0', 'The student id field is required.');
        $this->postJson('/api/v1/invoices', $this->payload($student, ['title' => 'x']))
            ->assertStatus(422)->assertJsonPath('error.code', 'INVOICE_INVALID');

        // Unknown student.
        $this->postJson('/api/v1/invoices', $this->payload($student, ['studentId' => 'st_missing']))
            ->assertStatus(422)->assertJsonPath('error.code', 'INVOICE_INVALID')
            ->assertJsonPath('error.fields.studentId.0', 'هنرجوی انتخاب‌شده وجود ندارد.');

        // Cross-tenant student reads exactly like a missing one.
        $other = Student::factory()->create(['organization_id' => $this->makeOrganization()->id]);
        $this->postJson('/api/v1/invoices', $this->payload($student, ['studentId' => $other->id]))
            ->assertStatus(422)->assertJsonPath('error.code', 'INVOICE_INVALID');

        // Non-positive amounts are refused.
        foreach ([0, -5] as $amount) {
            $this->postJson('/api/v1/invoices', $this->payload($student, ['amount' => $amount]))
                ->assertStatus(422)->assertJsonPath('error.code', 'INVOICE_INVALID');
        }
    }

    public function test_issue_creates_a_due_invoice_with_the_wire_shape(): void
    {
        $this->actingAsRole('accountant');
        $student = $this->makeStudent();

        $created = $this->postJson('/api/v1/invoices', $this->payload($student, [
            'dueAt' => Carbon::today()->addDays(10)->toDateString(),
        ]))->assertCreated()->json('data');

        $this->assertSame('due', $created['status']);
        $this->assertSame($student->id, $created['studentId']);
        $this->assertSame($student->name, $created['studentName']);
        $this->assertSame(3000000, $created['amount']);
        $this->assertNotNull($created['issuedAt']);
        $this->assertNull($created['paidAt']);
        $this->assertNull($created['paidByUserId']);
        $this->assertNotNull(
            Invoice::query()->whereKey($created['id'])->value('id'),
        );
    }

    public function test_list_accepts_the_snake_case_wire_filters(): void
    {
        $this->actingAsRole('accountant');
        $a = $this->makeStudent();
        $b = $this->makeStudent();
        $id = $this->postJson('/api/v1/invoices', $this->payload($a))->assertCreated()->json('data.id');
        $this->postJson('/api/v1/invoices', $this->payload($b))->assertCreated();

        $this->getJson('/api/v1/invoices?student_id='.$a->id)
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $id);
        $this->getJson('/api/v1/invoices?status=due')
            ->assertOk()
            ->assertJsonPath('meta.total', 2);

        $this->postJson("/api/v1/invoices/$id/pay", ['method' => 'pos'])->assertOk();
        $this->getJson('/api/v1/invoices?status=paid')
            ->assertOk()
            ->assertJsonPath('meta.total', 1);
    }

    public function test_pay_discharges_once_and_names_the_actor(): void
    {
        $accountant = $this->actingAsRole('accountant');
        $id = $this->postJson('/api/v1/invoices', $this->payload($this->makeStudent()))->assertCreated()->json('data.id');

        $paid = $this->postJson("/api/v1/invoices/$id/pay", ['method' => 'transfer', 'reference' => 'TT-123456'])
            ->assertOk()
            ->assertJsonPath('data.status', 'paid')
            ->json('data');
        $this->assertNotNull($paid['paidAt']);
        $this->assertSame($accountant->id, $paid['paidByUserId']);
        $this->assertSame('transfer', $paid['paidMethod']);
        $this->assertSame('TT-123456', $paid['paidReference']);

        // Discharge is terminal.
        $this->postJson("/api/v1/invoices/$id/pay", ['method' => 'pos'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'INVOICE_ALREADY_PAID');
    }

    public function test_pay_validates_how_it_arrived(): void
    {
        $this->actingAsRole('accountant');
        $id = $this->postJson('/api/v1/invoices', $this->payload($this->makeStudent()))->assertCreated()->json('data.id');

        // The method is required and closed: free text would make the receipt
        // unreportable and the future bot/app channels unparseable.
        $this->postJson("/api/v1/invoices/$id/pay", [])
            ->assertStatus(422)->assertJsonPath('error.code', 'INVOICE_INVALID');
        $this->postJson("/api/v1/invoices/$id/pay", ['method' => 'cash'])
            ->assertStatus(422)->assertJsonPath('error.code', 'INVOICE_INVALID');
    }

    public function test_update_is_due_only_and_missing_is_404(): void
    {
        $this->actingAsRole('accountant');
        $id = $this->postJson('/api/v1/invoices', $this->payload($this->makeStudent()))->assertCreated()->json('data.id');

        $this->getJson('/api/v1/invoices/inv_missing')->assertStatus(404)->assertJsonPath('error.code', 'INVOICE_NOT_FOUND');
        $this->patchJson('/api/v1/invoices/inv_missing', ['title' => 'شهریه'])->assertStatus(404);
        $this->postJson('/api/v1/invoices/inv_missing/pay', ['method' => 'pos'])->assertStatus(404);

        $this->patchJson("/api/v1/invoices/$id", ['title' => 'شهریهٔ اصلاح‌شده', 'amount' => 2500000])
            ->assertOk()
            ->assertJsonPath('data.title', 'شهریهٔ اصلاح‌شده')
            ->assertJsonPath('data.amount', 2500000);

        $this->postJson("/api/v1/invoices/$id/pay", ['method' => 'pos'])->assertOk();
        $this->patchJson("/api/v1/invoices/$id", ['title' => 'دیر است'])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'INVOICE_ALREADY_PAID');
    }

    public function test_invoices_are_tenant_isolated(): void
    {
        $this->actingAsRole('accountant');
        $id = $this->postJson('/api/v1/invoices', $this->payload($this->makeStudent()))->assertCreated()->json('data.id');

        $otherOrg = $this->makeOrganization();
        $this->actingAsRole('accountant', [], $otherOrg);
        $this->getJson('/api/v1/invoices')->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson("/api/v1/invoices/$id")->assertStatus(404);
        $this->postJson("/api/v1/invoices/$id/pay", ['method' => 'pos'])->assertStatus(404);
    }
}
