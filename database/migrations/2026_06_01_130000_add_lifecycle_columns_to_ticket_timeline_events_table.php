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
        Schema::table('ticket_timeline_events', function (Blueprint $table) {
            $table->foreignId('removed_by_id')->nullable()->after('technician_id')->constrained('users')->nullOnDelete();
            $table->text('removed_reason')->nullable()->after('details');
            $table->timestamp('removed_at')->nullable()->after('happened_at');
            $table->foreignId('restored_by_id')->nullable()->after('removed_by_id')->constrained('users')->nullOnDelete();
            $table->timestamp('restored_at')->nullable()->after('removed_at');
            $table->softDeletes();

            $table->index(['ticket_id', 'deleted_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ticket_timeline_events', function (Blueprint $table) {
            $table->dropIndex(['ticket_id', 'deleted_at']);
            $table->dropSoftDeletes();
            $table->dropConstrainedForeignId('restored_by_id');
            $table->dropColumn('restored_at');
            $table->dropConstrainedForeignId('removed_by_id');
            $table->dropColumn('removed_reason');
            $table->dropColumn('removed_at');
        });
    }
};
