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
        $tableName = config('laravel_ticket.table_names.tickets', 'tickets');
        // use the configured categories table name
        $categoriesTable = config('laravel_ticket.table_names.categories', 'categories');

        Schema::table($tableName, function (Blueprint $table) use ($categoriesTable) {
            // Ensure column exists, then add FK
            $table->foreign('category_id')->references('id')->on($categoriesTable)->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $tableName = config('laravel_ticket.table_names.tickets', 'tickets');

        Schema::table($tableName, function (Blueprint $table) {
            $table->dropForeign(['category_id']);
        });
    }
};
