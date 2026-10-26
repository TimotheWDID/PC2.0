<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Windows events taught to PC2 Diag by the technicians, shared by every
     * paired app: one note per source and event number.
     */
    public function up(): void
    {
        Schema::create('diag_event_notes', function (Blueprint $table) {
            $table->id();
            $table->string('source');
            $table->unsignedInteger('event_id');
            $table->string('sev', 10)->default('warn');
            $table->boolean('noise')->default(false);
            $table->string('title');
            $table->text('explain');
            $table->text('advice')->nullable();
            $table->json('causes')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->unique(['source', 'event_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('diag_event_notes');
    }
};
