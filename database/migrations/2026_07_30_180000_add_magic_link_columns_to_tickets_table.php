<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(config('laravel_ticket.table_names.tickets', 'tickets'), function (Blueprint $table): void {
            $table->string('ticket_token_hash', 64)->nullable()->after('is_locked')->index();
            $table->timestamp('token_expires_at')->nullable()->after('ticket_token_hash');
        });
    }

    public function down(): void
    {
        Schema::table(config('laravel_ticket.table_names.tickets', 'tickets'), function (Blueprint $table): void {
            $table->dropColumn(['ticket_token_hash', 'token_expires_at']);
        });
    }
};
