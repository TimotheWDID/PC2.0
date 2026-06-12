<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Ticket;
use App\Models\TicketTimelineEvent;
use App\Models\User;
use App\Notifications\AgentMentionNotification;
use App\Notifications\TicketMessageNotification;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Throwable;

class MessageController extends Controller
{
    /**
     * @param array<int, int> $messageIds
     * @return array<int, array{exists: bool, validated: bool, unread_count: int}>
     */
    private function buildMentionNotificationStateForMessages(array $messageIds): array
    {
        if (empty($messageIds)) {
            return [];
        }

        try {
            $notifications = DatabaseNotification::query()
                ->where('type', AgentMentionNotification::class)
                ->whereIn('data->message_id', $messageIds)
                ->get(['id', 'data', 'read_at']);
        } catch (Throwable $exception) {
            return [];
        }

        $raw = [];

        foreach ($notifications as $notification) {
            $messageId = (int) data_get($notification->data, 'message_id');

            if ($messageId <= 0) {
                continue;
            }

            if (! isset($raw[$messageId])) {
                $raw[$messageId] = [
                    'total' => 0,
                    'unread' => 0,
                ];
            }

            $raw[$messageId]['total']++;

            if (is_null($notification->read_at)) {
                $raw[$messageId]['unread']++;
            }
        }

        $state = [];

        foreach ($raw as $messageId => $counts) {
            $state[(int) $messageId] = [
                'exists' => true,
                'validated' => ($counts['total'] ?? 0) > 0 && ($counts['unread'] ?? 0) === 0,
                'unread_count' => (int) ($counts['unread'] ?? 0),
            ];
        }

        return $state;
    }

    private function normalizeMentionToken(string $value): string
    {
        $normalized = Str::of($value)
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]/', '')
            ->toString();

