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
        // Extra remote support hours a client pays for on top of the plan
        Schema::create('remote_time_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('remote_subscription_id')->constrained('remote_subscriptions')->cascadeOnDelete();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->date('purchased_on');
            $table->unsignedInteger('minutes');
            $table->decimal('price', 10, 2)->nullable();
            $table->string('note')->nullable();
            $table->timestamps();

            $table->index(['remote_subscription_id', 'purchased_on']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('remote_time_purchases');
    }
};
