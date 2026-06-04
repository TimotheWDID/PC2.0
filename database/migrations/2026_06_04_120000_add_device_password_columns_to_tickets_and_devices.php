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
            $table->text('device_password')->nullable()->after('message');
            $table->boolean('no_device_password')->default(false)->after('device_password');
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->text('access_password')->nullable()->after('notes');
            $table->boolean('no_access_password')->default(false)->after('access_password');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $ticketTable = config('laravel_ticket.table_names.tickets', 'tickets');

        Schema::table($ticketTable, function (Blueprint $table) {
            $table->dropColumn(['device_password', 'no_device_password']);
        });

        Schema::table('devices', function (Blueprint $table) {
            $table->dropColumn(['access_password', 'no_access_password']);
        });
    }
};
