<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Seed default specialities
        $this->call([
            SpecialitiesTableSeeder::class,
            UserSeeder::class,
            CategorySeeder::class,
            TicketSeeder::class,
            CommandeSeeder::class,
        ]);
    }
}
