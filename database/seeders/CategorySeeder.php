<?php

namespace Database\Seeders;

use App\Models\Category;
use Illuminate\Database\Seeder;

class CategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            ['name' => 'Réparation ordinateur', 'slug' => 'reparation-ordinateur'],
            ['name' => 'Réparation téléphone', 'slug' => 'reparation-telephone'],
            ['name' => 'Réparation tablette', 'slug' => 'reparation-tablette'],
            ['name' => 'SAV', 'slug' => 'sav'],
            ['name' => 'Vente', 'slug' => 'vente'],
            ['name' => 'Logiciel / configuration', 'slug' => 'logiciel-configuration'],
            ['name' => 'Réseau / Wi-Fi', 'slug' => 'reseau-wifi'],
            ['name' => 'Impression / périphériques', 'slug' => 'impression-peripheriques'],
            ['name' => 'Sécurité / accès', 'slug' => 'securite-acces'],
            ['name' => 'Divers', 'slug' => 'divers'],
        ];

        foreach ($categories as $category) {
            Category::query()->updateOrCreate(
                ['slug' => $category['slug']],
                [
                    'name' => $category['name'],
                    'is_visible' => true,
                ]
            );
        }
    }
}
