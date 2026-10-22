<?php

namespace App\Support;

use App\Models\DeviceEvent;
use App\Models\Ticket;
use App\Models\TicketTimelineEvent;
use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * What a technician does on a ticket besides writing in the chat: status,
 * priority, taking the ticket, the technicians' follow-up (timeline events
 * and their actions) and the device follow-up. Shared by the ticket page and
 * the PC2 Diag application's API, so both write the same history.
 *
 * Refusals are thrown as validation errors: the ticket page gets them back
 * as form errors, the API as a 422.
 */
class TicketWorkflow
{
    public const STATUSES = ['open', 'in_progress', 'pending', 'resolved', 'closed'];

    public const OPEN_STATUSES = ['open', 'in_progress', 'pending'];

    public const PRIORITIES = ['low', 'medium', 'high'];

    public const DEVICE_EVENT_TYPES = ['battery_replaced', 'screen_replaced', 'storage_upgraded', 'diagnostic', 'maintenance', 'note'];

    public static function timelineEventRules(): array
    {
        return [
            'event_type' => ['required', 'string', Rule::in(TicketTimelineTemplateSettings::allowedEventTypes())],
            'summary' => 'required|string|max:500',
            'details' => 'nullable|string|max:3000',
            'happened_at' => 'nullable|date',
            'prerequisites' => 'nullable|array|max:20',
            'prerequisites.*.name' => 'required_with:prerequisites|string|max:160',
            'prerequisites.*.met' => 'nullable|boolean',
            'actions' => 'nullable|array|max:30',
            'actions.*.label' => 'required_with:actions|string|max:160',
            'actions.*.done' => 'nullable|boolean',
        ];
    }

    public static function deviceEventRules(): array
    {
        return [
            'event_type' => ['required', Rule::in(self::DEVICE_EVENT_TYPES)],
            'summary' => 'required|string|max:500',
            'details' => 'nullable|string|max:3000',
            'happened_at' => 'nullable|date',
        ];
    }

    public static function personName(?User $user): ?string
    {
        if (! $user) {
            return null;
        }

        $name = trim(($user->first_name ?? '').' '.($user->last_name ?? ''));

        return $name !== '' ? $name : $user->email;
    }

    /**
     * The technician is the agent to credit in the follow-up; without one
     * (a customer on their own ticket) nothing is logged.
     */
    public function changeStatus(Ticket $ticket, string $status, ?User $technician): bool
    {
        $previous = $ticket->status;
        $ticket->status = $status;
        $ticket->save();

        if ($previous === $ticket->status) {
            return false;
        }

        $this->log($ticket, $technician, 'status_changed', 'Statut du ticket modifie', [
            'before' => $previous,
            'after' => $ticket->status,
        ]);

        return true;
    }

    public function changePriority(Ticket $ticket, string $priority, ?User $technician): bool
    {
        $previous = $ticket->priority;
        $ticket->priority = $priority;
        $ticket->save();

        if ($previous === $ticket->priority) {
            return false;
        }

        $this->log($ticket, $technician, 'priority_changed', 'Priorite du ticket modifiee', [
            'before' => $previous,
            'after' => $ticket->priority,
        ]);

        return true;
    }

    /**
     * Takes an unassigned ticket. Returns false when the agent already had it.
     */
    public function assignToSelf(Ticket $ticket, User $agent): bool
    {
        if (! ($agent->agent?->is_active ?? false)) {
            throw ValidationException::withMessages(['assignee_id' => 'Votre compte agent est desactive.']);
        }

        $current = $ticket->assignee;

        if ($current && (int) $current->id !== (int) $agent->id) {
            throw ValidationException::withMessages(['assignee_id' => 'Ce ticket est deja attribue a un autre agent.']);
        }

        if ($current) {
            return false;
        }

        $ticket->assignee_id = $agent->id;
        $ticket->save();
        $ticket->setRelation('assignee', $agent);

        $this->log($ticket, $agent, 'assignee_changed', 'Agent attribue au ticket', [
            'before' => null,
            'after' => self::personName($agent),
        ]);

        return true;
    }

