<?php

namespace App\Http\Controllers\Api\V1;

use App\Domain\Media\MediaPolicy;
use App\Domain\Media\MediaReferences;
use App\Domain\Media\MediaService;
use App\Http\Controllers\Controller;
use App\Http\Requests\Media\StoreMediaRequest;
use App\Support\Api\ApiResponse;
use App\Support\Pagination;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * Media — the binary store, served per object.
 *
 * THE CONTRACT (src/domains/media/repository.ts):
 *   GET    /api/v1/media            list the assets the caller may see
 *   POST   /api/v1/media            upload (multipart)
 *   GET    /api/v1/media/{id}       the metadata
 *   GET    /api/v1/media/{id}/bytes the bytes — authenticated, authorized
 *   DELETE /api/v1/media/{id}       free it (refused while referenced)
 *
 * `/bytes` is a separate path from the metadata because the two have
 * different answers: the metadata is a row, the bytes are a file, and the
 * bytes are the thing that must not be readable by anyone but the people who
 * may see the record that shows them.
 */
final class MediaController extends Controller
{
    public function __construct(
        private readonly MediaService $media,
        private readonly MediaPolicy $policy,
        private readonly MediaReferences $references,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'kind' => ['nullable', 'string', 'in:image,audio,document'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $pagination = Pagination::fromRequest($request);
        $actor = $request->user();

        // The visible set is the POLICY's answer: it holds the permissions and
        // the scope, and it is the same answer the per-object read uses.
        $page = $this->media->paginateVisible(
            $this->policy->visibleMediaIds($actor),
            $filters,
            $pagination->page,
            $pagination->perPage,
        );

        return ApiResponse::page($page, fn (mixed $asset): array => MediaService::toWire($asset));
    }

    public function store(StoreMediaRequest $request): JsonResponse
    {
        $actor = $request->user();
        $this->policy->authorizeUpload($actor);

        $asset = $this->media->create($actor, [
            'kind' => (string) $request->input('kind'),
            'filename' => (string) ($request->file('file')?->getClientOriginalName() ?? 'file'),
            'mimeType' => $request->declaredMimeType(),
            'bytes' => $request->bytes(),
            'width' => $request->input('width'),
            'height' => $request->input('height'),
            'durationSeconds' => $request->input('durationSeconds'),
            'peaks' => $request->peaks(),
        ]);

        return ApiResponse::item(MediaService::toWire($asset), 201);
    }

    public function show(Request $request, string $id): JsonResponse
    {
        $asset = $this->media->findOrFail($id);
        $this->policy->authorizeReadAsset($request->user(), $asset, $this->references);

        return ApiResponse::item(MediaService::toWire($asset));
    }

    /**
     * The bytes.
     *
     * The response is deliberately hard to abuse: the declared type is the
     * ALLOW-LISTED one (never the browser's claim), `nosniff` stops the
     * browser from sniffing a different type, and the CSP forbids scripts
     * even if the file is an XML document. Images are served inline so they
     * render; everything else is served as an attachment.
     */
    public function bytes(Request $request, string $id): Response
    {
        $asset = $this->media->findOrFail($id);
        $this->policy->authorizeReadAsset($request->user(), $asset, $this->references);

        $bytes = $this->media->bytes($asset);
        $disposition = $asset->kind === 'image' ? 'inline' : 'attachment';

        return response($bytes, 200, [
            'Content-Type' => $asset->mime_type,
            'Content-Length' => (string) strlen($bytes),
            'Content-Disposition' => $disposition.'; filename="'.addslashes($asset->filename).'"',
            'X-Content-Type-Options' => 'nosniff',
            'Content-Security-Policy' => "default-src 'none'; style-src 'unsafe-inline'; sandbox",
            'Cache-Control' => 'private, no-store, max-age=0',
        ]);
    }

    public function destroy(Request $request, string $id): Response
    {
        $asset = $this->media->findOrFail($id);
        $this->policy->authorizeDelete($request->user(), $asset);

        $this->media->delete($asset);

        return ApiResponse::noContent();
    }
}
