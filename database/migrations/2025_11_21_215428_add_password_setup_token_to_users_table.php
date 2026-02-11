<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('password_setup_token')->nullable()->after('password');
            $table->timestamp('password_setup_token_expires_at')->nullable()->after('password_setup_token');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['password_setup_token', 'password_setup_token_expires_at']);
        });
    }
};
