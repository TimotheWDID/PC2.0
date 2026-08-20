<?php

namespace App\Http\Controllers;

use App\Models\Commande;
use App\Models\Device;
use App\Models\Ticket;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class GlobalSearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'q' => ['nullable', 'string', 'max:120'],
        ]);

        $query = trim((string) ($validated['q'] ?? ''));

        if (Str::length($query) < 2) {
            return response()->json([
                'query' => $query,
                'results' => [],
            ]);
        }

        $escaped = addcslashes($query, '%_');
        $like = '%' . $escaped . '%';
        $numericId = is_numeric($query) ? (int) $query : null;

        $tickets = Ticket::query()
            ->with(['user:id,first_name,last_name,email'])
            ->select(['id', 'title', 'status', 'user_id', 'updated_at'])
            ->where(function ($builder) use ($like, $numericId) {
                $builder
                    ->where('title', 'like', $like)
                    ->orWhere('status', 'like', $like)
                    ->orWhereHas('user', function ($userQuery) use ($like) {
                        $userQuery
                            ->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });

                if ($numericId !== null) {
                    $builder->orWhere('id', $numericId);
                }
            })
            ->latest('updated_at')
            ->limit(6)
            ->get()
            ->map(function (Ticket $ticket) {
                $userName = trim((string) ($ticket->user?->name ?? ''));

                return [
                    'id' => 'ticket-' . $ticket->id,
                    'type' => 'ticket',
                    'type_label' => 'Ticket',
                    'title' => sprintf('#%d - %s', $ticket->id, trim((string) ($ticket->title ?? 'Sans titre'))),
                    'subtitle' => $userName !== '' ? sprintf('Client: %s', $userName) : (string) ($ticket->user?->email ?? ''),
                    'status_key' => (string) ($ticket->status ?? ''),
                    'status_label' => $this->ticketStatusLabel((string) ($ticket->status ?? '')),
                    'href' => '/tickets/' . $ticket->id,
                    'updated_at' => optional($ticket->updated_at)->toIso8601String(),
                ];
            })
            ->values();

        $users = User::query()
            ->select(['id', 'first_name', 'last_name', 'email', 'phone', 'updated_at'])
            ->where(function ($builder) use ($like, $numericId) {
                $builder
                    ->where('first_name', 'like', $like)
                    ->orWhere('last_name', 'like', $like)
                    ->orWhere('email', 'like', $like)
                    ->orWhere('phone', 'like', $like);

                if ($numericId !== null) {
                    $builder->orWhere('id', $numericId);
                }
            })
            ->latest('updated_at')
            ->limit(6)
            ->get()
            ->map(function (User $user) {
                $fullName = trim((string) $user->name);

                return [
                    'id' => 'user-' . $user->id,
                    'type' => 'user',
                    'type_label' => 'Client',
                    'title' => sprintf('#%d - %s', $user->id, $fullName !== '' ? $fullName : 'Sans nom'),
                    'subtitle' => (string) ($user->email ?? ''),
                    'status_key' => '',
                    'status_label' => '',
                    'href' => '/users/' . $user->id . '/show',
                    'updated_at' => optional($user->updated_at)->toIso8601String(),
                ];
            })
            ->values();

        $commandes = Commande::query()
            ->with(['user:id,first_name,last_name,email'])
            ->select(['id', 'nom', 'command_number', 'fournisseur', 'statut', 'user_id', 'updated_at'])
            ->where(function ($builder) use ($like, $numericId) {
                $builder
                    ->where('nom', 'like', $like)
                    ->orWhere('command_number', 'like', $like)
                    ->orWhere('fournisseur', 'like', $like)
                    ->orWhere('statut', 'like', $like)
                    ->orWhereHas('user', function ($userQuery) use ($like) {
                        $userQuery
                            ->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });

                if ($numericId !== null) {
                    $builder->orWhere('id', $numericId);
                }
            })
            ->latest('updated_at')
            ->limit(6)
            ->get()
            ->map(function (Commande $commande) {
                $name = trim((string) ($commande->nom ?? ''));
                $title = $name !== '' ? $name : trim((string) ($commande->command_number ?? 'Sans libelle'));
                $userName = trim((string) ($commande->user?->name ?? ''));

                return [
                    'id' => 'commande-' . $commande->id,
                    'type' => 'commande',
                    'type_label' => 'Commande',
                    'title' => sprintf('#%d - %s', $commande->id, $title),
                    'subtitle' => $userName !== '' ? sprintf('Client: %s', $userName) : (string) ($commande->fournisseur ?? ''),
                    'status_key' => (string) ($commande->statut ?? ''),
                    'status_label' => $this->commandeStatusLabel((string) ($commande->statut ?? '')),
                    'href' => '/commandes/' . $commande->id,
                    'updated_at' => optional($commande->updated_at)->toIso8601String(),
                ];
            })
            ->values();

        $devices = Device::query()
            ->with(['user:id,first_name,last_name,email'])
            ->select(['id', 'user_id', 'device_type', 'brand', 'model', 'serial_number', 'asset_tag', 'updated_at'])
            ->where(function ($builder) use ($like, $numericId) {
                $builder
                    ->where('device_type', 'like', $like)
                    ->orWhere('brand', 'like', $like)
                    ->orWhere('model', 'like', $like)
                    ->orWhere('serial_number', 'like', $like)
                    ->orWhere('asset_tag', 'like', $like)
                    ->orWhereHas('user', function ($userQuery) use ($like) {
                        $userQuery
                            ->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('email', 'like', $like);
                    });

                if ($numericId !== null) {
                    $builder->orWhere('id', $numericId);
                }
            })
            ->latest('updated_at')
            ->limit(6)
            ->get()
            ->map(function (Device $device) {
                $brand = trim((string) ($device->brand ?? ''));
                $model = trim((string) ($device->model ?? ''));
                $deviceName = trim($brand . ' ' . $model);
                $userName = trim((string) ($device->user?->name ?? ''));

                return [
                    'id' => 'device-' . $device->id,
                    'type' => 'device',
                    'type_label' => 'Appareil',
                    'title' => sprintf('#%d - %s', $device->id, $deviceName !== '' ? $deviceName : 'Appareil'),
                    'subtitle' => $userName !== '' ? sprintf('Client: %s', $userName) : (string) ($device->serial_number ?? $device->asset_tag ?? ''),
                    'status_key' => (string) ($device->device_type ?? ''),
                    'status_label' => $this->deviceTypeLabel((string) ($device->device_type ?? '')),
                    'href' => '/devices/' . $device->id,
                    'updated_at' => optional($device->updated_at)->toIso8601String(),
                ];
            })
            ->values();

        $results = collect()
            ->concat($tickets)
            ->concat($users)
            ->concat($commandes)
            ->concat($devices)
            ->sortByDesc('updated_at')
            ->take(15)
            ->values();

        return response()->json([
            'query' => $query,
            'results' => $results,
        ]);
    }

    private function ticketStatusLabel(string $status): string
    {
        return [
            'open' => 'Ouvert',
            'in_progress' => 'En cours',
            'pending' => 'En attente',
            'resolved' => 'Resolu',
            'closed' => 'Ferme',
        ][$status] ?? $status;
    }

    private function commandeStatusLabel(string $status): string
    {
        return [
            'new' => 'Nouveau',
            'panier' => 'Panier',
            'commandé' => 'Commande',
            'receptionner' => 'Receptionne',
            'réceptionner' => 'Receptionne',
            'traité' => 'Traite',
            'traite' => 'Traite',
        ][$status] ?? $status;
    }

    private function deviceTypeLabel(string $type): string
    {
        return [
            'computer' => 'Ordinateur',
            'phone' => 'Telephone',
            'tablet' => 'Tablette',
            'printer' => 'Imprimante',
            'other' => 'Autre',
        ][$type] ?? $type;
    }
}
