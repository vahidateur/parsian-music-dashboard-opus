<?php

namespace App\Http\Requests\Roles;

use App\Domain\Roles\RolePolicy;
use App\Http\Requests\ApiFormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

final class UpdateRoleRequest extends ApiFormRequest
{
    protected string $errorCode = 'ROLE_INVALID';

    protected string $errorMessage = 'تغییرات نقش معتبر نیست.';

    protected function authorizeBeforeValidation(): void
    {
        app(RolePolicy::class)->authorizeWrite($this->user());
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'label' => ['sometimes', 'required', 'string', 'min:2', 'max:60'],
            'scope' => ['sometimes', 'nullable', 'string', 'max:255'],
            'permissions' => ['sometimes', 'present', 'array'],
            'permissions.*' => ['string', Rule::in(config('permissions.vocabulary'))],
        ];
    }

    /**
     * The one lockout the panel refuses (same rule as `validate` in
     * src/domains/auth/roleRepository.ts): administrator must keep roles.write.
     *
     * @return list<callable>
     */
    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $permissions = $this->input('permissions');
                if ($this->route('id') === 'administrator'
                    && $this->has('permissions')
                    && (! is_array($permissions) || ! in_array('roles.write', $permissions, true))
                ) {
                    $validator->errors()->add(
                        'permissions',
                        'نقش مدیر ارشد باید دسترسی «مدیریت نقش‌ها» را نگه دارد، وگرنه راه بازگشتی به این صفحه نمی‌ماند.',
                    );
                }
            },
        ];
    }
}
