<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Agent;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Créer un agent administrateur
        $admin = User::updateOrCreate(
            ['email' => 'admin@support.com'],
            [
                'first_name' => 'Admin',
                'last_name' => 'Support',
                'password' => Hash::make('password'),
                'phone' => '+33612345678',
                'address' => '123 Rue de la Tech, Paris',
                'default_notification_preference' => 'Email',
            ]
        );

        Agent::updateOrCreate([
            'user_id' => $admin->id,
        ], [
            'is_admin' => true,
        ]);

        // Créer quelques agents
        $agents = [
            ['first_name' => 'Jean', 'last_name' => 'Dupont', 'email' => 'jean.dupont@support.com'],
            ['first_name' => 'Marie', 'last_name' => 'Martin', 'email' => 'marie.martin@support.com'],
            ['first_name' => 'Pierre', 'last_name' => 'Dubois', 'email' => 'pierre.dubois@support.com'],
        ];

        foreach ($agents as $agentData) {
            $user = User::updateOrCreate(
                ['email' => $agentData['email']],
                [
                    'first_name' => $agentData['first_name'],
                    'last_name' => $agentData['last_name'],
                    'password' => Hash::make('password'),
                    'phone' => '+336' . rand(10000000, 99999999),
                    'default_notification_preference' => 'Email',
                ]
            );

            Agent::updateOrCreate([
                'user_id' => $user->id,
            ], [
                'is_admin' => false,
            ]);
        }

        // Créer des utilisateurs clients
        $clients = [
            ['first_name' => 'Sophie', 'last_name' => 'Bernard', 'email' => 'sophie.bernard@example.com'],
            ['first_name' => 'Lucas', 'last_name' => 'Petit', 'email' => 'lucas.petit@example.com'],
            ['first_name' => 'Emma', 'last_name' => 'Roux', 'email' => 'emma.roux@example.com'],
            ['first_name' => 'Thomas', 'last_name' => 'Moreau', 'email' => 'thomas.moreau@example.com'],
            ['first_name' => 'Julie', 'last_name' => 'Simon', 'email' => 'julie.simon@example.com'],
            ['first_name' => 'Marc', 'last_name' => 'Laurent', 'email' => 'marc.laurent@example.com'],
            ['first_name' => 'Claire', 'last_name' => 'Lefebvre', 'email' => 'claire.lefebvre@example.com'],
            ['first_name' => 'Nicolas', 'last_name' => 'Michel', 'email' => 'nicolas.michel@example.com'],
        ];

        foreach ($clients as $clientData) {
            User::updateOrCreate(
                ['email' => $clientData['email']],
                [
                    'first_name' => $clientData['first_name'],
                    'last_name' => $clientData['last_name'],
                    'password' => Hash::make('password'),
                    'phone' => '+336' . rand(10000000, 99999999),
                    'address' => rand(1, 999) . ' Rue ' . ['de la Paix', 'Victor Hugo', 'Voltaire', 'Molière'][rand(0, 3)] . ', ' . ['Paris', 'Lyon', 'Marseille', 'Toulouse'][rand(0, 3)],
                    'default_notification_preference' => ['SMS', 'Email', 'None'][rand(0, 2)],
                ]
            );
        }
    }
}
