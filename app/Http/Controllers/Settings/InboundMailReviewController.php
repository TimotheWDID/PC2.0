<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Models\InboundEmail;
use App\Models\Message;
use App\Models\Ticket;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class InboundMailReviewController extends Controller
{
    public function index(Request $request): Response
    {
        $this->ensureAgent();

        $queryText = trim((string) $request->query('q', ''));

        $query = InboundEmail::query()
            ->pendingHumanReview()
            ->orderByDesc('received_at')
            ->orderByDesc('id');

        if ($queryText !== '') {
            $lower = mb_strtolower($queryText);

            $query->where(function ($builder) use ($lower) {
                $builder
                    ->whereRaw('LOWER(sender_email) like ?', ["%{$lower}%"])
                    ->orWhereRaw('LOWER(subject) like ?', ["%{$lower}%"])
                    ->orWhereRaw('LOWER(message_id) like ?', ["%{$lower}%"])
                    ->orWhereRaw('LOWER(error) like ?', ["%{$lower}%"]);
            });
        }

        $emails = $query->paginate(30)->withQueryString();

        return Inertia::render('settings/inbound-mail-review', [
            'filters' => [
                'q' => $queryText,
            ],
            'emails' => [
                'data' => $emails->getCollection()->map(fn (InboundEmail $email) => [
                    'id' => $email->id,
                    'mailbox_uid' => $email->mailbox_uid,
                    'message_id' => $email->message_id,
                    'sender_email' => $email->sender_email,
                    'subject' => $email->subject,
                    'body_text' => $email->body_text,
                    'status' => $email->status,
                    'error' => $email->error,
                    'received_at' => $email->received_at?->toIso8601String(),
                    'processed_at' => $email->processed_at?->toIso8601String(),
                    'ticket_id' => $email->ticket_id,
                    'ticket_ref_from_subject' => $this->extractTicketIdFromSubject((string) $email->subject),
                ])->values(),
                'meta' => [
                    'current_page' => $emails->currentPage(),
                    'last_page' => $emails->lastPage(),
                    'per_page' => $emails->perPage(),
                    'total' => $emails->total(),
                ],
                'links' => [
                    'prev' => $emails->previousPageUrl(),
                    'next' => $emails->nextPageUrl(),
                ],
            ],
        ]);
    }

    public function attachToTicket(Request $request, int $inboundEmailId): RedirectResponse
    {
        $this->ensureAgent();

        $payload = $request->validate([
            'ticket_id' => ['required', 'integer', 'exists:tickets,id'],
        ]);

        $inboundEmail = InboundEmail::query()->findOrFail($inboundEmailId);

        if (! in_array($inboundEmail->status, InboundEmail::HUMAN_REVIEW_STATUSES, true)) {
            return back()->withErrors([
                'ticket_id' => 'Ce mail n\'est plus en attente de validation humaine.',
            ]);
        }

        $body = trim((string) ($inboundEmail->body_text ?? ''));

        if ($body === '') {
            return back()->withErrors([
                'ticket_id' => 'Le contenu du mail est vide, impossible de l\'ajouter au ticket.',
            ]);
        }

        $ticket = Ticket::query()->findOrFail((int) $payload['ticket_id']);

        Message::create([
            'ticket_id' => $ticket->id,
            'author_id' => $ticket->user_id,
            'content' => $body,
            'is_internal' => false,
            'attachments' => [],
        ]);

        $inboundEmail->ticket_id = $ticket->id;
        $inboundEmail->status = 'processed_manual';
        $inboundEmail->error = null;
        $inboundEmail->processed_at = now();
        $inboundEmail->save();

        return back()->with('success', 'Mail lie au ticket #'.$ticket->id.' et ajoute comme reponse publique.');
    }

    public function dismiss(Request $request, int $inboundEmailId): RedirectResponse
    {
        $this->ensureAgent();

        $payload = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $inboundEmail = InboundEmail::query()->findOrFail($inboundEmailId);

        if (! in_array($inboundEmail->status, InboundEmail::HUMAN_REVIEW_STATUSES, true)) {
            return back();
        }

        $reason = trim((string) ($payload['reason'] ?? ''));

        $inboundEmail->status = 'skipped_human_dismissed';
        $inboundEmail->error = $reason !== '' ? $reason : $inboundEmail->error;
        $inboundEmail->processed_at = now();
        $inboundEmail->save();

        return back()->with('success', 'Mail marque comme traite manuellement (ignore).');
    }

    private function ensureAgent(): void
    {
        $user = Auth::user();

        if (! $user || ! $user->agent) {
            abort(403, 'Acces reserve aux agents.');
        }
    }

    private function extractTicketIdFromSubject(string $subject): ?int
    {
        if (preg_match('/ticket\s*#\s*(\d+)/i', $subject, $matches) !== 1) {
            return null;
        }

        $ticketId = (int) ($matches[1] ?? 0);

        return $ticketId > 0 ? $ticketId : null;
    }
}