    /**
     * A follow-up event written by a technician, with its optional
     * prerequisites and actions; actions already done get their own
     * « Action realisee » event, as when they are ticked later.
     *
     * @param  array  $data  validated with timelineEventRules()
     */
    public function addTimelineEvent(Ticket $ticket, User $technician, array $data): TicketTimelineEvent
    {
        $details = [];
        if (! empty($data['details'])) {
            $details['note'] = $data['details'];
        }

        if (! empty($data['prerequisites']) && is_array($data['prerequisites'])) {
            $details['prerequisites'] = collect($data['prerequisites'])
                ->filter(fn ($p) => is_array($p) && ! empty(trim((string) ($p['name'] ?? ''))))
                ->map(fn ($p) => [
                    'name' => trim((string) ($p['name'] ?? '')),
                    'met' => (bool) ($p['met'] ?? false),
                ])
                ->values()
                ->all();
        }

        $happenedAt = $data['happened_at'] ?? now();
        $doneAt = $happenedAt instanceof \DateTimeInterface ? $happenedAt->format(DATE_ATOM) : (string) $happenedAt;

        $actions = collect($data['actions'] ?? [])
            ->filter(fn ($action) => is_array($action) && ! empty(trim((string) ($action['label'] ?? ''))))
            ->map(function ($action) use ($technician, $doneAt) {
                $isDone = (bool) ($action['done'] ?? false);

                return [
                    'id' => (string) Str::uuid(),
                    'label' => trim((string) ($action['label'] ?? '')),
                    'done' => $isDone,
                    'done_by_id' => $isDone ? $technician->id : null,
                    'done_by_name' => $isDone ? trim(($technician->first_name ?? '').' '.($technician->last_name ?? '')) : null,
                    'done_at' => $isDone ? $doneAt : null,
                ];
            })
            ->values();

        if ($actions->isNotEmpty()) {
            $details['actions'] = $actions->all();
        }

        $details['source'] = 'manual';

        $event = TicketTimelineEvent::create([
            'ticket_id' => $ticket->id,
            'technician_id' => $technician->id,
            'event_type' => $data['event_type'],
            'summary' => $data['summary'],
            'details' => $details,
            'happened_at' => $happenedAt,
        ]);

        $actions
            ->filter(fn (array $action) => $action['done'])
            ->each(fn (array $action) => TicketTimelineEvent::create([
                'ticket_id' => $ticket->id,
                'technician_id' => $technician->id,
                'event_type' => 'task_completed',
                'summary' => 'Action realisee: '.$action['label'],
                'details' => [
                    'source' => 'manual_action_completion',
                    'action_label' => $action['label'],
                    'parent_event_id' => $event->id,
                ],
                'happened_at' => $happenedAt,
            ]));

        return $event;
    }

    /**
     * Ticks or unticks an action of a follow-up event. Returns false when it
     * was already in that state.
     */
    public function setTimelineAction(Ticket $ticket, User $technician, int|string $eventId, int $index, bool $done): bool
    {
        $event = TicketTimelineEvent::where('ticket_id', $ticket->id)->findOrFail($eventId);

        $details = is_array($event->details) ? $event->details : [];
        $actions = collect($details['actions'] ?? [])->values();

        if (! $actions->has($index)) {
            throw ValidationException::withMessages(['action_index' => 'Action introuvable dans cet evenement.']);
        }

        $action = $actions->get($index);
        if (! is_array($action)) {
            throw ValidationException::withMessages(['action_index' => 'Action invalide.']);
        }

        if ((bool) ($action['done'] ?? false) === $done) {
            return false;
        }

        $label = trim((string) ($action['label'] ?? 'Action'));
        $action['id'] = (string) ($action['id'] ?? Str::uuid());
        $action['done'] = $done;
        $action['done_by_id'] = $done ? $technician->id : null;
        $action['done_by_name'] = $done ? trim(($technician->first_name ?? '').' '.($technician->last_name ?? '')) : null;
        $action['done_at'] = $done ? now()->toIso8601String() : null;

        $actions->put($index, $action);
        $details['actions'] = $actions->all();
        $event->details = $details;
        $event->save();

        TicketTimelineEvent::create([
            'ticket_id' => $ticket->id,
            'technician_id' => $technician->id,
            'event_type' => $done ? 'task_completed' : 'task_reopened',
            'summary' => ($done ? 'Action realisee: ' : 'Action repassee a faire: ').$label,
            'details' => [
                'source' => $done ? 'manual_action_completion' : 'manual_action_reopened',
                'action_id' => $action['id'],
                'action_label' => $label,
                'parent_event_id' => $event->id,
            ],
            'happened_at' => now(),
        ]);

        return true;
    }

