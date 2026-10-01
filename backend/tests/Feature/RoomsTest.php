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

    public function test_every_room_endpoint_is_blocked_by_pb3_for_admin_and_manager(): void
    {
        $room = Room::factory()->create(['organization_id' => $this->defaultOrganization()->id]);

        foreach (['administrator', 'manager'] as $role) {
            $this->actingAsRole($role);
            foreach ($this->endpoints($room->id) as [$method, $uri, $body]) {
                $this->json($method, $uri, $body)
                    ->assertStatus(403)
                    ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB3')
                    ->assertJsonPath('error.decision', 'PB-3');
            }
        }

        // Nothing was written through the blocked endpoints.
        $this->assertSame(1, DB::table('rooms')->count());
        $this->assertTrue((bool) DB::table('rooms')->where('id', $room->id)->value('active'));
        $this->assertSame(6, (int) DB::table('rooms')->where('id', $room->id)->value('capacity'));
    }

    public function test_block_precedes_validation_and_not_found(): void
    {
        $this->actingAsRole('administrator');

        $this->postJson('/api/v1/rooms', ['capacity' => 'many'])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB3');
        $this->patchJson('/api/v1/rooms/r_missing', ['capacity' => -1])
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB3');
        $this->getJson('/api/v1/rooms/r_missing')
            ->assertStatus(403)
            ->assertJsonPath('error.code', 'OWNER_DECISION_REQUIRED_PB3');
    }

    public function test_unauthenticated_is_401_before_the_policy(): void
    {
        foreach ($this->endpoints('r1') as [$method, $uri, $body]) {
            $this->json($method, $uri, $body)->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        }
    }

    public function test_no_room_permission_exists_in_the_vocabulary(): void
    {
        foreach (config('permissions.vocabulary') as $permission) {
            $this->assertStringStartsNotWith('rooms.', $permission);
        }
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
