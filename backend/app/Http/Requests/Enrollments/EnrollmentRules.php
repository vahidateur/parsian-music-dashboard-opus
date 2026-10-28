<?php

namespace App\Http\Requests\Enrollments;

/** Rules shared by the enrollment write requests (camelCase wire keys). */
final class EnrollmentRules
{
    /** @return array<string, list<string>> */
    public static function pricingPlan(): array
    {
        return [
            'pricingPlan' => ['sometimes', 'array:label,amount'],
            'pricingPlan.label' => ['required_with:pricingPlan', 'string', 'max:60'],
            'pricingPlan.amount' => ['required_with:pricingPlan', 'integer', 'min:0'],
        ];
    }
}
