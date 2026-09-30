<?php

namespace App\Support\Authorization;

use App\Support\Api\ApiException;

/**
 * Raised where behavior depends on an unresolved owner decision (PB-1..PB-5).
 *
 * The server fails CLOSED: 403 `OWNER_DECISION_REQUIRED_PB<n>` with the
 * decision id and a detail naming the undecided case. Never replace a throw of
 * this class with a guess; record the owner's decision first.
 */
final class OwnerDecisionRequired extends ApiException
{
    public function __construct(public readonly string $decision, string $detail)
    {
        $number = preg_replace('/\D/', '', $decision);

        parent::__construct(
            403,
            'OWNER_DECISION_REQUIRED_PB'.$number,
            'این عملیات تا تصمیم مالک محصول مسدود است.',
            [],
            ['decision' => $decision, 'detail' => $detail],
        );
    }
}
