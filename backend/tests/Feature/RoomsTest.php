<?php

namespace Tests\Feature;

use App\Domain\Rooms\RoomService;
use App\Models\AcademyClass;
use App\Models\Room;
use App\Support\Api\ApiException;
use App\Support\Pagination;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class RoomsTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    /** @return list<array{0: string, 1: string, 2: array<string, mixed>}> */
    private function endpoints(string $id): array
    {
        return [
            ['GET', '/api/v1/rooms', []],
            ['GET', "/api/v1/rooms/$id", []],
            ['POST', '/api/v1/rooms', ['name' => 'Room X', 'kind' => 'piano', 'capacity' => 4]],
            ['PATCH', "/api/v1/rooms/$id", ['capacity' => 8]],
            ['POST', "/api/v1/rooms/$id/deactivate", []],
            ['DELETE', "/api/v1/rooms/$id", []],
        ];
    }

    public function test_reading_requires_rooms_read(): void
    {
        // Every role may read: a room is a lookup-table name, not personal
        // data, and every record that carries a `room_id` resolves against it.
        foreach (['administrator', 'manager', 'teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->getJson('/api/v1/rooms')
                ->assertOk()
                ->assertJsonPath('meta.page', 1);
        }
    }

    public function test_writing_requires_rooms_write(): void
    {
        foreach (['administrator', 'manager'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/v1/rooms', ['name' => "اتاق تست $role", 'kind' => 'تمرین', 'capacity' => 4])
                ->assertCreated()
                ->assertJsonPath('data.name', "اتاق تست $role");
        }

        foreach (['teacher', 'staff', 'accountant'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/v1/rooms', ['name' => 'اتاق تست', 'kind' => 'تمرین', 'capacity' => 4])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'rooms.write');
            $this->patchJson('/api/v1/rooms/r1', ['capacity' => 8])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'rooms.write');
            $this->postJson('/api/v1/rooms/r1/deactivate', [])
                ->assertStatus(403)
                ->assertJsonPath('error.permission', 'rooms.write');
            $this->deleteJson('/api/v1/rooms/r1')->assertStatus(403);
        }
    }

    public function test_forbidden_precedes_validation_and_not_found(): void
    {
        // The policy runs before validation and before the lookup, so an
        // unauthorized caller learns nothing about field rules or ids.
        $this->actingAsRole('teacher');

        $this->postJson('/api/v1/rooms', ['capacity' => 'many'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'rooms.write');
        $this->patchJson('/api/v1/rooms/r_missing', ['capacity' => -1])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'rooms.write');
        $this->postJson('/api/v1/rooms/r_missing/deactivate', [])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'rooms.write');
        $this->deleteJson('/api/v1/rooms/r_missing')
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'rooms.write');
    }

    public function test_unknown_room_is_404(): void
    {
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/rooms/r_missing')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ROOM_NOT_FOUND');
        $this->patchJson('/api/v1/rooms/r_missing', ['capacity' => 8])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'ROOM_NOT_FOUND');
    }

    public function test_admin_crud_round_trip(): void
    {
        $this->actingAsRole('administrator');

        $created = $this->postJson('/api/v1/rooms', ['name' => 'اتاق ۷', 'kind' => 'تمرین', 'capacity' => 6])
            ->assertCreated()
            ->assertJsonPath('data.name', 'اتاق ۷')
            ->assertJsonPath('data.capacity', 6)
            ->assertJsonPath('data.active', true)
            ->assertJsonPath('data.occupancy', 0);
        $id = $created->json('data.id');
        $this->assertStringStartsWith('r_', $id);

        $this->getJson("/api/v1/rooms/$id")->assertOk()->assertJsonPath('data', $created->json('data'));

        $this->patchJson("/api/v1/rooms/$id", ['capacity' => 10])
            ->assertOk()
            ->assertJsonPath('data.capacity', 10);

        // Duplicate names are refused per organization, with the field named.
        $this->postJson('/api/v1/rooms', ['name' => 'اتاق ۷', 'kind' => 'x', 'capacity' => 1])
            ->assertStatus(409)
            ->assertJsonPath('error.code', 'ROOM_NAME_TAKEN');

        $this->postJson("/api/v1/rooms/$id/deactivate")
            ->assertOk()
            ->assertJsonPath('data.active', false);

        $this->deleteJson("/api/v1/rooms/$id")->assertNoContent();
        $this->getJson("/api/v1/rooms/$id")->assertStatus(404);
    }

    public function test_unauthenticated_is_401_before_the_policy(): void
    {
        foreach ($this->endpoints('r1') as [$method, $uri, $body]) {
            $this->json($method, $uri, $body)->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        }
    }

    public function test_rooms_permissions_exist_in_the_vocabulary(): void
    {
        $this->assertContains('rooms.read', config('permissions.vocabulary'));
        $this->assertContains('rooms.write', config('permissions.vocabulary'));
    }

    public function test_room_service_persistence_round_trip_without_http(): void
    {
        $org = $this->defaultOrganization();
        $this->bindTenant($org);
        $service = app(RoomService::class);

        $room = $service->create(['name' => ' اتاق ۵ ', 'kind' => 'گیتار', 'capacity' => 4]);
        $this->assertStringStartsWith('r_', $room->id);
        $this->assertSame($org->id, DB::table('rooms')->where('id', $room->id)->value('organization_id'));
        $this->assertSame('اتاق ۵', $service->get($room->id)->name);
        $this->assertSame(0, $room->occupancy);
        $this->assertTrue($room->active);

        $updated = $service->update($room->id, ['capacity' => 8, 'occupancy' => 40]);
        $this->assertSame(8, $updated->capacity);
        $this->assertSame(40, $service->get($room->id)->occupancy);

        $service->create(['name' => 'Big', 'kind' => 'hall', 'capacity' => 30]);
        $page = $service->list(['min_capacity' => 10], new Pagination(1, 25));
        $this->assertSame(['Big'], array_map(fn (Room $r) => $r->name, $page->items()));

        $this->assertFalse($service->deactivate($room->id)->active);
        $assignable = $service->list(['assignable' => '1'], new Pagination(1, 25));
        $this->assertSame(['Big'], array_map(fn (Room $r) => $r->name, $assignable->items()));

        $service->delete($room->id);
        $this->assertSame(0, DB::table('rooms')->where('id', $room->id)->count());
    }

    public function test_room_service_conflicts_and_tenant_isolation(): void
    {
        $org = $this->defaultOrganization();
        $this->bindTenant($org);
        $service = app(RoomService::class);

        $room = $service->create(['name' => 'Studio', 'kind' => 'piano', 'capacity' => 4]);
        AcademyClass::factory()->create(['organization_id' => $org->id, 'room_id' => $room->id]);

        $this->assertApiError('ROOM_IN_USE', 409, fn () => $service->delete($room->id));
        $this->assertApiError('ROOM_NAME_TAKEN', 409, fn () => $service->create(['name' => 'Studio', 'kind' => 'x', 'capacity' => 1]));

        $foreign = Room::factory()->create(['organization_id' => $this->makeOrganization()->id]);
        $this->assertApiError('ROOM_NOT_FOUND', 404, fn () => $service->get($foreign->id));
    }

    private function assertApiError(string $code, int $status, callable $call): void
    {
        try {
            $call();
            $this->fail("Expected ApiException $code");
        } catch (ApiException $e) {
            $this->assertSame($code, $e->errorCode);
            $this->assertSame($status, $e->status);
        }
    }
}
