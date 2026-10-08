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
        // Un client peut être une personne ou une entreprise ; une personne peut être
        // rattachée (facultativement) à une entreprise. Les fiches existantes restent
        // des personnes grâce à la valeur par défaut.
        Schema::table('users', function (Blueprint $table) {
            $table->string('client_type', 20)->default('person')->after('id');
            $table->string('company_name')->nullable()->after('last_name');
            $table->string('siret', 20)->nullable()->after('company_name');
            $table->foreignId('company_id')->nullable()->after('siret')->constrained('users')->nullOnDelete();

            $table->index('client_type');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['company_id']);
            $table->dropIndex(['client_type']);
            $table->dropColumn(['client_type', 'company_name', 'siret', 'company_id']);
        });
    }
};