    public function removeTimelineEvent(Ticket $ticket, User $technician, int|string $eventId, ?string $reason): void
    {
        $event = TicketTimelineEvent::withTrashed()->where('ticket_id', $ticket->id)->findOrFail($eventId);

        if ($event->trashed()) {
            throw ValidationException::withMessages(['event' => 'Cet evenement est deja retire.']);
        }

        $event->removed_by_id = $technician->id;
        $event->removed_reason = $reason;
        $event->removed_at = now();
        $event->save();
        $event->delete();
    }

    public function restoreTimelineEvent(Ticket $ticket, User $technician, int|string $eventId): void
    {
        $event = TicketTimelineEvent::withTrashed()->where('ticket_id', $ticket->id)->findOrFail($eventId);

        if (! $event->trashed()) {
            throw ValidationException::withMessages(['event' => 'Cet evenement est deja actif.']);
        }

        $event->restore();
        $event->restored_by_id = $technician->id;
        $event->restored_at = now();
        $event->save();
    }

    /**
     * Work done on the ticket's device (battery, screen…), kept in the
     * device's own history and noted in the ticket's follow-up.
     *
     * @param  array  $data  validated with deviceEventRules()
     */
    public function addDeviceEvent(Ticket $ticket, User $technician, array $data): DeviceEvent
    {
        if (! $ticket->device_id) {
            throw ValidationException::withMessages(['device' => 'Aucun appareil n\'est associe a ce ticket.']);
        }

        $deviceEvent = DeviceEvent::create([
            'device_id' => $ticket->device_id,
            'ticket_id' => $ticket->id,
            'technician_id' => $technician->id,
            'event_type' => $data['event_type'],
            'summary' => $data['summary'],
            'details' => ! empty($data['details']) ? ['note' => $data['details']] : null,
            'happened_at' => $data['happened_at'] ?? now(),
        ]);

        $this->log($ticket, $technician, 'device_event_added', 'Intervention enregistree sur appareil', [
            'device_event_id' => $deviceEvent->id,
            'event_type' => $deviceEvent->event_type,
            'summary' => $deviceEvent->summary,
            'happened_at' => $deviceEvent->happened_at?->toIso8601String(),
        ]);

        return $deviceEvent;
    }

    /**
     * Actions not done yet in the follow-up of open tickets, newest first.
     */
    public function pendingActions(): array
    {
        return TicketTimelineEvent::query()
            ->with([
                'ticket:id,title,status,priority,assignee_id',
                'ticket.assignee:id,first_name,last_name',
                'technician:id,first_name,last_name',
            ])
            ->whereHas('ticket', fn ($query) => $query->whereIn('status', self::OPEN_STATUSES))
            ->orderByDesc('happened_at')
            ->limit(1000)
            ->get()
            ->flatMap(function (TicketTimelineEvent $event) {
                $actions = collect(($event->details ?? [])['actions'] ?? [])->values();

                if ($actions->isEmpty() || ! $event->ticket) {
                    return [];
                }

                return $actions
                    ->map(function ($action, $index) use ($event) {
                        $label = is_array($action) ? trim((string) ($action['label'] ?? '')) : '';
                        if ($label === '' || (bool) ($action['done'] ?? false)) {
                            return null;
                        }

                        return [
                            'ticket' => [
                                'id' => $event->ticket->id,
                                'title' => $event->ticket->title,
                                'status' => $event->ticket->status,
                                'priority' => $event->ticket->priority,
                                'assignee_name' => $event->ticket->assignee
                                    ? trim(($event->ticket->assignee->first_name ?? '').' '.($event->ticket->assignee->last_name ?? ''))
                                    : null,
                            ],
                            'event' => [
                                'id' => $event->id,
                                'summary' => $event->summary,
                                'happened_at' => $event->happened_at?->toIso8601String(),
                                'technician_name' => $event->technician
                                    ? trim(($event->technician->first_name ?? '').' '.($event->technician->last_name ?? ''))
                                    : null,
                            ],
                            'action' => [
                                'index' => $index,
                                'id' => (string) ($action['id'] ?? ''),
                                'label' => $label,
                            ],
                        ];
                    })
                    ->filter()
                    ->values()
                    ->all();
            })
            ->values()
            ->all();
    }

    private function log(Ticket $ticket, ?User $technician, string $type, string $summary, array $details): void
    {
        if (! $technician) {
            return;
        }

        TicketTimelineEvent::create([
            'ticket_id' => $ticket->id,
            'technician_id' => $technician->id,
            'event_type' => $type,
            'summary' => $summary,
            'details' => $details,
            'happened_at' => now(),
        ]);
    }
}
