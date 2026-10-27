<?php

namespace Tests\Feature;

use App\Domain\Chat\ChatService;
use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\MediaAsset;
use App\Support\Api\ApiException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\Concerns\ActsAsRole;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use ActsAsRole, RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('local');
    }

    /** A real 1x1 PNG for the attachment path. */
    private function pngBytes(): string
    {
        return base64_decode(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
        );
    }

    private function uploadImage(): string
    {
        $file = UploadedFile::fake()->createWithContent('photo.png', $this->pngBytes());

        return $this->post('/api/v1/media', [
            'kind' => 'image',
            'mimeType' => 'image/png',
            'file' => $file,
        ], ['Accept' => 'application/json'])->assertCreated()->json('data.id');
    }

    /** A thread the current token user participates in. */
    private function makeThread(array $input = []): string
    {
        return $this->postJson('/api/v1/chat/conversations', array_merge([
            'name' => 'گفتگوی تست',
            'role' => 'staff',
            'topic' => 'موضوع تست',
        ], $input))->assertCreated()->json('data.id');
    }

    /** @return list<array{0: string, 1: string, 2: array<string, mixed>}> */
    private function endpoints(string $id): array
    {
        return [
            ['GET', '/api/v1/chat/conversations', []],
            ['GET', "/api/v1/chat/conversations/$id", []],
            ['POST', '/api/v1/chat/conversations', ['name' => 'X', 'role' => 'staff', 'topic' => 't']],
            ['PATCH', "/api/v1/chat/conversations/$id", ['topic' => 't2']],
            ['POST', "/api/v1/chat/conversations/$id/archive", []],
            ['POST', "/api/v1/chat/conversations/$id/read", []],
            ['GET', "/api/v1/chat/conversations/$id/messages", []],
            ['POST', "/api/v1/chat/conversations/$id/messages", ['body' => 'سلام']],
        ];
    }

    public function test_unauthenticated_is_401_before_the_policy(): void
    {
        foreach ($this->endpoints('co_1') as [$method, $uri, $body]) {
            $this->json($method, $uri, $body)->assertStatus(401)->assertJsonPath('error.code', 'AUTH_UNAUTHENTICATED');
        }
    }

    public function test_reading_requires_messages_read(): void
    {
        $creator = $this->actingAsRole('manager');
        $creatorToken = $this->tokenFor($creator);
        $id = $this->makeThread();

        foreach (['administrator', 'manager', 'teacher', 'staff'] as $role) {
            $this->actingAsRole($role);
            // Everyone holds `messages.read`, but a fresh user participates in
            // nothing — so the list answers 200 with zero rows, never a leak.
            $this->getJson('/api/v1/chat/conversations')
                ->assertOk()
                ->assertJsonPath('meta.page', 1)
                ->assertJsonPath('meta.total', 0);
        }

        // The manager who created the thread reads it back.
        $this->useToken($creatorToken);
        $this->getJson("/api/v1/chat/conversations/$id")->assertOk();

        // Accounting holds `messages.read` but no write id: it may open the
        // view (and sees only threads it participates in — none here), while
        // every write refuses with the missing permission.
        $this->actingAsRole('accountant');
        $this->getJson('/api/v1/chat/conversations')
            ->assertOk()
            ->assertJsonPath('meta.total', 0);
        $this->getJson("/api/v1/chat/conversations/$id/messages")
            ->assertStatus(404);
    }

    public function test_writing_requires_messages_write(): void
    {
        $this->actingAsRole('manager');
        $id = $this->makeThread();

        foreach (['administrator', 'manager'] as $role) {
            $this->actingAsRole($role);
            $this->postJson('/api/v1/chat/conversations', ['name' => "گفتگوی $role", 'role' => 'group', 'topic' => 't'])
                ->assertCreated()
                ->assertJsonPath('data.name', "گفتگوی $role");
        }

        // Teacher and staff hold `messages.write` (they run threads); the
        // accountant holds no write id.
        $this->actingAsRole('accountant');
        $this->postJson('/api/v1/chat/conversations', ['name' => 'xx', 'role' => 'staff', 'topic' => 't'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'messages.write');
        $this->patchJson("/api/v1/chat/conversations/$id", ['topic' => 't'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'messages.write');
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => 'سلام'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'messages.write');
        $this->postJson("/api/v1/chat/conversations/$id/read", [])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'messages.write');
        $this->postJson("/api/v1/chat/conversations/$id/archive", [])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'messages.write');
    }

    public function test_forbidden_precedes_validation_and_lookup(): void
    {
        // The policy runs before validation and before the lookup, so an
        // unauthorized caller learns nothing about field rules or ids.
        $this->actingAsRole('accountant');

        $this->postJson('/api/v1/chat/conversations', ['name' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'messages.write');
        $this->postJson('/api/v1/chat/conversations/co_missing/messages', ['body' => ''])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'messages.write');
        $this->patchJson('/api/v1/chat/conversations/co_missing', ['name' => 'x'])
            ->assertStatus(403)
            ->assertJsonPath('error.permission', 'messages.write');
    }

    public function test_unknown_conversation_is_404(): void
    {
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/chat/conversations/co_missing')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'CONVERSATION_NOT_FOUND');
        $this->getJson('/api/v1/chat/conversations/co_missing/messages')
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'CONVERSATION_NOT_FOUND');
        $this->postJson('/api/v1/chat/conversations/co_missing/messages', ['body' => 'سلام'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'CONVERSATION_NOT_FOUND');
    }

    public function test_cross_user_access_is_404_not_a_leak(): void
    {
        $this->actingAsRole('manager');
        $id = $this->makeThread(['name' => 'محرمانه']);

        // A second user — same organization, full permissions — sees nothing:
        // not the thread, not its messages, and sending to it is impossible.
        // The answer is 404, not 403: existence itself is not disclosed.
        $this->actingAsRole('staff');
        $this->getJson("/api/v1/chat/conversations/$id")->assertStatus(404);
        $this->getJson("/api/v1/chat/conversations/$id/messages")->assertStatus(404);
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => 'سلام'])
            ->assertStatus(404)
            ->assertJsonPath('error.code', 'CONVERSATION_NOT_FOUND');
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('meta.total', 0);
    }

    public function test_participants_share_a_thread_and_see_their_own_side(): void
    {
        $this->actingAsRole('manager');
        $staff = $this->makeUser('staff');

        $id = $this->postJson('/api/v1/chat/conversations', [
            'name' => 'هماهنگی',
            'role' => 'staff',
            'topic' => 'شیفت',
            'participantIds' => [$staff->id],
        ])->assertCreated()->json('data.id');

        // The sender sees `me`; the other participant sees `them`. The wire
        // carries no sender field to trust — the server derives the side.
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => 'سلام همکار'])
            ->assertCreated()
            ->assertJsonPath('data.from', 'me')
            ->assertJsonPath('data.status', 'sent');

        $this->useToken($this->tokenFor($staff));
        $page = $this->getJson("/api/v1/chat/conversations/$id/messages")->assertOk();
        $this->assertSame('them', $page->json('data.0.from'));
        $this->assertSame('سلام همکار', $page->json('data.0.body'));
    }

    public function test_unknown_participant_is_rejected(): void
    {
        $this->actingAsRole('manager');

        $this->postJson('/api/v1/chat/conversations', [
            'name' => 'xx',
            'role' => 'staff',
            'topic' => 't',
            'participantIds' => ['u_missing'],
        ])->assertStatus(422)->assertJsonPath('error.code', 'CONVERSATION_INVALID');

        $foreignOrg = $this->makeOrganization();
        $foreign = $this->makeUser('staff', [], $foreignOrg);
        $this->postJson('/api/v1/chat/conversations', [
            'name' => 'xx',
            'role' => 'staff',
            'topic' => 't',
            'participantIds' => [$foreign->id],
        ])->assertStatus(422)->assertJsonPath('error.code', 'CONVERSATION_INVALID');
    }

    public function test_admin_crud_round_trip(): void
    {
        $this->actingAsRole('administrator');

        $created = $this->postJson('/api/v1/chat/conversations', [
            'name' => 'پشتیبانی',
            'role' => 'group',
            'topic' => 'سؤالات',
        ])->assertCreated()->assertJsonPath('data.unread', 0);
        $id = $created->json('data.id');
        $this->assertStringStartsWith('co_', $id);

        $this->getJson("/api/v1/chat/conversations/$id")->assertOk();

        $this->patchJson("/api/v1/chat/conversations/$id", ['topic' => 'سؤالات متداول', 'pinned' => true])
            ->assertOk()
            ->assertJsonPath('data.topic', 'سؤالات متداول')
            ->assertJsonPath('data.pinned', true);

        // Archive hides by default and reveals on request; the same patch
        // restores — no separate unarchive verb exists.
        $this->postJson("/api/v1/chat/conversations/$id/archive", [])->assertOk()->assertJsonPath('data.archived', true);
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('meta.total', 0);
        $this->getJson('/api/v1/chat/conversations?includeArchived=1')->assertJsonPath('meta.total', 1);
        $this->patchJson("/api/v1/chat/conversations/$id", ['archived' => false])->assertOk();
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('meta.total', 1);
    }

    public function test_conversation_list_accepts_the_snake_case_archived_filter(): void
    {
        // The Api repository sends snake_case (toConversationQuery); a
        // controller that only read camelCase would silently ignore the
        // filter and hide archived threads from a UI that asked for them.
        $this->actingAsRole('manager');
        $openId = $this->makeThread(['name' => 'باز']);
        $archivedId = $this->makeThread(['name' => 'بایگانی']);
        $this->postJson("/api/v1/chat/conversations/$archivedId/archive", [])->assertOk();

        // Default (no flag): archived stays hidden — previous behavior unchanged.
        $this->getJson('/api/v1/chat/conversations?per_page=200')->assertOk()->assertJsonPath('meta.total', 1);

        // Snake_case (the real wire): archived threads are included.
        $page = $this->getJson('/api/v1/chat/conversations?include_archived=1&per_page=200')->assertOk();
        $this->assertSame(2, $page->json('meta.total'));
        $this->assertEqualsCanonicalizing([$openId, $archivedId], array_column($page->json('data'), 'id'));

        // CamelCase keeps working (backward compatibility, never silently dropped).
        $this->getJson('/api/v1/chat/conversations?includeArchived=1&per_page=200')->assertOk()->assertJsonPath('meta.total', 2);
    }

    public function test_send_validates_body_provider_and_media(): void
    {
        $this->actingAsRole('manager');
        $id = $this->makeThread();
        $mediaId = $this->uploadImage();

        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => '   '])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'MESSAGE_INVALID');
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => str_repeat('ا', 4001)])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'MESSAGE_INVALID');
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => 'x', 'provider' => 'pigeon'])
            ->assertStatus(422);
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => 'x', 'mediaId' => 'md_missing'])
            ->assertStatus(422)
            ->assertJsonPath('error.code', 'MESSAGE_INVALID');

        // A real message with an attachment round-trips with its reference.
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => 'ببین', 'mediaId' => $mediaId])
            ->assertCreated()
            ->assertJsonPath('data.mediaId', $mediaId)
            ->assertJsonPath('data.status', 'sent');

        // A non-in-app provider is recorded as unavailable, never as sent.
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => 'تلگرامی', 'provider' => 'telegram'])
            ->assertCreated()
            ->assertJsonPath('data.status', 'unavailable')
            ->assertJsonPath('data.provider', 'telegram');
    }

    public function test_mark_read_clears_only_the_caller_cursor(): void
    {
        $manager = $this->actingAsRole('manager');
        $staff = $this->makeUser('staff');

        $id = $this->postJson('/api/v1/chat/conversations', [
            'name' => 'شیفت',
            'role' => 'staff',
            'topic' => 't',
            'participantIds' => [$staff->id],
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => 'سلام']);

        // The recipient sees one unread; reading clears their own cursor.
        $this->useToken($this->tokenFor($staff));
        $this->assertSame(1, $this->getJson("/api/v1/chat/conversations/$id")->json('data.unread'));
        $this->postJson("/api/v1/chat/conversations/$id/read", [])->assertOk()->assertJsonPath('data.unread', 0);

        // The sender's view is untouched: their own message was never unread.
        $this->useToken($this->tokenFor($manager));
        $this->assertSame(0, $this->getJson("/api/v1/chat/conversations/$id")->json('data.unread'));
    }

    public function test_attachment_bytes_follow_participation(): void
    {
        $this->actingAsRole('manager');
        $staff = $this->makeUser('staff');
        $mediaId = $this->uploadImage();

        $id = $this->postJson('/api/v1/chat/conversations', [
            'name' => 'پیوست‌دار',
            'role' => 'staff',
            'topic' => 't',
            'participantIds' => [$staff->id],
        ])->assertCreated()->json('data.id');
        $this->postJson("/api/v1/chat/conversations/$id/messages", ['body' => 'ببین', 'mediaId' => $mediaId])
            ->assertCreated();

        // A participant reads the bytes; a stranger gets 403, not the file.
        $this->useToken($this->tokenFor($staff));
        $this->get("/api/v1/media/$mediaId/bytes")->assertOk();
        $this->actingAsRole('teacher', ['teacher_id' => 't_chat']);
        \App\Models\Teacher::factory()->create(['organization_id' => $this->defaultOrganization()->id, 'id' => 't_chat']);
        $this->get("/api/v1/media/$mediaId/bytes")->assertStatus(403);
    }

    public function test_tenant_isolation_is_404(): void
    {
        $this->actingAsRole('manager');
        $id = $this->makeThread();

        $foreign = $this->makeOrganization();
        $this->actingAsRole('manager', [], $foreign);
        $this->getJson("/api/v1/chat/conversations/$id")->assertStatus(404);
        $this->getJson('/api/v1/chat/conversations')->assertJsonPath('meta.total', 0);
    }

    public function test_chat_uses_the_existing_messages_vocabulary(): void
    {
        $this->assertContains('messages.read', config('permissions.vocabulary'));
        $this->assertContains('messages.write', config('permissions.vocabulary'));
    }

    public function test_thread_service_round_trip_and_isolation(): void
    {
        $org = $this->defaultOrganization();
        $this->bindTenant($org);
        $service = app(ChatService::class);
        $manager = $this->makeUser('manager');
        $staff = $this->makeUser('staff');

        $thread = $service->createConversation($manager, [
            'name' => 'استودیو',
            'role' => 'group',
            'topic' => 't',
            'participantIds' => [$staff->id],
        ]);
        $message = $service->sendMessage($manager, $thread->id, ['body' => 'سلام']);
        $this->assertSame('me', $service->viewerFrom($manager, $message));
        $this->assertSame('them', $service->viewerFrom($staff, $message));
        $this->assertSame(
            ['سلام'],
            ChatMessage::query()->where('conversation_id', $thread->id)->orderBy('sent_at')->pluck('body')->all(),
        );

        $foreign = ChatConversation::factory()->create(['organization_id' => $this->makeOrganization()->id]);
        $this->assertApiError('CONVERSATION_NOT_FOUND', 404, fn () => $service->getConversation($manager, $foreign->id));
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
