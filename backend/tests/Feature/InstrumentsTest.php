<?php

namespace Tests\Feature;

use App\Models\AcademyClass;
use App\Models\Instrument;
use App\Models\MediaAsset;
use App\Models\Teacher;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

/**
 * Instruments — the runtime lookup table every record carrying an
 * `instrument` field resolves against.
 *
 * WHAT IS ASSERTED HERE
 *  - the wire contract of `src/domains/instruments/apiRepository.ts`:
 *    the camelCase shape, the paged envelope, `activeOnly` filtering and
 *    search, and the 201/200/204/404 statuses;
 *  - the identity rules carried over from the client: slug is the id,
 *    slugs match the safe-machine-key alphabet, and a slug cannot be
 *    renamed after creation;
 *  - uniqueness per organization: the same slug and the same name each
 *    conflict, and two organizations may define the same ones without
 *    colliding;
 *  - referential safety: an instrument referenced by a teacher, student,
 *    class, resource or piece cannot be deleted (INSTRUMENT_IN_USE);
 *  - authorization: every role may read (it is a lookup table), only
 *    administrator and manager may write.
 */
class InstrumentsTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    private const BASE = '/api/v1/instruments';

    /** @param  array<string, mixed>  $overrides */
    private function payload(array $overrides = []): array
    {
        return [
            'name' => 'سنتور',
            'slug' => 'santoor',
            'description' => 'ساز زهی مضرابی ایرانی.',
            'active' => true,
            ...$overrides,
        ];
    }

    /**
     * The seeded `piano`, created in the actor's own organization.
     *
     * Tests build their own rows rather than relying on the demo seed: the
     * tenant scope means another organization's rows are invisible, so a
     * shared seed could never serve as a fixture here.
     */
    private function piano(string $organizationId): Instrument
    {
        return Instrument::factory()->create([
            'id' => 'piano',
            'slug' => 'piano',
            'name' => 'پیانو',
            'organization_id' => $organizationId,
        ]);
    }

    /* ------------------------------------------------------------------ */
    /* authentication                                                       */
    /* ------------------------------------------------------------------ */

    public function test_unauthenticated_is_401(): void
    {
        $this->asGuest();

        $this->getJson(self::BASE)->assertStatus(401);
        $this->postJson(self::BASE, $this->payload())->assertStatus(401);
        $this->getJson(self::BASE.'/piano')->assertStatus(401);
        $this->patchJson(self::BASE.'/piano', ['name' => 'x'])->assertStatus(401);
        $this->postJson(self::BASE.'/piano/active', ['active' => false])->assertStatus(401);
        $this->deleteJson(self::BASE.'/piano')->assertStatus(401);
    }

    /* ------------------------------------------------------------------ */
    /* reading — every authenticated role                                   */
    /* ------------------------------------------------------------------ */

    public function test_every_role_may_read(): void
    {
        // Every role shares the default test organization, so one seeded row
        // serves all five reads.
        $this->piano($this->defaultOrganization()->id);

        foreach (['administrator', 'manager', 'teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->getJson(self::BASE)
                ->assertOk()
                ->assertJsonPath('meta.page', 1);
            $this->getJson(self::BASE.'/piano')
                ->assertOk()
                ->assertJsonPath('data.id', 'piano')
                ->assertJsonPath('data.slug', 'piano');
        }
    }

    public function test_unknown_is_404(): void
    {
        $actor = $this->actingAsRole('administrator');
        $this->piano($actor->organization_id);
        $this->getJson(self::BASE.'/nope')->assertStatus(404)->assertJsonPath('error.code', 'INSTRUMENT_NOT_FOUND');
        $this->patchJson(self::BASE.'/nope', ['name' => 'x'])->assertStatus(404);
        $this->postJson(self::BASE.'/nope/active', ['active' => false])->assertStatus(404);
        $this->deleteJson(self::BASE.'/nope')->assertStatus(404);
    }

    public function test_list_supports_search_and_active_only(): void
    {
        $actor = $this->actingAsRole('administrator');
        $this->piano($actor->organization_id);
        Instrument::factory()->create([
            'id' => 'violin',
            'slug' => 'violin',
            'name' => 'ویولن',
            'description' => 'ساز زهی آرشه‌ای؛ ستون ارکستر زهی.',
            'organization_id' => $actor->organization_id,
        ]);
        Instrument::factory()->create([
            'id' => 'drums',
            'slug' => 'drums',
            'name' => 'درامز',
            'description' => 'ساز کوبه‌ای.',
            'organization_id' => $actor->organization_id,
        ]);

        $this->getJson(self::BASE.'?search='.urlencode('ارکستر'))
            ->assertOk()
            ->assertJsonFragment(['id' => 'violin']);

        $this->postJson(self::BASE.'/drums/active', ['active' => false])->assertOk();
        $ids = array_column($this->getJson(self::BASE.'?activeOnly=1')->json('data'), 'id');
        $this->assertContains('piano', $ids);
        $this->assertNotContains('drums', $ids);
    }

    /* ------------------------------------------------------------------ */
    /* writing — administrator and manager only                             */
    /* ------------------------------------------------------------------ */

    public function test_writing_requires_instruments_write(): void
    {
        $probe = $this->actingAsRole('administrator');
        $this->piano($probe->organization_id);

        foreach (['teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->postJson(self::BASE, $this->payload())
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'instruments.write');
            $this->patchJson(self::BASE.'/piano', ['name' => 'x'])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'instruments.write');
            $this->postJson(self::BASE.'/piano/active', ['active' => false])->assertStatus(403);
            $this->deleteJson(self::BASE.'/piano')->assertStatus(403);
        }
    }

    public function test_admin_and_manager_crud_round_trip(): void
    {
        foreach (['administrator', 'manager'] as $role) {
            $this->actingAsRole($role);

            $created = $this->postJson(self::BASE, $this->payload())->assertCreated()
                ->assertJsonPath('data.id', 'santoor')
                ->assertJsonPath('data.slug', 'santoor')
                ->assertJsonPath('data.name', 'سنتور')
                ->assertJsonPath('data.active', true);
            $this->assertSame(1, $created->json('data.sortOrder'));

            // Rename keeps the identity key.
            $this->patchJson(self::BASE.'/santoor', ['name' => 'سنتور کلاسیک'])
                ->assertOk()
                ->assertJsonPath('data.name', 'سنتور کلاسیک')
                ->assertJsonPath('data.slug', 'santoor');

            $this->deleteJson(self::BASE.'/santoor')->assertNoContent();
            $this->getJson(self::BASE.'/santoor')->assertStatus(404);
        }
    }

    /* ------------------------------------------------------------------ */
    /* identity and uniqueness rules                                        */
    /* ------------------------------------------------------------------ */

    public function test_a_malformed_slug_is_refused(): void
    {
        $this->actingAsRole('administrator');

        foreach (['', '1bad', 'UPPER', '../escape'] as $slug) {
            $this->postJson(self::BASE, $this->payload(['slug' => $slug]))
                ->assertStatus(422)
                ->assertJsonPath('error.code', 'INSTRUMENT_INVALID');
        }
    }

    public function test_slug_and_name_are_unique_per_organization(): void
    {
        $actor = $this->actingAsRole('administrator');
        $this->piano($actor->organization_id);

        $this->postJson(self::BASE, $this->payload(['slug' => 'piano', 'name' => 'ساز تازه']))
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'INSTRUMENT_SLUG_TAKEN');
        $this->postJson(self::BASE, $this->payload(['slug' => 'fresh', 'name' => 'پیانو']))
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'INSTRUMENT_NAME_TAKEN');

        // A second organization may define the same slug and name freely.
        $other = $this->makeOrganization();
        $mine = $this->defaultOrganization();
        $this->assertNotSame($mine->id, $other->id);
        $admin = $this->makeUser('administrator', [], $other);
        $this->useToken($this->tokenFor($admin));
        $this->postJson(self::BASE, $this->payload())->assertCreated();
    }

    public function test_the_slug_is_immutable_after_creation(): void
    {
        $actor = $this->actingAsRole('administrator');
        $this->piano($actor->organization_id);

        $this->patchJson(self::BASE.'/piano', ['slug' => 'fiddle'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INSTRUMENT_INVALID');
        $this->assertSame('piano', Instrument::query()->whereKey('piano')->firstOrFail()->slug);
    }

    /* ------------------------------------------------------------------ */
    /* referential safety                                                   */
    /* ------------------------------------------------------------------ */

    public function test_a_referenced_instrument_cannot_be_deleted(): void
    {
        $actor = $this->actingAsRole('administrator');
        $this->piano($actor->organization_id);

        // A teacher in the same organization carries `instrument: piano`
        // (the factory default mirrors the seeded dataset).
        Teacher::factory()->create(['organization_id' => $actor->organization_id]);

        $this->deleteJson(self::BASE.'/piano')
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'INSTRUMENT_IN_USE');
        $this->assertNotNull(Instrument::query()->whereKey('piano')->first());

        // Deactivation is the supported alternative.
        $this->postJson(self::BASE.'/piano/active', ['active' => false])
            ->assertOk()
            ->assertJsonPath('data.active', false);
    }

    public function test_an_unreferenced_instrument_can_be_deleted(): void
    {
        $this->actingAsRole('administrator');

        $this->postJson(self::BASE, $this->payload())->assertCreated();
        $this->deleteJson(self::BASE.'/santoor')->assertNoContent();
        $this->assertNull(Instrument::query()->whereKey('santoor')->first());
    }

    /* ------------------------------------------------------------------ */
    /* tenant isolation                                                     */
    /* ------------------------------------------------------------------ */

    public function test_another_organizations_instrument_is_invisible(): void
    {
        $mine = $this->makeUser('administrator');
        $theirs = $this->makeUser('administrator', [], $this->makeOrganization());
        Instrument::factory()->create(['id' => 'theirs', 'organization_id' => $theirs->organization_id]);

        $this->useToken($this->tokenFor($mine));
        $this->getJson(self::BASE.'/theirs')->assertStatus(404);
        $ids = array_column($this->getJson(self::BASE.'?per_page=200')->json('data'), 'id');
        $this->assertNotContains('theirs', $ids);
    }

    /* ------------------------------------------------------------------ */
    /* image reference                                                      */
    /* ------------------------------------------------------------------ */

    public function test_an_image_must_reference_an_existing_asset(): void
    {
        $actor = $this->actingAsRole('administrator');
        $this->piano($actor->organization_id);

        $this->patchJson(self::BASE.'/piano', ['imageId' => 'md_missing'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INSTRUMENT_INVALID');

        Storage::fake('local');
        $asset = MediaAsset::factory()->create(['id' => 'md_1', 'organization_id' => $this->defaultOrganization()->id]);
        Storage::disk('local')->put($asset->storage_path, 'instrument-image-bytes');
        $this->patchJson(self::BASE.'/piano', ['imageId' => 'md_1'])
            ->assertOk()
            ->assertJsonPath('data.imageId', 'md_1');

        // Another organization's asset is refused too.
        MediaAsset::factory()->create(['id' => 'md_other', 'organization_id' => $this->makeOrganization()->id]);
        $this->patchJson(self::BASE.'/piano', ['imageId' => 'md_other'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'INSTRUMENT_INVALID');
    }
}
