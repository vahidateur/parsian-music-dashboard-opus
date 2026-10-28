<?php

namespace App\Http\Requests\Students;

use App\Http\Requests\TenantRules;
use App\Models\Student;
use App\Support\NationalId;
use Closure;
use Illuminate\Validation\Rule;

/** Field rules shared by StoreStudentRequest and UpdateStudentRequest (camelCase wire keys). */
final class StudentRules
{
    /** First-class fields a create must carry. */
    public const REQUIRED = ['nationalId', 'name', 'instrument', 'level', 'levelStep', 'status', 'payment', 'age', 'phone', 'since'];

    /** @return array<string, list<mixed>> */
    public static function fields(): array
    {
        return [
            'nationalId' => ['string', 'max:32', self::nationalIdValid()],
            'name' => ['string', 'min:2', 'max:120'],
            'instrument' => ['string', 'max:64'],
            'teacherId' => ['nullable', 'string', 'max:64', TenantRules::teacherExists()],
            'level' => ['string', 'max:60'],
            'levelStep' => ['integer', 'min:1', 'max:6'],
            'status' => ['string', Rule::in(Student::STATUSES)],
            'payment' => ['string', Rule::in(Student::PAYMENTS)],
            'age' => ['integer', 'min:1', 'max:120'],
            'phone' => ['string', 'max:32'],
            'guardian' => ['nullable', 'string', 'max:120'],
            'since' => ['string', 'max:32'],

            // Deferred fields: type-only (plan section 7), except the photo,
            // whose asset must exist in this organization — a row that names a
            // missing file would render "no image" forever.
            'photoMediaId' => ['nullable', 'string', 'max:64', TenantRules::mediaAssetExists()],
            'sessionsUsed' => ['integer'],
            'sessionsTotal' => ['integer'],
            'attendance' => ['integer'],
            'progress' => ['integer'],
            'balance' => ['integer'],
            'lastSeen' => ['string', 'max:64'],
            'nextClass' => ['nullable', 'array'],
            'nextClass.day' => ['required_with:nextClass', 'string', 'max:64'],
            'nextClass.time' => ['required_with:nextClass', 'string', 'max:64'],
            'nextClass.room' => ['required_with:nextClass', 'string', 'max:64'],
            'notes' => ['array'],
            'notes.*.by' => ['required', 'string', 'max:120'],
            'notes.*.date' => ['required', 'string', 'max:64'],
            'notes.*.text' => ['required', 'string', 'max:4000'],
            'activity' => ['array'],
            'activity.*.date' => ['required', 'string', 'max:64'],
            'activity.*.kind' => ['required', Rule::in(['session', 'payment', 'note', 'enroll', 'absence', 'message'])],
            'activity.*.text' => ['required', 'string', 'max:4000'],
            'skills' => ['array'],
            'skills.*.label' => ['required', 'string', 'max:64'],
            'skills.*.value' => ['required', 'integer'],
        ];
    }

    /** @return array<string, mixed> */
    public static function rules(bool $create): array
    {
        $rules = [];
        foreach (self::fields() as $field => $fieldRules) {
            if (str_contains($field, '.')) {
                $rules[$field] = $fieldRules;
            } elseif (in_array($field, self::REQUIRED, true)) {
                $rules[$field] = $create ? ['required', ...$fieldRules] : ['sometimes', 'filled', ...$fieldRules];
            } else {
                $rules[$field] = ['sometimes', ...$fieldRules];
            }
        }

        return $rules;
    }

    /** Checksum rules of src/lib/nationalId.ts (validateNationalId). */
    private static function nationalIdValid(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $error = NationalId::validate(is_string($value) ? $value : '');
            if ($error !== null) {
                $fail(NationalId::MESSAGES[$error]);
            }
        };
    }
}
