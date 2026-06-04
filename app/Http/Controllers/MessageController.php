<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Ticket;
use App\Models\TicketTimelineEvent;
use App\Notifications\TicketMessageNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MessageController extends Controller
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

    private function authorizeTicketAccess(Ticket $ticket): void
    {
        $user = Auth::user();

        if (!$user) {
            abort(403, 'Acces non autorise.');
        }

        if ($this->isAgentContext()) {
            return;
        }

        if ((int) $ticket->user_id !== (int) $user->id) {
            abort(403, 'Acces non autorise.');
        }
    }

    private function logTechnicianMessageEvent(Ticket $ticket, Message $message): void
    {
        $user = Auth::user();

        if (!$user || !$this->isAgentContext()) {
            return;
        }

        TicketTimelineEvent::create([
            'ticket_id' => $ticket->id,
            'technician_id' => $user->id,
            'event_type' => $message->is_internal ? 'internal_note_added' : 'public_reply_added',
            'summary' => $message->is_internal
                ? 'Note interne ajoutee sur le ticket'
                : 'Reponse publique ajoutee sur le ticket',
            'details' => [
                'message_id' => $message->id,
                'is_internal' => $message->is_internal,
                'preview' => mb_substr((string) $message->content, 0, 180),
            ],
            'happened_at' => now(),
        ]);
    }
    /**
     * Get all messages for a specific ticket
     */
    public function index($ticketId)
    {
        // If this endpoint is opened directly in a browser tab, route back to the ticket page.
        if (! request()->expectsJson() && ! request()->ajax()) {
            return redirect()->route('tickets.show', ['ticket' => $ticketId]);
        }

        $ticket = Ticket::findOrFail($ticketId);
        $this->authorizeTicketAccess($ticket);

        $messages = $ticket->messages()
            ->with('author:id,first_name,last_name,email')
            ->orderBy('created_at', 'asc')
            ->get()
            ->map(function ($message) {
                return [
                    'id' => $message->id,
                    'content' => $message->content,
                    'is_internal' => $message->is_internal,
                    'attachments' => $message->attachments ?? [],
                    'created_at' => $message->created_at->toISOString(),
                    'author' => [
                        'id' => $message->author->id,
                        'name' => $message->author->first_name . ' ' . $message->author->last_name,
                        'email' => $message->author->email,
                    ],
                ];
            });

        return response()->json([
            'messages' => $messages,
        ]);
    }

    /**
     * Store a new message for a ticket
     */
    public function store(Request $request, $ticketId)
    {
        $ticket = Ticket::findOrFail($ticketId);
        $this->authorizeTicketAccess($ticket);

        $validated = $request->validate([
            'content' => 'required|string|max:5000',
            'is_internal' => 'nullable|boolean',
            'attachments' => 'nullable|array',
        ]);

        $message = Message::create([
            'ticket_id' => $ticket->id,
            'author_id' => Auth::id(),
            'content' => $validated['content'],
            'is_internal' => $validated['is_internal'] ?? false,
            'attachments' => $validated['attachments'] ?? [],
        ]);

        $message->load('author:id,first_name,last_name,email');

        $this->logTechnicianMessageEvent($ticket, $message);

        // Envoyer une notification email si le message n'est pas interne
        if (!$message->is_internal && $ticket->user && $ticket->user->email) {
            // Ne notifier que si l'auteur n'est pas le user lui-même
            if ($message->author_id !== $ticket->user_id) {
                $ticket->user->notify(new TicketMessageNotification($ticket, $message));
            }
        }

        return response()->json([
            'message' => [
                'id' => $message->id,
                'content' => $message->content,
                'is_internal' => $message->is_internal,
                'attachments' => $message->attachments ?? [],
                'created_at' => $message->created_at->toISOString(),
                'author' => [
                    'id' => $message->author->id,
                    'name' => $message->author->first_name . ' ' . $message->author->last_name,
                    'email' => $message->author->email,
                ],
            ],
        ], 201);
    }

    /**
     * Delete a message
     */
    public function destroy($ticketId, $messageId)
    {
        $message = Message::where('ticket_id', $ticketId)
            ->where('id', $messageId)
            ->firstOrFail();

        $ticket = Ticket::findOrFail($ticketId);
        $this->authorizeTicketAccess($ticket);

        // Only allow the author or an admin to delete
        if ($message->author_id !== Auth::id()) {
            abort(403, 'Unauthorized action.');
        }

        $message->delete();

        return response()->json([
            'success' => true,
        ]);
    }
}
