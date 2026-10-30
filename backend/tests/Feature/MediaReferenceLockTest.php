<?php

namespace Tests\Feature;

use App\Domain\Media\MediaReferenceLock;
use LogicException;
use Tests\TestCase;

class MediaReferenceLockTest extends TestCase
{
    public function test_reference_lock_refuses_to_run_outside_a_write_transaction(): void
    {
        $this->expectException(LogicException::class);
        $this->expectExceptionMessage('inside their write transaction');

        app(MediaReferenceLock::class)->lockAvailable('md_no_transaction');
    }
}
