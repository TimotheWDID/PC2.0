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
            ['name' => 'Matériel informatique', 'slug' => 'materiel-informatique'],
            ['name' => 'Logiciel', 'slug' => 'logiciel'],
            ['name' => 'Réseau', 'slug' => 'reseau'],
            ['name' => 'Impression', 'slug' => 'impression'],
            ['name' => 'Téléphonie', 'slug' => 'telephonie'],
            ['name' => 'Accès et sécurité', 'slug' => 'acces-securite'],
            ['name' => 'Email', 'slug' => 'email'],
            ['name' => 'Autre', 'slug' => 'autre'],
        ];

        foreach ($categories as $category) {
            Category::create($category);
        }
    }
}
