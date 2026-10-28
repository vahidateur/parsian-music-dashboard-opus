<?php

namespace App\Domain\Finance;

use App\Http\Requests\TenantRules;

/**
 * Invoice field shapes. The finance vocabulary already carries
 * `finance.read` / `finance.write` (granted to administrator, manager-read,
 * accountant), so — exactly like §39's compensation slice — no new
 * permission id is created.
 */
final class InvoiceRules
{
    /** Fields a create must carry. */
    public const REQUIRED = ['studentId', 'title', 'amount'];

    /** @return array<string, list<mixed>> */
    public static function fields(): array
    {
        return [
            'studentId' => ['string', 'max:64', TenantRules::studentExists()],
            'title' => ['string', 'min:2', 'max:120'],
            'amount' => ['integer', 'min:1', 'max:1000000000'],
            'dueAt' => ['nullable', 'date'],
        ];
    }
}
