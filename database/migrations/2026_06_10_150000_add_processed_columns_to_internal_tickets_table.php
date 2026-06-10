<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('internal_tickets', function (Blueprint $table) {
            $table->timestamp('processed_at')->nullable()->after('description');
            $table->foreignId('processed_by_id')->nullable()->after('processed_at')->constrained('users')->nullOnDelete();
            $table->index('processed_at');
        });
    }

    public function down(): void
    {
        Schema::table('internal_tickets', function (Blueprint $table) {
            $table->dropConstrainedForeignId('processed_by_id');
            $table->dropIndex(['processed_at']);
            $table->dropColumn('processed_at');
        });
    }
};
