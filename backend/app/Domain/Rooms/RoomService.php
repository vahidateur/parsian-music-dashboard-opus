<?php

namespace App\Domain\Rooms;

use App\Models\AcademyClass;
use App\Models\Room;
use App\Support\Api\ApiException;
use App\Support\Pagination;
use App\Support\Tenancy\TenantContext;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;

/**
 * Rooms persistence and domain rules of the caller's organization.
 *
 * This service carries NO actor and makes NO authorization decision: room
 * authorization is owner decision PB-3, resolved 2026-10-02 as option A (keep
 * blocked, invent no permission id), isolated in
 * RoomPolicy, which RoomController calls before reaching this service. Other
 * domains may use it for data integrity (e.g. "room exists and is active"),
 * which is not room authorization.
 */
final class RoomService
{
    public function __construct(private readonly TenantContext $tenant) {}

    /**
     * @param  array<string, mixed>  $filters  search, assignable, min_capacity
     * @return LengthAwarePaginator<int, Room>
     */
    public function list(array $filters, Pagination $pagination): LengthAwarePaginator
    {
        $query = Room::query();
        if (($filters['search'] ?? '') !== '') {
            $like = '%'.trim((string) $filters['search']).'%';
            $query->where(fn (Builder $q) => $q->where('name', 'like', $like)->orWhere('kind', 'like', $like));
        }
        if (filter_var($filters['assignable'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('active', true);
        }
        if (isset($filters['min_capacity']) && $filters['min_capacity'] !== '') {
            $query->where('capacity', '>=', (int) $filters['min_capacity']);
        }

        return $query->orderBy('name')->orderBy('id')
            ->paginate($pagination->perPage, ['*'], 'page', $pagination->page);
    }

    public function get(string $id): Room
    {
        $room = Room::query()->whereKey($id)->first();
        if ($room === null) {
            throw ApiException::notFound('ROOM_NOT_FOUND', "اتاق با شناسهٔ {$id} یافت نشد.");
        }

        return $room;
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function create(array $input): Room
    {
        $this->assertNameFree((string) $input['name'], null);

        $room = new Room;
        $room->id = 'r_'.strtolower((string) Str::ulid());
        $room->organization_id = $this->tenant->organizationId();
        $room->occupancy = 0;
        $room->active = true;
        $this->fill($room, $input);

        return $this->save($room);
    }

    /** @param  array<string, mixed>  $input  validated wire input */
    public function update(string $id, array $input): Room
    {
        $room = $this->get($id);
        if (array_key_exists('name', $input)) {
            $this->assertNameFree((string) $input['name'], $room->id);
        }
        $this->fill($room, $input);

        return $this->save($room);
    }

    public function deactivate(string $id): Room
    {
        $room = $this->get($id);
        $room->active = false;

        return $this->save($room);
    }

    public function delete(string $id): void
    {
        $room = $this->get($id);
        $used = AcademyClass::query()->where('room_id', $room->id)->count();
        if ($used > 0) {
            throw ApiException::conflict(
                'ROOM_IN_USE',
                "این اتاق در {$used} کلاس استفاده می‌شود. ابتدا کلاس‌ها را جابه‌جا کنید یا اتاق را غیرفعال کنید.",
            );
        }
        $room->delete();
    }

    /** @param  array<string, mixed>  $input */
    private function fill(Room $room, array $input): void
    {
        if (array_key_exists('name', $input)) {
            $room->name = trim((string) $input['name']);
        }
        if (array_key_exists('kind', $input)) {
            $room->kind = trim((string) $input['kind']);
        }
        if (array_key_exists('capacity', $input)) {
            $room->capacity = (int) $input['capacity'];
        }
        if (array_key_exists('occupancy', $input)) {
            $room->occupancy = (int) $input['occupancy'];
        }
        if (array_key_exists('active', $input)) {
            $room->active = (bool) $input['active'];
        }
    }

    private function assertNameFree(string $name, ?string $exceptId): void
    {
        $taken = Room::query()
            ->where('name', trim($name))
            ->when($exceptId !== null, fn (Builder $q) => $q->whereKeyNot($exceptId))
            ->exists();
        if ($taken) {
            throw self::nameTaken();
        }
    }

    private function save(Room $room): Room
    {
        try {
            $room->save();
        } catch (UniqueConstraintViolationException) {
            throw self::nameTaken();
        }

        return $room->refresh();
    }

    private static function nameTaken(): ApiException
    {
        return ApiException::conflict('ROOM_NAME_TAKEN', 'اتاقی با این نام وجود دارد.', ['name' => ['تکراری است']]);
    }
}
