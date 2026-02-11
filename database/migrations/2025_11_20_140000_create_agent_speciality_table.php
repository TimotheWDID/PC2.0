<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('agent_speciality', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agent_id')->constrained('agents')->onDelete('cascade');
            $table->foreignId('speciality_id')->constrained('specialities')->onDelete('cascade');
            $table->timestamps();
        });

        // Migrate existing speciality_id values from agents into the pivot
        if (Schema::hasTable('agents') && Schema::hasColumn('agents', 'speciality_id')) {
            $rows = DB::table('agents')->whereNotNull('speciality_id')->get(['id', 'speciality_id']);
            foreach ($rows as $r) {
                DB::table('agent_speciality')->insert([
                    'agent_id' => $r->id,
                    'speciality_id' => $r->speciality_id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            // drop the old column
            Schema::table('agents', function (Blueprint $table) {
                if (Schema::hasColumn('agents', 'speciality_id')) {
                    $table->dropForeign(['speciality_id']);
                    $table->dropColumn('speciality_id');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // restore column if needed (best effort)
        if (Schema::hasTable('agents') && !Schema::hasColumn('agents', 'speciality_id')) {
            Schema::table('agents', function (Blueprint $table) {
                $table->foreignId('speciality_id')->nullable()->constrained('specialities')->onDelete('set null');
            });

            // try to move one pivot entry back into agents.speciality_id when available
            $pairs = DB::table('agent_speciality')->select('agent_id', 'speciality_id')->get();
            foreach ($pairs as $p) {
                DB::table('agents')->where('id', $p->agent_id)->update(['speciality_id' => $p->speciality_id]);
            }
        }

        Schema::dropIfExists('agent_speciality');
    }
};
