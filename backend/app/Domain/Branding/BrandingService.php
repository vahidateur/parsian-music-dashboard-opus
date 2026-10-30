<?php

namespace App\Domain\Branding;

use App\Domain\Media\MediaReferenceLock;
use App\Models\Branding;
use App\Support\Api\ApiException;
use App\Support\Tenancy\TenantContext;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Academy identity persistence and defaults.
 *
 * ONE ROW PER ORGANIZATION, keyed by `organization_id` itself. `get()` never
 * 404s: an organization without a saved row reads the shipped defaults (the
 * same values the client holds), and the first `update()` persists them.
 * A missing row is "not customized yet", never "broken".
 *
 * This service carries NO actor and makes NO authorization decision: that
 * lives in BrandingPolicy, which the controller calls first. It is
 * deliberately independent of OrganizationService: identity and operating
 * rules are different records with different writers (branding.write is
 * administrator-only; the organization matrix is its own).
 */
final class BrandingService
{
    /** camelCase wire key → snake_case column. */
    private const COLUMN_MAP = [
        'academyName' => 'academy_name',
        'tagline' => 'tagline',
        'logoMediaId' => 'logo_media_id',
        'faviconMediaId' => 'favicon_media_id',
        'primaryColor' => 'primary_color',
        'accentColor' => 'accent_color',
        'textColor' => 'text_color',
        'persianFont' => 'persian_font',
    ];

    public function __construct(
        private readonly TenantContext $tenant,
        private readonly MediaReferenceLock $mediaReferenceLock,
    ) {}

    /** The caller's identity: the saved row, or the shipped defaults. */
    public function get(): Branding
    {
        $branding = Branding::query()
            ->whereKey($this->tenant->organizationId())
            ->first();

        if ($branding === null) {
            $branding = new Branding([
                'organization_id' => $this->tenant->organizationId(),
                ...self::defaults(),
            ]);
        }

        return $branding;
    }

    /**
     * Applies a validated partial patch, persisting the row when it does not
     * exist yet. Only the keys present in `$input` are written.
     *
     * @param  array<string, mixed>  $input  validated camelCase wire input
     */
    public function update(array $input): Branding
    {
        return DB::transaction(function () use ($input): Branding {
            $branding = Branding::query()
                ->whereKey($this->tenant->organizationId())
                ->lockForUpdate()
                ->first();

            if ($branding === null) {
                $branding = new Branding([
                    'organization_id' => $this->tenant->organizationId(),
                    ...self::defaults(),
                ]);
            }

            $attributes = [];
            foreach (self::COLUMN_MAP as $wireKey => $column) {
                if (array_key_exists($wireKey, $input)) {
                    $value = $input[$wireKey];
                    if (in_array($wireKey, ['academyName', 'tagline'], true)) {
                        $value = trim((string) $value);
                    }
                    if ($value === '' && in_array($wireKey, ['logoMediaId', 'faviconMediaId'], true)) {
                        $value = null;
                    }
                    $attributes[$column] = $value;
                }
            }

            if ($attributes !== []) {
                if (array_key_exists('academy_name', $attributes) && trim((string) $attributes['academy_name']) === '') {
                    throw ApiException::validation('BRANDING_INVALID', 'اطلاعات برند معتبر نیست.', [
                        'academyName' => ['نام آموزشگاه الزامی است.'],
                    ]);
                }
                $this->lockMediaAttributes($attributes);
                $branding->fill($attributes)->save();
            }

            return $branding->refresh();
        });
    }

    /** @param array<string, mixed> $attributes */
    private function lockMediaAttributes(array $attributes): void
    {
        $references = [];
        foreach (['logo_media_id' => 'logoMediaId', 'favicon_media_id' => 'faviconMediaId'] as $column => $wireKey) {
            $mediaId = $attributes[$column] ?? null;
            if (is_string($mediaId) && $mediaId !== '') {
                $references[] = ['id' => $mediaId, 'field' => $wireKey];
            }
        }
        usort($references, static fn (array $a, array $b): int => strcmp($a['id'], $b['id']));

        foreach ($references as $reference) {
            if (! $this->mediaReferenceLock->lockAvailable($reference['id'])) {
                throw ApiException::validation('BRANDING_INVALID', 'اطلاعات برند معتبر نیست.', [
                    $reference['field'] => ['فایل انتخاب‌شده یافت نشد.'],
                ]);
            }
        }
    }

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        return [
            'academy_name' => 'آموزشگاه موسیقی پارسیان',
            'tagline' => 'تالار هنر، جادو و موسیقی',
            'logo_media_id' => null,
            'favicon_media_id' => null,
            'primary_color' => '#D5AF58',
            'accent_color' => '#F4D28B',
            'text_color' => '#FFFFFF',
            'persian_font' => 'Vazirmatn',
        ];
    }

    /** @return array<string, mixed> */
    public static function toWire(Branding $branding): array
    {
        $wire = [
            'academyName' => $branding->academy_name,
            'tagline' => $branding->tagline,
            'primaryColor' => $branding->primary_color,
            'accentColor' => $branding->accent_color,
            'textColor' => $branding->text_color,
            'persianFont' => $branding->persian_font,
            'updatedAt' => $branding->updated_at?->toJSON() ?? Carbon::now()->toJSON(),
        ];
        if ($branding->logo_media_id !== null && $branding->logo_media_id !== '') {
            $wire['logoMediaId'] = $branding->logo_media_id;
        }
        if ($branding->favicon_media_id !== null && $branding->favicon_media_id !== '') {
            $wire['faviconMediaId'] = $branding->favicon_media_id;
        }

        return $wire;
    }
}
