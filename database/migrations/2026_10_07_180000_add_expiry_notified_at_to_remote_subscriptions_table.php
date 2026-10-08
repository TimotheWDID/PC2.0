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
        Schema::table('remote_subscriptions', function (Blueprint $table) {
            $table->timestamp('expiry_notified_at')->nullable()->after('notes');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('remote_subscriptions', function (Blueprint $table) {
            $table->dropColumn('expiry_notified_at');
        });
    }
};
