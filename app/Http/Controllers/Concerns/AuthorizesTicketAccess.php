<?php

namespace App\Http\Controllers\Concerns;

use App\Models\Ticket;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Access to what a ticket shares with its customer: agents see everything,
 * the customer sees it when logged in as the ticket's owner or through a
 * valid magic link (?token=...).
 */
trait AuthorizesTicketAccess
{
    private function isAgentContext(): bool
    {
        $user = Auth::user();

        if (! $user || ! $user->agent) {
            return false;
        }

        $sessionPreviewMode = request()->session()->get('preview_mode');
        $previewAsNonAgent = is_string($sessionPreviewMode)
            ? $sessionPreviewMode === 'user'
            : (bool) request()->session()->get('preview_as_non_agent', false);

        return ! $previewAsNonAgent;
    }

    private function hasMagicTokenAccess(Request $request, Ticket $ticket): bool
    {
        $token = trim((string) $request->query('token', ''));

        if ($token === '' || ! Ticket::looksLikeMagicToken($token)) {
            return false;
        }

        return hash_equals((string) $ticket->ticket_token_hash, Ticket::hashMagicToken($token))
            && ! $ticket->isMagicTokenExpired();
    }

    private function authorizeTicketAccess(Request $request, Ticket $ticket): void
    {
        $user = Auth::user();

        if (! $user) {
            abort_unless($this->hasMagicTokenAccess($request, $ticket), 403, 'Acces au ticket refuse: lien invalide ou expire.');

            return;
        }

        if ($this->isAgentContext()) {
            return;
        }

        abort_unless((int) $ticket->user_id === (int) $user->id, 403, 'Acces non autorise.');
    }
}
