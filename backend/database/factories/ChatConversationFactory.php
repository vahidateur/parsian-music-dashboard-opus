<?php

namespace Database\Factories;

use App\Models\ChatConversation;
use App\Models\Organization;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends \Illuminate\Database\Eloquent\Factories\Factory<\App\Models\ChatConversation>
 */
class ChatConversationFactory extends Factory
{
    protected $model = ChatConversation::class;

    public function definition(): array
    {
        return [
            'id' => 'co_'.strtolower((string) Str::ulid()),
            'organization_id' => Organization::factory(),
            'name' => 'گفتگو '.fake()->unique()->numerify('####'),
            'role' => 'staff',
            'topic' => 'بدون موضوع',
            'subject_id' => null,
            'pinned' => false,
            'archived' => false,
            'last_message_at' => now(),
            'last_message_preview' => '',
        ];
    }
}
