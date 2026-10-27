<?php

namespace App\Domain\Finance;

use App\Models\Invoice;
use App\Models\Student;
use App\Models\User;
use App\Support\Api\ApiException;
use App\Support\Tenancy\TenantContext;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Invoice persistence and domain rules of the caller's organization.
 *
 * v1 is deliberately narrow (DECISIONS.md §40): issue due, discharge by one
 * accepted payment. No partial payments, no balance sync — paying flips the
 * invoice to paid and records who accepted it, nothing else.
 *
 * Permission checks live in `InvoicePolicy`, called first by the controller
 * and again here: the service is the authoritative boundary. Tenant
 * isolation rides the models' own global scope (fail closed with no
 * resolved organization), so a cross-tenant id reads exactly like a
 * missing one.
 */
final class InvoiceService
{
    public function __construct(
        private readonly TenantContext $tenant,
        private readonly InvoicePolicy $policy,
    ) {}

    /** @param array<string, mixed> $filters */
    public function list(User $actor, array $filters, int $page, int $perPage): LengthAwarePaginator
    {
        $this->policy->authorizeRead($actor);

        $query = Invoice::query();
        if (filled($filters['studentId'] ?? null)) {
            $query->where('student_id', trim((string) $filters['studentId']));
        }
        if (filled($filters['status'] ?? null)) {
            $query->where('status', trim((string) $filters['status']));
        }

        $total = (clone $query)->count();
        $rows = $query->orderByDesc('issued_at')->orderBy('id')
            ->forPage($page, $perPage)->get();

        return new LengthAwarePaginator(
            $rows->map(fn (Invoice $row) => $this->toWire($row))->all(),
            $total,
            $perPage,
            $page,
        );
    }

    /** @return array<string, mixed> */
    public function get(User $actor, string $id): array
    {
        $this->policy->authorizeRead($actor);

        return $this->toWire($this->find($id));
    }

    /** @param array<string, mixed> $input validated wire input */
    public function issue(User $actor, array $input): array
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($actor, $input): array {
            $this->assertStudent($input['studentId']);

            $row = new Invoice([
                'id' => 'inv_'.strtolower((string) Str::ulid()),
                'student_id' => trim((string) $input['studentId']),
                'title' => trim((string) $input['title']),
                'amount' => (int) $input['amount'],
                'status' => 'due',
                'issued_at' => Carbon::now(),
                'due_at' => filled($input['dueAt'] ?? null) ? (string) $input['dueAt'] : null,
            ]);
            $row->save();

            return $this->toWire($row->refresh());
        });
    }

    /** @param array<string, mixed> $input validated wire input */
    public function update(User $actor, string $id, array $input): array
    {
        $this->policy->authorizeWrite($actor);

        return DB::transaction(function () use ($actor, $id, $input): array {
            $row = Invoice::query()->whereKey($id)->lockForUpdate()->first()
                ?? throw ApiException::notFound('INVOICE_NOT_FOUND', 'فاکتور یافت نشد.');
            $this->assertOpen($row);

            if (array_key_exists('studentId', $input)) {
                $this->assertStudent($input['studentId']);
                $row->student_id = trim((string) $input['studentId']);
            }
            if (array_key_exists('title', $input)) {
                $row->title = trim((string) $input['title']);
            }
            if (array_key_exists('amount', $input)) {
                $row->amount = (int) $input['amount'];
            }
            if (array_key_exists('dueAt', $input)) {
                $row->due_at = filled($input['dueAt']) ? (string) $input['dueAt'] : null;
            }
            $row->save();

            return $this->toWire($row->refresh());
        });
    }

    /** Discharge by the one accepted payment. Idempotent refusal, not a toggle. */
    public function pay(User $actor, string $id, array $input = []): array
    {
        $this->policy->authorizePay($actor);

        return DB::transaction(function () use ($actor, $id, $input): array {
            $row = Invoice::query()->whereKey($id)->lockForUpdate()->first()
                ?? throw ApiException::notFound('INVOICE_NOT_FOUND', 'فاکتور یافت نشد.');
            $this->assertOpen($row);

            $row->status = 'paid';
            $row->paid_at = Carbon::now();
            $row->paid_by_user_id = $actor->id;
            $row->paid_method = (string) ($input['method'] ?? 'pos');
            $row->paid_reference = filled($input['reference'] ?? null) ? trim((string) $input['reference']) : null;
            $row->save();

            return $this->toWire($row->refresh());
        });
    }

    private function find(string $id): Invoice
    {
        return Invoice::query()->whereKey($id)->first()
            ?? throw ApiException::notFound('INVOICE_NOT_FOUND', 'فاکتور یافت نشد.');
    }

    private function assertOpen(Invoice $row): void
    {
        if ($row->status !== 'due') {
            throw ApiException::conflict('INVOICE_ALREADY_PAID', 'این فاکتور قبلاً پرداخت شده است.');
        }
    }

    private function assertStudent(mixed $studentId): void
    {
        if (! is_string($studentId) || Student::query()->whereKey(trim($studentId))->first() === null) {
            throw ApiException::validation('INVOICE_INVALID', 'اطلاعات فاکتور معتبر نیست.', [
                'studentId' => ['هنرجوی انتخاب‌شده وجود ندارد.'],
            ]);
        }
    }

    /** @return array<string, mixed> */
    private function toWire(Invoice $row): array
    {
        $student = $row->student_id !== ''
            ? Student::query()->whereKey($row->student_id)->first()
            : null;

        return [
            'id' => $row->id,
            'studentId' => $row->student_id,
            'studentName' => $student?->name,
            'title' => $row->title,
            'amount' => (int) $row->amount,
            'status' => $row->status,
            'issuedAt' => $row->issued_at?->toJSON(),
            'dueAt' => $row->due_at,
            'paidAt' => $row->paid_at?->toJSON(),
            'paidByUserId' => $row->paid_by_user_id,
            'paidMethod' => $row->paid_method,
            'paidReference' => $row->paid_reference,
        ];
    }
}
