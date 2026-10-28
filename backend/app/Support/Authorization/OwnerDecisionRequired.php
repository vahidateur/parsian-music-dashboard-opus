<?php

namespace App\Support\Authorization;

use App\Support\Api\ApiException;

/**
 * Raised where an owner decision (PB-1..PB-5) blocks an operation.
 *
 * PB-1..PB-5 were ALL resolved on 2026-10-02 as option A — keep the existing
 * restrictive behaviour. This exception is therefore no longer a placeholder
 * for an open question: it is the guard that implements the chosen policy, and
 * it is expected to keep firing (403 OWNER_DECISION_REQUIRED_PB<n>). The
 * unwinding of the decisions is recorded in docs/engineering/DECISIONS.md.
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
