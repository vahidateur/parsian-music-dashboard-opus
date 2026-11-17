<?php

namespace App\Http\Resources;

use App\Models\Enrollment;
use App\Models\User;

/**
 * Wire shape = TS `Enrollment` (camelCase), read unmapped by ApiEnrollmentRepository.
 *
 * T-02-C (C1): a teacher response omits the pricing plan. The teacher sees only
 * active enrollments in classes they own; the financial snapshot is not part of
 * that operational read.
 */
final class EnrollmentResource
{
    /** @return array<string, mixed> */
    public static function toWire(Enrollment $enrollment, ?User $actor = null): array
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

        if ($actor?->role !== 'teacher') {
            $wire['pricingPlan'] = [
                'label' => $enrollment->pricing_label,
                'amount' => $enrollment->pricing_amount,
            ];
        }

        return $wire;
    }
}
