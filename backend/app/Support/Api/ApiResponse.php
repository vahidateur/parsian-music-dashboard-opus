<?php

namespace App\Support\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Pagination\LengthAwarePaginator;

/**
 * Success envelopes the client (src/api/client.ts) reads:
 *   item  → { "data": {...} }
 *   page  → { "data": [...], "meta": { "page", "per_page", "total" } }
 *   empty → 204 with no body
 */
final class ApiResponse
{
    public static function item(mixed $data, int $status = 200): JsonResponse
    {
        return new JsonResponse(['data' => $data], $status, [], JSON_UNESCAPED_UNICODE);
    }

    /**
     * @param  callable(mixed): array<string, mixed>  $map
     */
    public static function page(LengthAwarePaginator $paginator, callable $map): JsonResponse
    {
        return self::list(
            array_map($map, $paginator->items()),
            $paginator->currentPage(),
            $paginator->perPage(),
            $paginator->total(),
        );
    }

    /** @param  list<mixed>  $data */
    public static function list(array $data, int $page, int $perPage, int $total): JsonResponse
    {
        return new JsonResponse([
            'data' => array_values($data),
            'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
        ], 200, [], JSON_UNESCAPED_UNICODE);
    }

    public static function noContent(): Response
    {
        return new Response('', 204);
    }
}
