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
        // A first run on MySQL could leave the table without its unique index
        // (name too long), so start clean: the table is empty at that point.
        Schema::dropIfExists('device_remote_subscription');

        // Client devices covered by a NinjaOne subscription
        Schema::create('device_remote_subscription', function (Blueprint $table) {
            $table->id();
            $table->foreignId('device_id')->constrained('devices')->cascadeOnDelete();
            $table->foreignId('remote_subscription_id')->constrained('remote_subscriptions')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['device_id', 'remote_subscription_id'], 'device_remote_sub_unique');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('device_remote_subscription');
    }
};
