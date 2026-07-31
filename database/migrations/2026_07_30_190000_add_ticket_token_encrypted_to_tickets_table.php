<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table(config('laravel_ticket.table_names.tickets', 'tickets'), function (Blueprint $table): void {
            $table->text('ticket_token_encrypted')->nullable()->after('ticket_token_hash');
        });
    }

    public function down(): void
    {
        Schema::table(config('laravel_ticket.table_names.tickets', 'tickets'), function (Blueprint $table): void {
            $table->dropColumn('ticket_token_encrypted');
        });
    }
};
