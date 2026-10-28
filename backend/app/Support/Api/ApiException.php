<?php

namespace App\Support\Api;

use Illuminate\Http\JsonResponse;
use RuntimeException;

/**
 * A domain error rendered as `{ "error": { code, message, fields?, ...extra } }`.
 *
 * Every error the API emits goes through this shape (see bootstrap/app.php).
 */
class ApiException extends RuntimeException
{
    /**
     * @param  array<string, list<string>>  $fields
     * @param  array<string, mixed>  $extra
     */
    public function __construct(
        public readonly int $status,
        public readonly string $errorCode,
        string $message,
        public readonly array $fields = [],
        public readonly array $extra = [],
    ) {
        parent::__construct($message);
    }

    /** @return array{error: array<string, mixed>} */
    public function toBody(): array
    {
        $error = ['code' => $this->errorCode, 'message' => $this->getMessage()];
        if ($this->fields !== []) {
            $error['fields'] = $this->fields;
        }

        return ['error' => [...$error, ...$this->extra]];
    }

    public function render(): JsonResponse
    {
        return new JsonResponse($this->toBody(), $this->status);
    }

    public static function notFound(string $code, string $message): self
    {
        return new self(404, $code, $message);
    }

    /** @param  array<string, list<string>>  $fields */
    public static function conflict(string $code, string $message, array $fields = []): self
    {
        return new self(409, $code, $message, $fields);
    }

    /** @param  array<string, list<string>>  $fields */
    public static function validation(string $code, string $message, array $fields): self
    {
        return new self(422, $code, $message, $fields);
    }
}
