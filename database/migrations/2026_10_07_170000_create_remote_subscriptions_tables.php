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
        $ticketsTable = config('laravel_ticket.table_names.tickets', 'tickets');

        // NinjaOne remote support subscriptions, tracked manually per client
        Schema::create('remote_subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('plan');
            $table->string('status', 20)->default('active');
            $table->date('started_on');
            $table->date('ends_on')->nullable();
            $table->unsignedInteger('included_minutes')->default(0);
            $table->decimal('price', 10, 2)->nullable();
            $table->unsignedInteger('devices_count')->nullable();
            $table->string('ninjaone_reference')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['status', 'ends_on']);
        });

        Schema::create('remote_interventions', function (Blueprint $table) use ($ticketsTable) {
            $table->id();
            $table->foreignId('remote_subscription_id')->constrained('remote_subscriptions')->cascadeOnDelete();
            $table->foreignId('technician_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('ticket_id')->nullable()->constrained($ticketsTable)->nullOnDelete();
            $table->dateTime('performed_at');
            $table->unsignedInteger('duration_minutes');
            $table->text('description');
            $table->timestamps();

            $table->index(['remote_subscription_id', 'performed_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('remote_interventions');
        Schema::dropIfExists('remote_subscriptions');
    }
};
