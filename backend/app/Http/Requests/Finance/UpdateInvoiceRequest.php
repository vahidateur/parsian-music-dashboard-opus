<?php

namespace App\Http\Requests\Finance;

use App\Domain\Finance\InvoicePolicy;
use App\Domain\Finance\InvoiceRules;
use App\Http\Requests\ApiFormRequest;

/** Body of PATCH /invoices/{id}. Every field is optional; a paid invoice refuses any edit. */
final class UpdateInvoiceRequest extends ApiFormRequest
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
            'studentId' => ['sometimes', ...$fields['studentId']],
            'title' => ['sometimes', ...$fields['title']],
            'amount' => ['sometimes', ...$fields['amount']],
            'dueAt' => $fields['dueAt'],
        ];
    }
}