        return trim($normalized);
    }

    private function buildAgentMentionAliases(User $user): array
    {
        $firstName = trim((string) ($user->first_name ?? ''));
        $lastName = trim((string) ($user->last_name ?? ''));

        $firstNormalized = $this->normalizeMentionToken($firstName);
        $lastNormalized = $this->normalizeMentionToken($lastName);

        $fullAlias = $this->normalizeMentionToken($firstNormalized . $lastNormalized);
        $shortAlias = '';

        if ($firstNormalized !== '' && $lastNormalized !== '') {
            $shortAlias = $this->normalizeMentionToken(substr($firstNormalized, 0, 1) . substr($lastNormalized, 0, 2));
        }

        return [
            'full' => $fullAlias,
            'short' => $shortAlias,
        ];
    }

    private function extractMentionTokens(string $content): array
    {
        preg_match_all('/@([\\pL\\pN]+)/u', $content, $matches);

        return collect($matches[1] ?? [])
            ->map(fn ($rawToken) => $this->normalizeMentionToken((string) $rawToken))
            ->filter(fn ($token) => $token !== '')
            ->unique()
            ->values()
            ->all();
    }

    /**
     * @return array{ids: \Illuminate\Support\Collection<int, int>, warnings: array<int, string>}
     */
    private function resolveMentionedAgents(array $tokens): array
    {
        $agents = User::query()
            ->whereHas('agent', function ($query) {
                $query->where('is_active', true);
            })
            ->get(['id', 'first_name', 'last_name', 'email']);

        $fullAliasMap = [];
        $shortAliasMap = [];

        foreach ($agents as $agent) {
            $aliases = $this->buildAgentMentionAliases($agent);

            if (! empty($aliases['full'])) {
                $fullAliasMap[$aliases['full']] = $fullAliasMap[$aliases['full']] ?? [];
                $fullAliasMap[$aliases['full']][] = (int) $agent->id;
            }

            if (! empty($aliases['short'])) {
                $shortAliasMap[$aliases['short']] = $shortAliasMap[$aliases['short']] ?? [];
                $shortAliasMap[$aliases['short']][] = (int) $agent->id;
            }
        }

        $mentionedIds = collect();
        $warnings = [];

        foreach ($tokens as $token) {
            if (isset($fullAliasMap[$token])) {
                $mentionedIds = $mentionedIds->merge($fullAliasMap[$token]);
                continue;
            }

            if (isset($shortAliasMap[$token])) {
                $candidateIds = array_values(array_unique($shortAliasMap[$token]));

                if (count($candidateIds) === 1) {
                    $mentionedIds = $mentionedIds->merge($candidateIds);
                } else {
                    $warnings[] = 'La mention @' . $token . ' est ambigue. Utilisez le format complet @prenomnom.';
                }
                continue;
            }
        }

        return [
            'ids' => $mentionedIds->unique()->values(),
            'warnings' => array_values(array_unique($warnings)),
        ];
    }

    /**
     * @return array<int, string>
     */
    private function notifyMentionedAgents(Ticket $ticket, Message $message): array
    {
        if (! $message->is_internal || ! $this->isAgentContext()) {
            return [];
        }

        $tokens = $this->extractMentionTokens((string) $message->content);

        if (empty($tokens)) {
            return [];
        }

        $resolution = $this->resolveMentionedAgents($tokens);
        $mentionedIds = $resolution['ids']
            ->unique()
            ->values();

        if ($mentionedIds->isEmpty()) {
            return $resolution['warnings'];
        }

        $authorName = trim(($message->author?->first_name ?? '') . ' ' . ($message->author?->last_name ?? ''));

        User::query()
            ->whereIn('id', $mentionedIds->all())
            ->get()
            ->each(function (User $recipient) use ($ticket, $message, $authorName) {
                $recipient->notify(new AgentMentionNotification($ticket, $message, $authorName));
            });

        return $resolution['warnings'];
    }

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

        $messageModels = $ticket->messages()
            ->with('author:id,first_name,last_name,email')
            ->orderBy('created_at', 'asc')
            ->get();

        $mentionStateByMessageId = $this->buildMentionNotificationStateForMessages(
            $messageModels
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->values()
                ->all()
        );

        $messages = $messageModels->map(function ($message) use ($mentionStateByMessageId) {
                $mentionNotification = $mentionStateByMessageId[(int) $message->id] ?? [
                    'exists' => false,
                    'validated' => false,
                    'unread_count' => 0,
                ];

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
                    'mention_notification' => $mentionNotification,
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
        $mentionWarnings = $this->notifyMentionedAgents($ticket, $message);
        $mentionStateByMessageId = $this->buildMentionNotificationStateForMessages([(int) $message->id]);
        $mentionNotification = $mentionStateByMessageId[(int) $message->id] ?? [
            'exists' => false,
            'validated' => false,
            'unread_count' => 0,
        ];

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
                'mention_notification' => $mentionNotification,
            ],
            'meta' => [
                'mention_warnings' => $mentionWarnings,
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

    /**
     * Validate mention notification status for a specific message.
     * Marks all recipients notifications for this message as read so the OK state is shared.
     */
    public function validateMention($ticketId, $messageId)
    {
        $ticket = Ticket::findOrFail($ticketId);
        $this->authorizeTicketAccess($ticket);

        if (! $this->isAgentContext()) {
            abort(403, 'Action non autorisee.');
        }

        $message = Message::where('ticket_id', $ticketId)
            ->where('id', $messageId)
            ->firstOrFail();

        if (! $message->is_internal) {
            return response()->json([
                'success' => false,
                'message' => 'Seules les notes internes peuvent etre validees.',
            ], 422);
        }

        DatabaseNotification::query()
            ->where('type', AgentMentionNotification::class)
            ->where('data->message_id', (int) $message->id)
            ->whereNull('read_at')
            ->update([
                'read_at' => now(),
                'updated_at' => now(),
            ]);

        return response()->json([
            'success' => true,
            'message_id' => (int) $message->id,
            'validated' => true,
        ]);
    }
}
