<?php

namespace Database\Seeders;

use App\Models\Speciality;
use Illuminate\Database\Seeder;

class SpecialitiesTableSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $specialities = [
            'Vente',
            'Montage PC',
            'Réparation PC',
            'Réparation téléphone',
            'Réparation tablette',
            'Réparation imprimante',
            'Réinstallation système',
            'SAV / diagnostic',
            'SAV',
            'Logiciel / configuration',
            'Réseau / Wi-Fi',
            'Impression / périphériques',
            'Vente / conseil',
            'Sécurité / accès',
            'Divers',
        ];

        foreach ($specialities as $name) {
            Speciality::query()->updateOrCreate(['name' => $name]);
        }
    }
}
