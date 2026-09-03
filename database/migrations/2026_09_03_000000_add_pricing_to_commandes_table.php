<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('commandes', function (Blueprint $table) {
            $table->decimal('prix_ht', 10, 2)->nullable()->after('invoice_id');
            $table->decimal('coefficient_marge', 8, 2)->nullable()->after('prix_ht');
            $table->decimal('prix_vente_ttc', 10, 2)->nullable()->after('coefficient_marge');
        });
    }

    public function down(): void
    {
        Schema::table('commandes', function (Blueprint $table) {
            $table->dropColumn(['prix_ht', 'coefficient_marge', 'prix_vente_ttc']);
        });
    }
};
