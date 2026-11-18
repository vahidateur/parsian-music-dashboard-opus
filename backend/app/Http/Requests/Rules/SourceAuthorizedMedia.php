<?php

namespace App\Http\Requests\Rules;

use App\Domain\Media\MediaPolicy;
use App\Domain\Media\MediaReferences;
use App\Models\MediaAsset;
use App\Models\User;
use App\Support\Api\ApiException;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Support\Facades\Auth;

/**
 * Source authorization for a media reference.
 *
 * TenantRules::mediaAssetExists() proves only that an asset exists in the
 * tenant and still has private bytes. That is an integrity check, explicitly
 * not an authorization decision. Without this rule, any actor with a write
 * permission on a parent record can attach an asset they cannot read and then
 * use the parent's broader read permission to obtain the bytes.
 *
 * The rule reuses MediaPolicy::authorizeReadAsset on the asset's CURRENT
 * references, before the new reference is written. It therefore requires the
 * actor to be independently entitled to the asset in its source context,
 * while leaving the destination authorization to the existing policy checks
 * in the services. Legitimate sharing by an actor who may already read the
 * asset continues to work.
 */
final class SourceAuthorizedMedia implements ValidationRule
{
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        if (! is_string($value) || $value === '') {
            return; // null/empty means "no media"; other types are rejected by sibling rules.
        }

        $actor = Auth::user();
        if (! $actor instanceof User) {
            return; // Authentication is owned by middleware; an anonymous request never reaches here.
        }

        // Tenant-scoped by the BelongsToOrganization global scope.
        $asset = MediaAsset::query()->whereKey(trim($value))->first();
        if ($asset === null) {
            return; // Existence is reported by TenantRules::mediaAssetExists.
        }

        try {
            app(MediaPolicy::class)->authorizeReadAsset($actor, $asset, app(MediaReferences::class));
        } catch (ApiException) {
            $fail('فایل انتخاب‌شده برای این حساب مجاز نیست.');
        }
    }
}
