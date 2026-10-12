<?php

namespace App\Http\Controllers;

use App\Models\Commande;
use App\Models\Ticket;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

class TicketMagicLinkController extends Controller
{
    public function show(Request $request, string $token): Response
    {
        if (! Ticket::looksLikeMagicToken($token)) {
            abort(404, 'Lien ticket invalide.');
        }

        $ticket = Ticket::findByMagicToken($token);

        if (! $ticket) {
            abort(404, 'Lien ticket invalide ou expire.');
        }

        $ticket->load(['user', 'category', 'device']);

        $response = Inertia::render('Tickets/PublicShow', [
            'ticket' => [
                'id' => $ticket->id,
                'title' => $ticket->title,
                'message' => $ticket->message,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
                'created_at' => $ticket->created_at?->toIso8601String(),
                'updated_at' => $ticket->updated_at?->toIso8601String(),
                'notify_by' => $ticket->notify_by,
                'contact_email' => $ticket->contact_email,
                'contact_phone' => $ticket->contact_phone,
                'category' => $ticket->category ? [
                    'id' => $ticket->category->id,
                    'name' => $ticket->category->name,
                ] : null,
                'user' => $ticket->user ? [
                    'id' => $ticket->user->id,
                    'name' => trim((string) $ticket->user->first_name.' '.(string) $ticket->user->last_name),
                    'email' => $ticket->user->email,
                    'phone' => $ticket->user->phone,
                ] : null,
                'device' => $ticket->device ? [
                    'id' => $ticket->device->id,
                    'display_name' => $ticket->device->display_name,
                    'serial_number' => $ticket->device->serial_number,
                    'asset_tag' => $ticket->device->asset_tag,
                ] : null,
            ],
            // Only non-sensitive fields: no supplier, order number or prices.
            'commandes' => Commande::query()
                ->where('ticket_id', $ticket->id)
                ->orderBy('created_at')
                ->get(['id', 'nom', 'statut', 'created_at', 'updated_at'])
                ->map(fn (Commande $commande) => [
                    'id' => $commande->id,
                    'nom' => $commande->nom,
                    'statut' => $commande->statut,
                    'created_at' => $commande->created_at?->toIso8601String(),
                    'updated_at' => $commande->updated_at?->toIso8601String(),
                ])
                ->values(),
            'magicAccess' => [
                'enabled' => true,
                'token' => $token,
                'read_only' => false,
            ],
        ])->toResponse($request);

        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');

        return $response;
    }
}
