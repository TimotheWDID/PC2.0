<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class SpecialitiesTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // use upsert to avoid duplicate key errors if seeder runs multiple times
        DB::table('specialities')->updateOrInsert(['name' => 'Phone'], ['created_at' => now(), 'updated_at' => now()]);
        DB::table('specialities')->updateOrInsert(['name' => 'PC'], ['created_at' => now(), 'updated_at' => now()]);
    }
}
