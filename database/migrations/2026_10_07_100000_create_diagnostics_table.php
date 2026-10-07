<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $ticketsTable = config('laravel_ticket.table_names.tickets', 'tickets');

        Schema::create('diagnostics', function (Blueprint $table) use ($ticketsTable) {
            $table->id();
            $table->foreignId('ticket_id')->constrained($ticketsTable)->cascadeOnDelete();
            $table->foreignId('device_id')->nullable()->constrained('devices')->nullOnDelete();
            $table->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('machine_name')->nullable();
            $table->string('overall', 20)->nullable();
            $table->string('overall_label')->nullable();
            $table->unsignedTinyInteger('viability_score')->nullable();
            $table->string('viability_level', 20)->nullable();
            $table->string('viability_label')->nullable();
            $table->longText('report');
            $table->json('inventory')->nullable();
            $table->json('state')->nullable();
            $table->json('files')->nullable();
            $table->timestamps();

            $table->index(['ticket_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('diagnostics');
    }
};
