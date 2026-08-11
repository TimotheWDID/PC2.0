<?php

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Ticket;
use App\Models\TicketTimelineEvent;
use App\Models\User;
use App\Notifications\AgentMentionNotification;
use App\Notifications\AgentTicketReplyNotification;
use App\Notifications\TicketMessageNotification;
use App\Notifications\Channels\SmsFactoryChannel;
use App\Support\Sms\PhoneNumber;
use App\Support\Sms\SmsSettings;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Throwable;

class MessageController extends Controller
{
    private function hasMagicTokenAccess(Request $request, Ticket $ticket): bool
    {
        $token = trim((string) $request->query('token', ''));

        if ($token === '' || ! Ticket::looksLikeMagicToken($token)) {
            return false;
        }

        $hashedToken = Ticket::hashMagicToken($token);

        return hash_equals((string) $ticket->ticket_token_hash, $hashedToken)
            && ! $ticket->isMagicTokenExpired();
    }

    private function resolveDeliveryChannelFromViaEntry(mixed $viaEntry): ?string
    {
        if (! is_string($viaEntry)) {
            return null;
        }

        if ($viaEntry === 'mail') {
            return 'Email';
        }

        if ($viaEntry === SmsFactoryChannel::class) {
            return 'SMS';
        }

        return null;
    }

    private function updateMessageDeliveryState(
        Message $message,
        string $status,
        ?string $channel = null,
        ?string $error = null,
        bool $markAsSent = false
    ): void {
        $message->notification_status = $status;

        if ($channel !== null) {
            $message->notification_channel = $channel;
        }

        $message->notification_error = $error;
        $message->notified_at = $markAsSent ? now() : null;
        $message->save();
    }

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

    private function notifyAgentsForCustomerReply(Ticket $ticket, Message $message): void
    {
        if ($message->is_internal) {
            return;
        }

        $ticket->loadMissing([
            'user:id,first_name,last_name',
            'assignee:id',
            'assignee.agent:id,user_id,is_active',
        ]);

        $customerName = trim(($ticket->user?->first_name ?? '') . ' ' . ($ticket->user?->last_name ?? ''));

        $recipientIds = collect();

        $assigneeIsActiveAgent = (bool) ($ticket->assignee?->agent?->is_active ?? false);
        if ($assigneeIsActiveAgent && $ticket->assignee_id) {
            $recipientIds->push((int) $ticket->assignee_id);
        } else {
            $recipientIds = User::query()
                ->whereHas('agent', function ($query) {
                    $query->where('is_active', true);
                })
                ->pluck('id')
                ->map(fn ($id) => (int) $id);
        }

        if ($recipientIds->isEmpty()) {
            return;
        }

        User::query()
            ->whereIn('id', $recipientIds->unique()->values()->all())
            ->get()
            ->each(function (User $recipient) use ($ticket, $message, $customerName) {
                $recipient->notify(new AgentTicketReplyNotification($ticket, $message, $customerName));
            });
    }

    private function authorizeTicketAccess(Request $request, Ticket $ticket): void
    {
        $user = Auth::user();

        if (!$user) {
            if ($this->hasMagicTokenAccess($request, $ticket)) {
                return;
            }

            abort(403, 'Acces au ticket refuse: lien invalide ou expire.');
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
     * @return array{channels: array<int, string>, email: ?string, phone: ?string}
     */
    private function resolveTicketNotificationContext(Ticket $ticket): array
    {
        $ticket->loadMissing('user:id,email,phone');

        $email = trim((string) ($ticket->contact_email ?: ($ticket->user?->email ?? '')));
        $phone = trim((string) ($ticket->contact_phone ?: ($ticket->user?->phone ?? '')));

        $channels = [];

        if ($email !== '') {
            $channels[] = 'Email';
        }

        if ($phone !== '' && SmsSettings::isEnabled() && PhoneNumber::normalize($phone) !== null) {
            $channels[] = 'SMS';
        }

        return [
            'channels' => $channels,
            'email' => $email !== '' ? $email : null,
            'phone' => $phone !== '' ? $phone : null,
        ];
    }

    private function resolvePublicNotificationChannel(Ticket $ticket, ?string $requestedChannel): ?string
    {
        $context = $this->resolveTicketNotificationContext($ticket);
        $availableChannels = $context['channels'];

        if ($requestedChannel !== null) {
            if ($requestedChannel === 'None') {
                return 'None';
            }

            if (in_array($requestedChannel, $availableChannels, true)) {
                return $requestedChannel;
            }

            return null;
        }

        $current = is_string($ticket->notify_by ?? null)
            ? trim((string) $ticket->notify_by)
            : 'None';

        if (in_array($current, $availableChannels, true)) {
            return $current;
        }

        if (in_array('Email', $availableChannels, true)) {
            return 'Email';
        }

        if (in_array('SMS', $availableChannels, true)) {
            return 'SMS';
        }

        return 'None';
    }

    private function applyPublicNotificationPreference(Ticket $ticket, string $channel): void
    {
        $context = $this->resolveTicketNotificationContext($ticket);

        $ticket->notify_by = $channel;

        if (empty($ticket->contact_email) && ! empty($context['email'])) {
            $ticket->contact_email = $context['email'];
        }

        if (empty($ticket->contact_phone) && ! empty($context['phone'])) {
            $ticket->contact_phone = $context['phone'];
        }

        if ($ticket->isDirty(['notify_by', 'contact_email', 'contact_phone'])) {
            $ticket->save();
        }
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
        $this->authorizeTicketAccess(request(), $ticket);

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
                    'delivery' => [
                        'channel' => $message->notification_channel,
                        'status' => $message->notification_status,
                        'error' => $message->notification_error,
                        'sent_at' => $message->notified_at?->toISOString(),
                    ],
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
            'ticket_created_notification' => [
                'channel' => $ticket->creation_notification_channel,
                'status' => $ticket->creation_notification_status,
                'error' => $ticket->creation_notification_error,
                'sent_at' => $ticket->creation_notified_at?->toISOString(),
            ],
        ]);
    }

