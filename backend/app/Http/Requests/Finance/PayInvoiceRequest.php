<?php

namespace App\Http\Requests\Finance;

use App\Domain\Finance\InvoicePolicy;
use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;

/**
 * Body of POST /invoices/{id}/pay: how the single accepted payment arrived.
 *
 * `transfer` is the card-to-card path the academy runs on: the accountant
 * verifies the bank receipt and records its tracking code here. `pos` is the
 * in-academy terminal. The server records the authenticated user as the
 * accepter — a client-supplied payer would be an unverified claim.
 */
final class PayInvoiceRequest extends ApiFormRequest
{
    protected string $errorCode = 'INVOICE_INVALID';

    protected string $errorMessage = 'اطلاعات پرداخت معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(InvoicePolicy::class)->authorizePay($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'method' => ['required', 'string', Rule::in(['pos', 'transfer'])],
            'reference' => ['nullable', 'string', 'max:64'],
        ];
    }
}
