<?php

namespace Database\Factories;

use App\Models\ChatConversation;
use App\Models\ChatMessage;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ChatMessage>
 */
class ChatMessageFactory extends Factory
{
    protected $model = ChatMessage::class;

    public function definition(): array
    {
        return [
            'id' => 'cm_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'conversation_id' => ChatConversation::factory(),
            'sender_user_id' => User::factory(),
            'body' => fake()->sentence(),
            'provider' => 'in_app',
            'status' => 'sent',
            'status_reason' => null,
            'media_id' => null,
            'sent_at' => now(),
        ];
    }
}
