<?php

namespace App\Http\Requests\Finance;

use App\Domain\Finance\InvoicePolicy;
use App\Domain\Finance\InvoiceRules;
use App\Http\Requests\ApiFormRequest;

/**
 * Body of POST /invoices (TS `CreateInvoiceInput`, minus the actor: the
 * server records the authenticated user on pay, never a client-supplied
 * payer — the same rule as chat's `from` and compensation's actor).
 */
final class StoreInvoiceRequest extends ApiFormRequest
{
    protected string $errorCode = 'INVOICE_INVALID';

    protected string $errorMessage = 'اطلاعات فاکتور معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(InvoicePolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        $fields = InvoiceRules::fields();

        return [
            'studentId' => ['required', ...$fields['studentId']],
            'title' => ['required', ...$fields['title']],
            'amount' => ['required', ...$fields['amount']],
            'dueAt' => $fields['dueAt'],
        ];
    }
}
