<?php

namespace Database\Seeders;

use App\Models\Commande;
use App\Models\User;
use App\Models\Ticket;
use Illuminate\Database\Seeder;

class CommandeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $users = User::all();
        $tickets = Ticket::all();

        $commandesData = [
            ['nom' => 'Ordinateur portable Dell', 'fournisseur' => 'Dell France', 'statut' => 'commandé'],
            ['nom' => 'Licence Office 365', 'fournisseur' => 'Microsoft', 'statut' => 'réceptionner'],
            ['nom' => 'Imprimante laser HP', 'fournisseur' => 'HP Store', 'statut' => 'traité'],
            ['nom' => 'Clavier et souris sans fil', 'fournisseur' => null, 'statut' => 'new'],
            ['nom' => 'Écran 27 pouces', 'fournisseur' => 'Samsung', 'statut' => 'panier'],
            ['nom' => 'Disque dur externe 2To', 'fournisseur' => 'Western Digital', 'statut' => 'commandé'],
            ['nom' => 'Carte graphique NVIDIA', 'fournisseur' => 'LDLC', 'statut' => 'réceptionner'],
            ['nom' => 'Webcam HD', 'fournisseur' => 'Logitech', 'statut' => 'traité'],
            ['nom' => 'Casque audio professionnel', 'fournisseur' => 'Jabra', 'statut' => 'commandé'],
            ['nom' => 'Switch réseau 24 ports', 'fournisseur' => null, 'statut' => 'new'],
            ['nom' => 'Onduleur 1500VA', 'fournisseur' => 'APC', 'statut' => 'panier'],
            ['nom' => 'Câbles réseau Cat6', 'fournisseur' => 'Cable Store', 'statut' => 'réceptionner'],
        ];

        foreach ($commandesData as $index => $data) {
            if ($users->isEmpty()) {
                break;
            }

            $user = $users->random();
            $ticket = $tickets->isNotEmpty() && rand(0, 1) ? $tickets->random() : null;

            Commande::create([
                'user_id' => $user->id,
                'ticket_id' => $ticket?->id,
                'nom' => $data['nom'],
                'fournisseur' => $data['fournisseur'],
                'command_number' => in_array($data['statut'], ['new', 'panier']) ? null : 'CMD-' . date('Y') . '-' . str_pad($index + 1, 4, '0', STR_PAD_LEFT),
                'invoice_id' => rand(0, 1) ? 'FACT-' . rand(1000, 9999) : null,
                'statut' => $data['statut'],
            ]);
        }
    }
}
