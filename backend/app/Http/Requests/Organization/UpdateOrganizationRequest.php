<?php

namespace App\Http\Requests\Organization;

use App\Domain\Organization\OrganizationPolicy;
use App\Domain\Organization\OrganizationRules;
use App\Domain\Organization\OrganizationService;
use App\Http\Requests\ApiFormRequest;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Validation\Rule;

/**
 * Body of PATCH /organization (TS `UpdateOrganizationInput`).
 *
 * Every rule here mirrors `validateOrganizationInput()` in
 * src/domains/organization/types.ts, including its bounds (`RULE_BOUNDS`), so a
 * value refused by the client is refused by the server for the same reason and
 * lands in the same `fields` shape. The client's validation is a convenience;
 * this one is the control.
 *
 * All fields are `sometimes`: a patch carries only what changed.
 */
final class UpdateOrganizationRequest extends ApiFormRequest
{
    protected string $errorCode = 'ORGANIZATION_INVALID';

    protected string $errorMessage = 'قواعد آموزشگاه معتبر نیست.';

    /** The policy runs before validation: a caller without settings.write gets 403, never a 422. */
    protected function authorizeBeforeValidation(): void
    {
        app(OrganizationPolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'name' => ['sometimes', 'string', 'min:1', 'max:120'],
            'tagline' => ['sometimes', 'string', 'max:200'],
            'locale' => ['sometimes', 'string', 'max:16'],
            'direction' => ['sometimes', Rule::in(['rtl', 'ltr'])],
            'calendar' => ['sometimes', Rule::in(['jalali', 'gregorian'])],
            'currency' => ['sometimes', Rule::in(['toman', 'rial'])],
            'firstWeekday' => ['sometimes', 'integer', 'between:0,6'],

            /* ---- session rules (RULE_BOUNDS) ---- */
            'defaultSessionMinutes' => ['sometimes', 'integer', 'between:15,480'],
            'sessionGapMinutes' => ['sometimes', 'integer', 'between:0,120'],
            'cancellationGraceHours' => ['sometimes', 'integer', 'between:0,168'],
            'maxMakeupsPerTerm' => ['sometimes', 'integer', 'between:0,24'],

            /* ---- working hours ---- */
            'workingDayStart' => ['sometimes', 'date_format:H:i', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'workingDayEnd' => ['sometimes', 'date_format:H:i', 'regex:/^([01]\d|2[0-3]):[0-5]\d$/'],
            'closedWeekdays' => ['sometimes', 'array', 'max:6'],
            'closedWeekdays.*' => ['integer', 'between:0,6'],
        ];
    }

    /** @return array<string, string> */
    public function messages(): array
    {
        return [
            'closedWeekdays.max' => 'حداقل یک روز هفته باید روز کاری باشد.',
            'closedWeekdays.*.integer' => 'روز تعطیل نامعتبر است.',
            'closedWeekdays.*.between' => 'روز تعطیل نامعتبر است.',
            'firstWeekday.between' => 'روز نخست هفته نامعتبر است.',
            'firstWeekday.integer' => 'روز نخست هفته نامعتبر است.',
            'workingDayStart.date_format' => 'ساعت باید به شکل HH:mm و در بازهٔ ۰۰:۰۰ تا ۲۳:۵۹ باشد.',
            'workingDayStart.regex' => 'ساعت باید به شکل HH:mm و در بازهٔ ۰۰:۰۰ تا ۲۳:۵۹ باشد.',
            'workingDayEnd.date_format' => 'ساعت باید به شکل HH:mm و در بازهٔ ۰۰:۰۰ تا ۲۳:۵۹ باشد.',
            'workingDayEnd.regex' => 'ساعت باید به شکل HH:mm و در بازهٔ ۰۰:۰۰ تا ۲۳:۵۹ باشد.',
        ];
    }

    /**
     * The window is validated as a PAIR, against the stored other half when the
     * patch changes only one side — otherwise "start 22:00" would pass on its
     * own and leave the academy with a window that closes before it opens. This
     * is the server copy of the rule `LocalOrganizationRepository` applies.
     */
    protected function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $data = $validator->getData();
            $start = $data['workingDayStart'] ?? null;
            $end = $data['workingDayEnd'] ?? null;

            if ($start === null && $end === null) {
                return;
            }

            $current = app(OrganizationService::class)->get();
            $start ??= (string) $current->working_day_start;
            $end ??= (string) $current->working_day_end;

            // A malformed side is already reported by the shape rules above; do
            // not stack a second, contradictory error on top of it.
            if (! OrganizationRules::isTimeOfDay((string) $start) || ! OrganizationRules::isTimeOfDay((string) $end)) {
                return;
            }

            $from = OrganizationRules::timeToMinutes((string) $start);
            $to = OrganizationRules::timeToMinutes((string) $end);

            if ($from === null || $to === null || $to <= $from) {
                $validator->errors()->add('workingDayEnd', 'پایان روز کاری باید پس از شروع آن باشد.');
            }
        });
    }
}
