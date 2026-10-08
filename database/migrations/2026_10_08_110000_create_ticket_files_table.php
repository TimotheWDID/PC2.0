<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Files attached directly to a ticket (outside the chat), each one either
     * internal (agents only) or external (shared with the customer).
     */
    public function up(): void
    {
        Schema::create('ticket_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ticket_id')->constrained()->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('path');
            $table->string('original_name');
            $table->string('mime_type')->nullable();
            $table->unsignedBigInteger('size')->default(0);
            $table->string('visibility', 16)->default('internal');
            $table->timestamp('last_sent_at')->nullable();
            $table->string('last_sent_to')->nullable();
            $table->timestamps();

            // Explicit short name: MySQL rejects identifiers over 64 characters.
            $table->index(['ticket_id', 'visibility'], 'ticket_files_visibility_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ticket_files');
    }
};
