<?php

namespace Database\Factories;

use App\Models\ChatConversation;
use App\Models\ChatParticipant;
use App\Models\Organization;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ChatParticipant>
 */
class ChatParticipantFactory extends Factory
{
    protected $model = ChatParticipant::class;

    public function definition(): array
    {
        return [
            'organization_id' => Organization::factory(),
            'conversation_id' => ChatConversation::factory(),
            'user_id' => User::factory(),
            'last_read_at' => null,
        ];
    }
}
