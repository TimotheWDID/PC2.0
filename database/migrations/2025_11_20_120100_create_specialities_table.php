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
        // already created by earlier migration 2025_11_20_115900_create_specialities_table.php
        // keep this migration empty to avoid duplicate table creation
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // noop: the other migration handles dropping the table
    }
};
