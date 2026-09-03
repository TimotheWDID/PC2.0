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
        $ticketTable = config('laravel_ticket.table_names.tickets', 'tickets');

        Schema::table($ticketTable, function (Blueprint $table) {
            $table->json('brought_items')->nullable()->after('message');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $ticketTable = config('laravel_ticket.table_names.tickets', 'tickets');

        Schema::table($ticketTable, function (Blueprint $table) {
            $table->dropColumn('brought_items');
        });
    }
};
