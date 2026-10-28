<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * Reads `page` / `per_page` the way the client sends them (snake_case query).
 * `page` < 1 becomes 1; `per_page` defaults to config('api.default_per_page')
 * and is clamped to config('api.max_per_page').
 */
final class Pagination
{
    public function __construct(public readonly int $page, public readonly int $perPage) {}

    public static function fromRequest(Request $request): self
    {
        $page = (int) $request->query('page', '1');
        $default = (int) config('api.default_per_page', 25);
        $max = (int) config('api.max_per_page', 100);
        $raw = $request->query('per_page');
        $perPage = is_numeric($raw) ? (int) $raw : $default;
        if ($perPage < 1) {
            $perPage = $default;
        }

        return new self(max(1, $page), min($perPage, $max));
    }
}
