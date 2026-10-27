<?php

namespace App\Http\Requests\Media;

use App\Domain\Media\MediaRules;
use App\Http\Requests\ApiFormRequest;
use Illuminate\Http\UploadedFile;

/**
 * The upload request.
 *
 * The bytes arrive as a multipart part. The declared type is only a HINT:
 * `MediaService` re-derives it from the allow-list and the magic bytes, and
 * refuses a file whose content does not match the type it claims.
 *
 * The PHP upload errors are translated here rather than surfacing as a
 * generic "the file field is required": a file the SERVER refused (too large
 * for `upload_max_filesize`, interrupted transfer) is a different fact from a
 * file the user never picked, and the panel must say which one happened.
 */
final class StoreMediaRequest extends ApiFormRequest
{
    protected string $errorCode = 'MEDIA_INVALID';

    protected string $errorMessage = 'فایل انتخاب‌شده معتبر نیست.';

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'kind' => ['required', 'string', 'in:'.implode(',', MediaRules::kinds())],
            'file' => ['required', 'file'],
            'mimeType' => ['nullable', 'string', 'max:120'],
            'width' => ['nullable', 'integer', 'min:1', 'max:20000'],
            'height' => ['nullable', 'integer', 'min:1', 'max:20000'],
            'durationSeconds' => ['nullable', 'integer', 'min:0', 'max:86400'],
            // The waveform travels as ONE form field holding a JSON array — a
            // few hundred form fields per upload would be the alternative.
            // The SERVICE decodes and range-checks it; the shape is data, not
            // transport, and the service is where the client's copy of the
            // same rule lives.
            'peaks' => ['nullable', 'string', 'max:100000'],
        ];
    }

    /**
     * The decoded waveform peaks, or an honest reason why they are unusable.
     *
     * @return list<float>|null
     *
     * @throws \App\Support\Api\ApiException
     */
    public function peaks(): ?array
    {
        $raw = $this->input('peaks');
        if ($raw === null || $raw === '') {
            return null;
        }

        $decoded = json_decode((string) $raw, true);
        if (! is_array($decoded)) {
            throw \App\Support\Api\ApiException::validation('MEDIA_INVALID', $this->errorMessage, [
                'peaks' => ['قالب موج صوتی قابل خواندن نیست.'],
            ]);
        }
        if (count($decoded) > 5000) {
            throw \App\Support\Api\ApiException::validation('MEDIA_INVALID', $this->errorMessage, [
                'peaks' => ['تعداد نقاط موج بیش از حد مجاز است.'],
            ]);
        }
        foreach ($decoded as $value) {
            if (! is_int($value) && ! is_float($value)) {
                throw \App\Support\Api\ApiException::validation('MEDIA_INVALID', $this->errorMessage, [
                    'peaks' => ['هر نقطهٔ موج باید عدد باشد.'],
                ]);
            }
        }

        return array_values($decoded);
    }

    /**
     * The raw bytes, or a precise reason why there are none.
     *
     * @throws \App\Support\Api\ApiException
     */
    public function bytes(): string
    {
        $file = $this->file('file');

        if (! $file instanceof UploadedFile || ! $file->isValid()) {
            throw $this->uploadFailure();
        }

        $contents = file_get_contents($file->getRealPath());

        if ($contents === false) {
            throw $this->uploadFailure();
        }

        return $contents;
    }

    /**
     * The type the client declared, or the one the part carried.
     *
     * Both are hints; `MediaService` verifies the bytes against the
     * allow-list and the magic signature either way.
     */
    public function declaredMimeType(): ?string
    {
        $declared = $this->input('mimeType');
        if (is_string($declared) && $declared !== '') {
            return $declared;
        }

        $file = $this->file('file');
        if ($file instanceof UploadedFile) {
            return $file->getClientMimeType();
        }

        return null;
    }

    /**
     * Turns a PHP upload error into an honest message.
     */
    private function uploadFailure(): \App\Support\Api\ApiException
    {
        $error = $this->file('file') instanceof UploadedFile
            ? (int) $this->file('file')->getError()
            : UPLOAD_ERR_NO_FILE;

        $message = match ($error) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'حجم فایل از حد مجاز سرور بیشتر است.',
            UPLOAD_ERR_PARTIAL => 'بارگذاری فایل کامل نشد؛ دوباره تلاش کنید.',
            UPLOAD_ERR_NO_FILE => 'فایلی انتخاب نشده است.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE => 'سرور نتوانست فایل موقت را بنویسد.',
            default => 'فایل بارگذاری نشد.',
        };

        return \App\Support\Api\ApiException::validation('MEDIA_INVALID', $this->errorMessage, [
            'file' => [$message],
        ]);
    }
}
