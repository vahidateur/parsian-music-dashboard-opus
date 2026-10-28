<?php

namespace App\Models;

use App\Models\Concerns\BelongsToOrganization;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One stored binary's metadata.
 *
 * The bytes live on the private disk, addressed by `storage_path`; this row
 * never holds them. `storage_path` is deliberately NOT hidden from the model
 * but IS never rendered on the wire — the wire shape is
 * `App\Http\Resources\MediaResource`, and it has no path field at all.
 *
 * @property string $id
 * @property string $organization_id
 * @property string $kind
 * @property string $filename
 * @property string $mime_type
 * @property int $size_bytes
 * @property int|null $width
 * @property int|null $height
 * @property int|null $duration_seconds
 * @property array<int, float>|null $peaks
 * @property string $storage_path
 * @property string|null $uploaded_by
 */
class MediaAsset extends Model
{
    /** @use HasFactory<\Database\Factories\MediaAssetFactory> */
    use BelongsToOrganization, HasFactory;

    public const KINDS = ['image', 'audio', 'document'];

    public $incrementing = false;

    protected $keyType = 'string';

    protected $fillable = [
        'kind', 'filename', 'mime_type', 'size_bytes', 'width', 'height',
        'duration_seconds', 'peaks', 'storage_path', 'uploaded_by',
    ];

    protected $hidden = ['organization_id', 'storage_path'];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'width' => 'integer',
            'height' => 'integer',
            'duration_seconds' => 'integer',
            'peaks' => 'array',
        ];
    }

    /** @return BelongsTo<User, $this> */
    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
