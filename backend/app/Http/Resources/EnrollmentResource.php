<?php

namespace App\Http\Resources;

use App\Models\Enrollment;

/** Wire shape = TS `Enrollment` (camelCase), read unmapped by ApiEnrollmentRepository. */
final class EnrollmentResource
{
    /** @return array<string, mixed> */
    public static function toWire(Enrollment $enrollment): array
    {
        $wire = [
            'id' => $enrollment->id,
            'studentId' => $enrollment->student_id,
            'classId' => $enrollment->class_id,
            'status' => $enrollment->status,
            'startDate' => $enrollment->start_date,
        ];
        if ($enrollment->end_date !== null && $enrollment->end_date !== '') {
            $wire['endDate'] = $enrollment->end_date;
        }
        $wire['pricingPlan'] = [
            'label' => $enrollment->pricing_label,
            'amount' => $enrollment->pricing_amount,
        ];

        return $wire;
    }
}
