<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Academy messaging: threads, participation, and messages, per organization.
     *
     * Keys follow the composite pattern (`roles`, `instruments`, learning,
     * gallery): the primary key is `(organization_id, …)` so two
     * organizations never collide, and the tenant global scope keeps every
     * query inside the caller's organization.
     *
     * Participation is a row, not a role: a thread is visible exactly to its
     * participants. There is deliberately no administrator/manager bypass —
     * knowing an id never grants a read (fail closed, like the tenant scope).
     * Whether oversight tooling needs a wider read is an owner decision, not
     * an implementation detail, and it is recorded in DECISIONS.md §37.
     *
     * No cascading foreign keys on purpose: deleting a message or a thread is
     * not offered (archive hides a thread reversibly), and a cascading FK
     * would silently do what the service must refuse or decide.
     *
     * Message order is `(sent_at, id)`: `sent_at` is server-generated, and
     * the id (time-ordered) breaks same-second ties deterministically.
     */
    public function up(): void
    {
        Schema::create('chat_conversations', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('name', 120);
            $table->string('role', 16);
            $table->text('topic');
            $table->string('subject_id', 64)->nullable();
            $table->boolean('pinned')->default(false);
            $table->boolean('archived')->default(false);
            $table->timestamp('last_message_at')->nullable();
            $table->string('last_message_preview', 120)->default('');

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->index(['organization_id', 'pinned', 'last_message_at']);
        });

        Schema::create('chat_participants', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('conversation_id', 64);
            $table->string('user_id', 64);
            $table->timestamp('last_read_at')->nullable();

            $table->timestamps();

            $table->primary(['organization_id', 'conversation_id', 'user_id']);
            $table->index(['organization_id', 'user_id']);
        });

        Schema::create('chat_messages', function (Blueprint $table) {
            $table->string('organization_id')->index();
            $table->foreign('organization_id')->references('id')->on('organizations')->cascadeOnDelete();

            $table->string('id', 64);
            $table->string('conversation_id', 64);
            $table->string('sender_user_id', 64);
            $table->text('body');
            $table->string('provider', 16)->default('in_app');
            $table->string('status', 16)->default('sent');
            $table->text('status_reason')->nullable();
            $table->string('media_id', 64)->nullable();
            $table->timestamp('sent_at');

            $table->timestamps();

            $table->primary(['organization_id', 'id']);
            $table->index(['organization_id', 'conversation_id', 'sent_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
        Schema::dropIfExists('chat_participants');
        Schema::dropIfExists('chat_conversations');
    }
};
