<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Quick diags are saved without a ticket until they are attached to one.
     */
    public function up(): void
    {
        Schema::table('diagnostics', function (Blueprint $table) {
            $table->unsignedBigInteger('ticket_id')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('diagnostics')->whereNull('ticket_id')->delete();

        Schema::table('diagnostics', function (Blueprint $table) {
            $table->unsignedBigInteger('ticket_id')->nullable(false)->change();
        });
    }
};
