<?php

namespace Database\Seeders;

use App\Models\Ticket;
use App\Models\User;
use App\Models\Agent;
use App\Models\Category;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class TicketSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = User::whereDoesntHave('agent')->get();
        $agents = Agent::all();
        $categories = Category::all();

        $ticketData = [
            ['title' => 'Mon ordinateur ne démarre plus', 'priority' => 'high', 'status' => 'open'],
            ['title' => 'Problème de connexion WiFi', 'priority' => 'medium', 'status' => 'in_progress'],
            ['title' => 'Imprimante bloquée', 'priority' => 'low', 'status' => 'pending'],
            ['title' => 'Impossible d\'accéder à mes emails', 'priority' => 'high', 'status' => 'open'],
            ['title' => 'Installation d\'un nouveau logiciel', 'priority' => 'low', 'status' => 'resolved'],
            ['title' => 'Mot de passe oublié', 'priority' => 'medium', 'status' => 'open'],
            ['title' => 'Écran noir au démarrage', 'priority' => 'high', 'status' => 'in_progress'],
            ['title' => 'Clavier ne fonctionne plus', 'priority' => 'medium', 'status' => 'open'],
            ['title' => 'Demande de nouveau compte utilisateur', 'priority' => 'low', 'status' => 'pending'],
            ['title' => 'Lenteur générale du système', 'priority' => 'medium', 'status' => 'in_progress'],
            ['title' => 'Problème de son', 'priority' => 'low', 'status' => 'resolved'],
            ['title' => 'Mise à jour Windows bloquée', 'priority' => 'medium', 'status' => 'open'],
            ['title' => 'Partage de fichiers non fonctionnel', 'priority' => 'high', 'status' => 'open'],
            ['title' => 'Souris sans fil déconnectée', 'priority' => 'low', 'status' => 'closed'],
            ['title' => 'Besoin d\'accès VPN', 'priority' => 'medium', 'status' => 'in_progress'],
        ];

        $messages = [
            'Bonjour, j\'ai besoin d\'aide rapidement. Merci.',
            'Le problème a commencé ce matin. Pouvez-vous m\'aider ?',
            'C\'est urgent, je ne peux plus travailler.',
            'J\'ai déjà essayé de redémarrer mais ça ne fonctionne toujours pas.',
            'Est-ce que quelqu\'un peut passer me voir ?',
            'J\'ai besoin de ce service pour demain si possible.',
        ];

        foreach ($ticketData as $data) {
            if ($users->isEmpty() || $categories->isEmpty()) {
                break;
            }

            $user = $users->random();
            $category = $categories->random();
            $assignee = $agents->isNotEmpty() && rand(0, 1) ? $agents->random() : null;

            Ticket::create([
                'uuid' => Str::uuid(),
                'user_id' => $user->id,
                'title' => $data['title'],
                'message' => $messages[array_rand($messages)],
                'priority' => $data['priority'],
                'status' => $data['status'],
                'category_id' => $category->id,
                'assignee_id' => $assignee?->user_id,
                'invoice_id' => rand(0, 1) ? 'INV-' . rand(1000, 9999) : null,
                'contact_phone' => $user->phone,
                'contact_email' => $user->email,
                'notify_by' => ['SMS', 'Email', 'None'][rand(0, 2)],
                'is_resolved' => in_array($data['status'], ['resolved', 'closed']),
                'is_locked' => rand(0, 10) > 8,
            ]);
        }
    }
}
