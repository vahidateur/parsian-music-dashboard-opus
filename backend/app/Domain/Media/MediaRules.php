<?php

namespace App\Domain\Media;

use App\Models\MediaAsset;

/**
 * The server port of the media validation policy in
 * `src/domains/media/types.ts` and `src/domains/media/localRepository.ts`.
 *
 * WHY A SERVER PORT AT ALL
 * The browser check is UX, not a boundary: anything reachable from the browser
 * can be bypassed. The server therefore re-derives EVERYTHING from the bytes
 * it received:
 *
 *   - the MIME type comes from the allow-list, never from the client's claim
 *     (a multipart part's `Content-Type` is a hint, not evidence);
 *   - the declared type must match the file's MAGIC BYTES, so `evil.html`
 *     renamed to `photo.png` is not treated as an image;
 *   - the size ceiling is checked before the bytes are written;
 *   - the filename is sanitized into a display string and is NEVER used to
 *     build a storage path.
 *
 * The vocabulary and the ceilings are kept identical to the client's on
 * purpose: a file the panel accepts must not be rejected by the server for a
 * reason the panel never stated, and vice versa. `src/domains/media/types.ts`
 * is the client's copy of this table.
 */
final class MediaRules
{
    /**
     * Allow-listed types per kind.
     *
     * SVG is deliberately EXCLUDED: it is an XML document that can carry
     * `<script>`, and serving user-supplied SVG from the panel's own origin
     * is a stored-XSS vector.
     */
    public const ALLOWED_TYPES = [
        'image' => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
        'audio' => ['audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/webm'],
        // text/plain is legitimate for a music library (study notes, lyric
        // sheets). It is not a script container, so — unlike SVG — it may stay.
        'document' => ['application/pdf', 'text/plain'],
    ];

    /** Per-kind size ceilings. Mirrors MAX_*_BYTES in the client. */
    public const MAX_BYTES = [
        'image' => 5 * 1024 * 1024,
        'audio' => 25 * 1024 * 1024,
        'document' => 20 * 1024 * 1024,
    ];

    public static function kinds(): array
    {
        return MediaAsset::KINDS;
    }

    /** @return list<string> */
    public static function allowedTypesFor(string $kind): array
    {
        return self::ALLOWED_TYPES[$kind] ?? [];
    }

    public static function maxBytesFor(string $kind): int
    {
        return self::MAX_BYTES[$kind] ?? 0;
    }

    /**
     * The magic-byte signature check.
     *
     * `null` means "this format has no reliable prefix" (some audio
     * containers, text/plain) — the declared type having passed the
     * allow-list is then the whole check, exactly as in the client.
     *
     * @param  string  $mimeType
     */
    public static function matchesSignature(string $mimeType, string $head): bool
    {
        return match ($mimeType) {
            'image/jpeg' => str_starts_with($head, "\xFF\xD8\xFF"),
            'image/png' => str_starts_with($head, "\x89PNG"),
            'image/gif' => str_starts_with($head, 'GIF'),
            'image/webp' => str_starts_with($head, 'RIFF') && substr($head, 8, 4) === 'WEBP',
            'application/pdf' => str_starts_with($head, '%PDF'),
            default => true,
        };
    }

    /**
     * Strips everything that could turn a display name into a path or a
     * control sequence. Mirrors `sanitizeFilename` in the client.
     */
    public static function sanitizeFilename(string $raw): string
    {
        $base = str_replace(['/', '\\'], '_', $raw);
        $base = preg_replace('/[\x00-\x1F\x7F]/u', '', $base) ?? '';
        $base = ltrim($base, '.');
        $base = trim($base);
        $cleaned = $base !== '' ? $base : 'file';

        return mb_substr($cleaned, 0, 120);
    }
}
