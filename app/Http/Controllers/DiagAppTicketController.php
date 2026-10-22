<?php

namespace App\Http\Controllers;

use App\Models\Commande;
use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\Devis;
use App\Models\Diagnostic;
use App\Models\Ticket;
use App\Models\TicketTimelineEvent;
use App\Models\User;
use App\Support\Sms\PhoneNumber;
use App\Support\Sms\SmsSettings;
use App\Support\TicketActionListSettings;
use App\Support\TicketTimelineTemplateSettings;
use App\Support\TicketWorkflow;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Tickets in the PC2 Diag application: list, full ticket (customer, device,
 * technicians' follow-up, chat and internal notes, files, diagnostics) and
 * the technician's actions on it. Chat and files go through the site's own
 * controllers, the rest through TicketWorkflow, so the history, the
 * notifications to the customer and the mentions are the same as on the site.
 *
 * Paths mirror the site's (/tickets/{id}/files/{file}/download…), so the
 * download paths the site hands out work as they are under /api/diag-app.
 */
class DiagAppTicketController extends Controller
{
    private const SCOPES = ['open', 'mine', 'unassigned', 'closed', 'all'];

    private const BROUGHT_ITEM_LABELS = [
        'computer' => 'Ordinateur',
        'charger' => 'Chargeur',
        'bag' => 'Sacoche',
        'phone' => 'Telephone',
        'case' => 'Coque',
        'mouse' => 'Souris',
    ];

    public function __construct(private TicketWorkflow $workflow)
    {
    }

    /**
     * Tickets by number, title, client or device. Without scope: the open
     * ones, as the send screen of the app expects.
     */
    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('q', ''));
        $scope = in_array($request->query('scope'), self::SCOPES, true) ? $request->query('scope') : 'open';
        $number = preg_match('/^#?(\d+)$/', $search, $match) ? (int) $match[1] : null;
        $me = (int) $request->user()->id;

        $tickets = Ticket::query()
            ->with(['user:id,first_name,last_name,email', 'device', 'assignee:id,first_name,last_name'])
            ->when($number, fn (Builder $query) => $query->whereKey($number))
            ->when(! $number, function (Builder $query) use ($scope, $me) {
                $query->standardOnly();
                match ($scope) {
                    'mine' => $query->whereIn('status', TicketWorkflow::OPEN_STATUSES)->where('assignee_id', $me),
                    'unassigned' => $query->whereIn('status', TicketWorkflow::OPEN_STATUSES)->whereNull('assignee_id'),
                    'closed' => $query->whereIn('status', ['resolved', 'closed']),
                    'all' => null,
                    default => $query->whereIn('status', TicketWorkflow::OPEN_STATUSES),
                };
            })
            ->when(! $number && $search !== '', function (Builder $query) use ($search) {
                $like = '%'.str_replace(['%', '_'], ['\%', '\_'], $search).'%';
                $query->where(function (Builder $query) use ($like) {
                    $query->where('title', 'like', $like)
                        ->orWhereHas('user', fn (Builder $user) => $user
                            ->where('first_name', 'like', $like)
                            ->orWhere('last_name', 'like', $like)
                            ->orWhere('email', 'like', $like)
                            ->orWhere('phone', 'like', $like))
                        ->orWhereHas('device', fn (Builder $device) => $device
                            ->where('serial_number', 'like', $like)
                            ->orWhere('brand', 'like', $like)
                            ->orWhere('model', 'like', $like));
                });
            })
            ->orderByDesc('updated_at')
            ->limit($scope === 'all' || $scope === 'closed' ? 100 : 200)
            ->get();

        $pending = $this->pendingCounts($tickets->pluck('id')->all());

        return response()->json([
            'tickets' => $tickets->map(fn (Ticket $ticket) => $this->summary($ticket, $me) + [
                'pending_actions' => $pending[$ticket->id] ?? 0,
            ])->values(),
        ]);
    }

    /**
     * Everything the ticket page shows to a technician, in one call.
     */
    public function show(Request $request, Ticket $ticket): JsonResponse
    {
        $ticket->load(['user.company', 'assignee', 'device', 'categories']);
        $me = $request->user();

        $messages = app(MessageController::class)->index($ticket->id)->getData(true);
        $files = app(TicketFileController::class)->index($request, $ticket)->getData(true);

        return response()->json([
            'ticket' => $this->summary($ticket, (int) $me->id) + $this->details($ticket),
            'timeline' => $this->timeline($ticket),
            'device_events' => $this->deviceEvents($ticket),
            'messages' => $messages['messages'] ?? [],
            'files' => $files['files'] ?? [],
            'file_limits' => $files['limits'] ?? null,
            'diagnostics' => $this->diagnostics($ticket),
            'commandes' => $this->commandes($ticket),
            'devis' => $this->devis($ticket),
            'options' => $this->options($ticket),
        ]);
    }

    public function todos(): JsonResponse
    {
        return response()->json(['todos' => $this->workflow->pendingActions()]);
    }

    public function updateStatus(Request $request, Ticket $ticket): JsonResponse
    {
        $data = $request->validate(['status' => ['required', Rule::in(TicketWorkflow::STATUSES)]]);
        $this->workflow->changeStatus($ticket, $data['status'], $request->user());

        return $this->ok($ticket, 'Statut mis à jour.');
    }

    public function updatePriority(Request $request, Ticket $ticket): JsonResponse
    {
        $data = $request->validate(['priority' => ['required', Rule::in(TicketWorkflow::PRIORITIES)]]);
        $this->workflow->changePriority($ticket, $data['priority'], $request->user());

        return $this->ok($ticket, 'Priorité mise à jour.');
    }

    public function assignToMe(Request $request, Ticket $ticket): JsonResponse
    {
        $this->workflow->assignToSelf($ticket, $request->user());

        return $this->ok($ticket, 'Ticket attribué.');
    }

    public function storeTimelineEvent(Request $request, Ticket $ticket): JsonResponse
    {
        $event = $this->workflow->addTimelineEvent($ticket, $request->user(), $request->validate(TicketWorkflow::timelineEventRules()));

        return $this->ok($ticket, 'Événement ajouté au suivi.', ['event_id' => $event->id], 201);
    }

    public function updateTimelineAction(Request $request, Ticket $ticket, int $event): JsonResponse
    {
        $data = $request->validate([
            'action_index' => 'required|integer|min:0|max:200',
            'done' => 'required|boolean',
        ]);
        $done = (bool) $data['done'];
        $this->workflow->setTimelineAction($ticket, $request->user(), $event, (int) $data['action_index'], $done);

        return $this->ok($ticket, $done ? 'Action marquée comme réalisée.' : 'Action repassée à faire.');
    }

    public function removeTimelineEvent(Request $request, Ticket $ticket, int $event): JsonResponse
    {
        $data = $request->validate(['reason' => 'nullable|string|max:500']);
        $this->workflow->removeTimelineEvent($ticket, $request->user(), $event, $data['reason'] ?? null);

        return $this->ok($ticket, 'Événement retiré.');
    }

    public function restoreTimelineEvent(Request $request, Ticket $ticket, int $event): JsonResponse
    {
        $this->workflow->restoreTimelineEvent($ticket, $request->user(), $event);

        return $this->ok($ticket, 'Événement restauré.');
    }

    public function storeDeviceEvent(Request $request, Ticket $ticket): JsonResponse
    {
        $this->workflow->addDeviceEvent($ticket, $request->user(), $request->validate(TicketWorkflow::deviceEventRules()));

        return $this->ok($ticket, 'Intervention ajoutée au suivi de l\'appareil.', [], 201);
    }

    private function ok(Ticket $ticket, string $message, array $extra = [], int $status = 200): JsonResponse
    {
        return response()->json(['ok' => true, 'message' => $message, 'ticket_id' => $ticket->id] + $extra, $status);
    }

    private function summary(Ticket $ticket, int $me): array
    {
        return [
            'id' => $ticket->id,
            'title' => $ticket->title,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'client' => $ticket->user ? trim(($ticket->user->first_name ?? '').' '.($ticket->user->last_name ?? '')) : null,
            'device' => $ticket->device?->display_name,
            'assignee' => $ticket->assignee ? ['id' => $ticket->assignee->id, 'name' => TicketWorkflow::personName($ticket->assignee)] : null,
            'mine' => (int) $ticket->assignee_id === $me,
            'created_at' => $ticket->created_at?->toIso8601String(),
            'updated_at' => $ticket->updated_at?->toIso8601String(),
            'url' => route('tickets.show', $ticket),
        ];
    }

    private function details(Ticket $ticket): array
    {
        $brought = is_array($ticket->brought_items) ? $ticket->brought_items : [];
        $other = $brought['other'] ?? [];
        $other = array_values(array_filter(array_map('trim', array_map('strval', is_array($other) ? $other : [$other]))));
        $items = collect($brought['items'] ?? [])
            ->filter(fn ($item) => is_string($item) && $item !== 'other')
            ->map(fn (string $item) => self::BROUGHT_ITEM_LABELS[$item] ?? $item)
            ->concat($other)
            ->values()
            ->all();

        $user = $ticket->user;
        $device = $ticket->device;

        return [
            'message' => $ticket->message,
            'brought_items' => $items,
            'device_password' => $ticket->device_password ?: $device?->access_password,
            'no_device_password' => (bool) $ticket->no_device_password || (bool) $device?->no_access_password,
            'notify_by' => $ticket->notify_by,
            'invoice_id' => $ticket->invoice_id,
            'hiboutik_quote_number' => $ticket->hiboutik_quote_number,
            'is_locked' => (bool) $ticket->is_locked,
            'categories' => $ticket->categories->pluck('name')->values()->all(),
            'customer' => $user ? [
                'id' => $user->id,
                'name' => TicketWorkflow::personName($user),
                'company' => $user->company?->name,
                'email' => $ticket->contact_email ?: $user->email,
                'phone' => $ticket->contact_phone ?: $user->phone,
                'address' => $user->address,
                'internal_note' => $user->internal_note,
            ] : null,
            'device_info' => $device ? [
                'id' => $device->id,
                'name' => $device->display_name,
                'type' => $device->device_type,
                'brand' => $device->brand,
                'model' => $device->model,
                'serial_number' => $device->serial_number,
                'asset_tag' => $device->asset_tag,
                'purchase_date' => $device->purchase_date?->toDateString(),
                'warranty_end_date' => $device->warranty_end_date?->toDateString(),
                'url' => route('devices.show', $device),
            ] : null,
        ];
    }

    private function timeline(Ticket $ticket): array
    {
        $person = fn (?User $user) => $user ? ['id' => $user->id, 'name' => TicketWorkflow::personName($user)] : null;

        return $ticket->timelineEvents()
            ->withTrashed()
            ->with(['technician:id,first_name,last_name,email', 'removedBy:id,first_name,last_name,email', 'restoredBy:id,first_name,last_name,email'])
            ->orderByDesc('happened_at')
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->map(fn (TicketTimelineEvent $event) => [
                'id' => $event->id,
                'event_type' => $event->event_type,
                'summary' => $event->summary,
                'details' => $event->details,
                'happened_at' => $event->happened_at?->toIso8601String(),
                'technician' => $person($event->technician),
                'is_removed' => $event->trashed(),
                'removed_at' => $event->removed_at?->toIso8601String(),
                'removed_reason' => $event->removed_reason,
                'removed_by' => $person($event->removedBy),
                'restored_at' => $event->restored_at?->toIso8601String(),
                'restored_by' => $person($event->restoredBy),
            ])
            ->all();
    }

    private function deviceEvents(Ticket $ticket): array
    {
        if (! $ticket->device_id) {
            return [];
        }

        return DeviceEvent::query()
            ->with('technician:id,first_name,last_name,email')
            ->where('device_id', $ticket->device_id)
            ->orderByDesc('happened_at')
            ->limit(100)
            ->get()
            ->map(fn (DeviceEvent $event) => [
                'id' => $event->id,
                'event_type' => $event->event_type,
                'summary' => $event->summary,
                'note' => is_array($event->details) ? ($event->details['note'] ?? null) : null,
                'happened_at' => $event->happened_at?->toIso8601String(),
                'ticket_id' => $event->ticket_id,
                'technician' => TicketWorkflow::personName($event->technician),
            ])
            ->all();
    }

    private function diagnostics(Ticket $ticket): array
    {
        return $ticket->diagnostics()
            ->with('technician:id,first_name,last_name,email')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (Diagnostic $diagnostic) => [
                'id' => $diagnostic->id,
                'machine_name' => $diagnostic->machine_name,
                'overall' => $diagnostic->overall,
                'overall_label' => $diagnostic->overall_label,
                'viability_score' => $diagnostic->viability_score,
                'viability_label' => $diagnostic->viability_label,
                'client_visible' => (bool) $diagnostic->client_visible,
                'created_at' => $diagnostic->created_at?->toIso8601String(),
                'technician' => TicketWorkflow::personName($diagnostic->technician),
                'report_url' => route('tickets.diagnostics.show', [$ticket, $diagnostic]),
                'client_report_path' => "/tickets/{$ticket->id}/diagnostics/{$diagnostic->id}/client-report",
            ])
            ->all();
    }

    private function commandes(Ticket $ticket): array
    {
        return Commande::query()
            ->where('ticket_id', $ticket->id)
            ->latest()
            ->get()
            ->map(fn (Commande $commande) => [
                'id' => $commande->id,
                'nom' => $commande->nom,
                'fournisseur' => $commande->fournisseur,
                'command_number' => $commande->command_number,
                'statut' => $commande->statut,
                'created_at' => $commande->created_at?->toIso8601String(),
            ])
            ->all();
    }

    private function devis(Ticket $ticket): array
    {
        return Devis::query()
            ->where('ticket_id', $ticket->id)
            ->latest()
            ->get()
            ->map(fn (Devis $devis) => [
                'id' => $devis->id,
                'title' => $devis->title,
                'status' => $devis->status,
                'hiboutik_id' => $devis->hiboutik_id,
                'created_at' => $devis->created_at?->toIso8601String(),
                'url' => route('devis.show', $devis),
            ])
            ->all();
    }

    /**
     * Choices offered by the forms of the ticket: event templates and task
     * lists set up on the site, the agents to @mention and the channels
     * through which a reply reaches the customer.
     */
    private function options(Ticket $ticket): array
    {
        $sms = SmsSettings::load();
        $email = trim((string) ($ticket->contact_email ?: ($ticket->user?->email ?? '')));
        $phone = trim((string) ($ticket->contact_phone ?: ($ticket->user?->phone ?? '')));
        $channels = [];
        if ($email !== '') {
            $channels[] = 'Email';
        }
        if ($phone !== '' && SmsSettings::isEnabled($sms) && PhoneNumber::normalize($phone) !== null) {
            $channels[] = 'SMS';
        }
        $default = in_array($ticket->notify_by, $channels, true) ? $ticket->notify_by : ($channels[0] ?? 'None');

        return [
            'event_types' => TicketTimelineTemplateSettings::load()['templates'],
            'action_lists' => collect(TicketActionListSettings::load()['lists'])
                ->filter(fn (array $list) => ! empty($list['tasks']))
                ->values()
                ->all(),
            'agents' => User::query()
                ->whereHas('agent', fn ($query) => $query->where('is_active', true))
                ->orderBy('first_name')
                ->get(['id', 'first_name', 'last_name'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => TicketWorkflow::personName($user),
                    'mention' => Str::of($user->first_name.$user->last_name)->ascii()->lower()->replaceMatches('/[^a-z0-9]/', '')->toString(),
                ])
                ->values()
                ->all(),
            'notification' => [
                'channels' => $channels,
                'default' => $default,
                'email' => $email !== '' ? $email : null,
                'phone' => $phone !== '' ? $phone : null,
            ],
            'sms_templates' => collect($sms['templates'] ?? [])
                ->filter(fn ($template) => is_array($template) && trim((string) ($template['content'] ?? '')) !== '')
                ->map(fn (array $template) => [
                    'title' => (string) ($template['title'] ?? ''),
                    'content' => (string) $template['content'],
                ])
                ->values()
                ->all(),
            'sms_max_length' => (int) ($sms['max_length'] ?? SmsSettings::DEFAULT_LENGTH),
        ];
    }

    /**
     * @param  array<int, int>  $ticketIds
     * @return array<int, int> actions still to do, by ticket
     */
    private function pendingCounts(array $ticketIds): array
    {
        if (empty($ticketIds)) {
            return [];
        }

        $counts = [];
        TicketTimelineEvent::query()
            ->whereIn('ticket_id', $ticketIds)
            ->get(['ticket_id', 'details'])
            ->each(function (TicketTimelineEvent $event) use (&$counts) {
                $todo = collect(($event->details ?? [])['actions'] ?? [])
                    ->filter(fn ($action) => is_array($action) && ! ($action['done'] ?? false) && trim((string) ($action['label'] ?? '')) !== '')
                    ->count();
                if ($todo) {
                    $counts[$event->ticket_id] = ($counts[$event->ticket_id] ?? 0) + $todo;
                }
            });

        return $counts;
    }
}