    /**
     * Store a new message for a ticket
     */
    public function store(Request $request, $ticketId)
    {
        $ticket = Ticket::findOrFail($ticketId);
        $this->authorizeTicketAccess($request, $ticket);

        $isAuthenticated = Auth::check();

        $validated = $request->validate([
            'content' => 'required|string|max:5000',
            'is_internal' => 'nullable|boolean',
            'attachments' => 'nullable|array',
            'notification_channel' => 'nullable|in:SMS,Email,None',
            'sms_template' => 'nullable|array',
        ]);

        $isInternal = $isAuthenticated ? $request->boolean('is_internal') : false;
        $notificationChannel = null;

        if (! $isAuthenticated && $isInternal) {
            return response()->json([
                'message' => 'Les notes internes ne sont pas autorisees via ce lien.',
            ], 403);
        }

        if ($isAuthenticated && ! $isInternal && $this->isAgentContext()) {
            $notificationChannel = $this->resolvePublicNotificationChannel(
                $ticket,
                isset($validated['notification_channel']) ? (string) $validated['notification_channel'] : null
            );

            if ($notificationChannel === null) {
                $context = $this->resolveTicketNotificationContext($ticket);
                $requested = isset($validated['notification_channel']) ? (string) $validated['notification_channel'] : null;

                $errorMessage = 'Le canal choisi n\'est pas disponible pour ce client.';

                if ($requested === 'SMS') {
                    if (! SmsSettings::isEnabled()) {
                        $errorMessage = 'Le canal SMS est desactive dans les parametres SMS (ou la cle API est absente).';
                    } elseif ($context['phone'] === null) {
                        $errorMessage = 'Aucun numero de telephone renseigne pour ce client.';
                    } elseif (PhoneNumber::normalize($context['phone']) === null) {
                        $errorMessage = 'Le numero de telephone du client est invalide : ' . $context['phone'];
                    }
                } elseif ($requested === 'Email' && $context['email'] === null) {
                    $errorMessage = 'Aucune adresse email renseignee pour ce client.';
                }

                return response()->json([
                    'message' => $errorMessage,
                    'meta' => [
                        'available_channels' => $context['channels'],
                        'contact_email' => $context['email'],
                        'contact_phone' => $context['phone'],
                    ],
                ], 422);
            }

            $this->applyPublicNotificationPreference($ticket, $notificationChannel);
        }

        $authorId = $isAuthenticated
            ? (int) Auth::id()
            : (int) $ticket->user_id;

        $message = Message::create([
            'ticket_id' => $ticket->id,
            'author_id' => $authorId,
            'content' => $validated['content'],
            'is_internal' => $isInternal,
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

        // Ne notifier que si l'auteur n'est pas le user lui-meme.
        if (! $message->is_internal && $ticket->user && $message->author_id !== $ticket->user_id) {
            $magicLink = $ticket->issueMagicLink();
            $notification = new TicketMessageNotification($ticket, $message, $magicLink['url'] ?? null, [
                'template' => $validated['sms_template'] ?? null,
            ]);
            $ticketNotificationContext = $this->resolveTicketNotificationContext($ticket);
            $anonymousNotifiable = new AnonymousNotifiable();

            if (! empty($ticketNotificationContext['email'])) {
                $anonymousNotifiable->route('mail', $ticketNotificationContext['email']);
            }

            if (! empty($ticketNotificationContext['phone'])) {
                $anonymousNotifiable->route('smsfactory', $ticketNotificationContext['phone']);
            }

            $viaChannels = $notification->via($anonymousNotifiable);

            if (empty($viaChannels)) {
                $this->updateMessageDeliveryState(
                    $message,
                    'skipped',
                    $notificationChannel,
                    'Aucun canal de notification disponible pour ce client.'
                );
            } else {
                $resolvedChannel = $this->resolveDeliveryChannelFromViaEntry($viaChannels[0] ?? null) ?? $notificationChannel;

                $this->updateMessageDeliveryState($message, 'pending', $resolvedChannel);
                $anonymousNotifiable->notify($notification);
            }
        }

        if (! $message->is_internal && $message->author_id === $ticket->user_id) {
            $this->notifyAgentsForCustomerReply($ticket, $message);
        }

        return response()->json([
            'message' => [
                'id' => $message->id,
                'content' => $message->content,
                'is_internal' => $message->is_internal,
                'attachments' => $message->attachments ?? [],
                'created_at' => $message->created_at->toISOString(),
                'delivery' => [
                    'channel' => $message->notification_channel,
                    'status' => $message->notification_status,
                    'error' => $message->notification_error,
                    'sent_at' => $message->notified_at?->toISOString(),
                ],
                'author' => [
                    'id' => $message->author->id,
                    'name' => $message->author->first_name . ' ' . $message->author->last_name,
                    'email' => $message->author->email,
                ],
                'mention_notification' => $mentionNotification,
            ],
            'meta' => [
                'mention_warnings' => $mentionWarnings,
                'notification_channel' => $notificationChannel,
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
        $this->authorizeTicketAccess(request(), $ticket);

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
        $this->authorizeTicketAccess(request(), $ticket);

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
