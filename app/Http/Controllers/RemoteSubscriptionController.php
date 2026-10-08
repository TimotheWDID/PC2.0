<?php

namespace App\Http\Controllers;

use App\Models\Device;
use App\Models\RemoteIntervention;
use App\Models\RemoteSubscription;
use App\Models\RemoteTimePurchase;
use App\Models\Ticket;
use App\Models\User;
use App\Notifications\RemoteSubscriptionExpiringNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

class RemoteSubscriptionController extends Controller
{
    public function index(Request $request)
    {
        $query = RemoteSubscription::query()
            ->with('user:id,first_name,last_name,email')
            ->withSum('interventions', 'duration_minutes')
            ->withSum('timePurchases', 'minutes')
            ->withCount('devices as linked_devices_count')
            ->withCount('interventions')
            ->withMax('interventions', 'performed_at');

        $search = trim((string) $request->query('q', ''));
        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('plan', 'like', '%'.$search.'%')
                    ->orWhere('ninjaone_reference', 'like', '%'.$search.'%')
                    ->orWhereHas('user', function ($userQuery) use ($search) {
                        $userQuery->where('first_name', 'like', '%'.$search.'%')
                            ->orWhere('last_name', 'like', '%'.$search.'%')
                            ->orWhere('email', 'like', '%'.$search.'%');
                    });
            });
        }

        $status = trim((string) $request->query('status', ''));
        if (in_array($status, RemoteSubscription::STATUSES, true)) {
            $query->where('status', $status);
        }

        $subscriptions = $query
            ->orderByRaw("CASE status WHEN 'active' THEN 1 WHEN 'suspended' THEN 2 ELSE 3 END")
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (RemoteSubscription $subscription) => $this->present($subscription))
            ->values();

        return Inertia::render('RemoteSubscriptions/Index', [
            'subscriptions' => $subscriptions,
            'plans' => RemoteSubscription::PLANS,
            'users' => User::query()
                ->select('id', 'first_name', 'last_name', 'email')
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get(),
            'filters' => [
                'q' => $search,
                'status' => $status,
            ],
        ]);
    }

    public function store(Request $request)
    {
        $subscription = RemoteSubscription::create($this->validateSubscription($request, true));

        return redirect()
            ->route('remote-subscriptions.show', $subscription)
            ->with('success', 'Abonnement créé.');
    }

    public function show(Request $request, RemoteSubscription $remoteSubscription)
    {
        // Opening the subscription settles its expiry alert for this agent
        $request->user()->unreadNotifications()
            ->where('type', RemoteSubscriptionExpiringNotification::class)
            ->where('data->remote_subscription_id', $remoteSubscription->id)
            ->update(['read_at' => now()]);

        $remoteSubscription
            ->load('user:id,first_name,last_name,email,phone')
            ->loadSum('interventions', 'duration_minutes')
            ->loadSum('timePurchases', 'minutes')
            ->loadCount('devices as linked_devices_count')
            ->loadCount('interventions')
            ->loadMax('interventions', 'performed_at');

        $interventions = $remoteSubscription->interventions()
            ->with(['technician:id,first_name,last_name', 'ticket:id,title'])
            ->orderByDesc('performed_at')
            ->orderByDesc('id')
            ->get()
            ->map(fn (RemoteIntervention $intervention) => [
                'id' => $intervention->id,
                'performed_at' => $intervention->performed_at?->toIso8601String(),
                'duration_minutes' => $intervention->duration_minutes,
                'description' => $intervention->description,
                'technician' => $intervention->technician?->name,
                'ticket' => $intervention->ticket ? [
                    'id' => $intervention->ticket->id,
                    'title' => $intervention->ticket->title,
                ] : null,
            ])
            ->values();

        $tickets = Ticket::query()
            ->standardOnly()
            ->where('user_id', $remoteSubscription->user_id)
            ->select('id', 'title', 'status')
            ->latest()
            ->limit(100)
            ->get();

        $timePurchases = $remoteSubscription->timePurchases()
            ->with('recorder:id,first_name,last_name')
            ->orderByDesc('purchased_on')
            ->orderByDesc('id')
            ->get()
            ->map(fn (RemoteTimePurchase $purchase) => [
                'id' => $purchase->id,
                'purchased_on' => $purchase->purchased_on?->toDateString(),
                'minutes' => $purchase->minutes,
                'price' => $purchase->price,
                'note' => $purchase->note,
                'recorded_by' => $purchase->recorder?->name,
            ])
            ->values();

        $presentDevice = fn (Device $device) => [
            'id' => $device->id,
            'display_name' => $device->display_name,
            'device_type' => $device->device_type,
            'asset_tag' => $device->asset_tag,
            'status' => $device->status,
            'ninjaone_url' => $device->ninjaone_url,
        ];

        $linkedDevices = $remoteSubscription->devices()->orderBy('brand')->orderBy('model')->get();

        $availableDevices = Device::query()
            ->where('user_id', $remoteSubscription->user_id)
            ->whereNotIn('id', $linkedDevices->pluck('id'))
            ->orderBy('brand')
            ->orderBy('model')
            ->get();

        return Inertia::render('RemoteSubscriptions/Show', [
            'devices' => $linkedDevices->map($presentDevice)->values(),
            'availableDevices' => $availableDevices->map($presentDevice)->values(),
            'timePurchases' => $timePurchases,
            'subscription' => $this->present($remoteSubscription),
            'interventions' => $interventions,
            'tickets' => $tickets,
            'plans' => RemoteSubscription::PLANS,
        ]);
    }

    public function update(Request $request, RemoteSubscription $remoteSubscription)
    {
        $remoteSubscription->update($this->validateSubscription($request, false));

        return back()->with('success', 'Abonnement mis à jour.');
    }

    public function destroy(RemoteSubscription $remoteSubscription)
    {
        $remoteSubscription->delete();

        return redirect()
            ->route('remote-subscriptions.index')
            ->with('success', 'Abonnement supprimé.');
    }

    public function storeIntervention(Request $request, RemoteSubscription $remoteSubscription)
    {
        $validated = $request->validate([
            'performed_at' => ['required', 'date'],
            'duration_minutes' => ['required', 'integer', 'min:1', 'max:1440'],
            'description' => ['required', 'string', 'max:5000'],
            'ticket_id' => [
                'nullable',
                'integer',
                Rule::exists(config('laravel_ticket.table_names.tickets', 'tickets'), 'id')
                    ->where('user_id', $remoteSubscription->user_id),
            ],
        ]);

        $remoteSubscription->interventions()->create([
            ...$validated,
            'performed_at' => Carbon::parse($validated['performed_at'])->utc(),
            'technician_id' => $request->user()->id,
        ]);

        return back()->with('success', 'Intervention enregistrée.');
    }

    public function destroyIntervention(RemoteSubscription $remoteSubscription, RemoteIntervention $intervention)
    {
        abort_unless((int) $intervention->remote_subscription_id === (int) $remoteSubscription->id, 404);

        $intervention->delete();

        return back()->with('success', 'Intervention supprimée.');
    }

    public function attachDevice(Request $request, RemoteSubscription $remoteSubscription)
    {
        $validated = $request->validate([
            'device_id' => [
                'required',
                'integer',
                Rule::exists('devices', 'id')->where('user_id', $remoteSubscription->user_id),
            ],
        ]);

        $remoteSubscription->devices()->syncWithoutDetaching([$validated['device_id']]);

        return back()->with('success', 'Appareil lié à l\'abonnement.');
    }

    public function detachDevice(RemoteSubscription $remoteSubscription, Device $device)
    {
        $remoteSubscription->devices()->detach($device->id);

        return back()->with('success', 'Appareil retiré de l\'abonnement.');
    }

    public function storeTimePurchase(Request $request, RemoteSubscription $remoteSubscription)
    {
        $validated = $request->validate([
            'purchased_on' => ['required', 'date'],
            'minutes' => ['required', 'integer', 'min:1', 'max:100000'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);

        $remoteSubscription->timePurchases()->create([
            ...$validated,
            'recorded_by' => $request->user()->id,
        ]);

        return back()->with('success', 'Heures ajoutées.');
    }

    public function destroyTimePurchase(RemoteSubscription $remoteSubscription, RemoteTimePurchase $timePurchase)
    {
        abort_unless((int) $timePurchase->remote_subscription_id === (int) $remoteSubscription->id, 404);

        $timePurchase->delete();

        return back()->with('success', 'Achat d\'heures supprimé.');
    }

    /**
     * @return array<string, mixed>
     */
    private function validateSubscription(Request $request, bool $creating): array
    {
        return $request->validate([
            'user_id' => $creating ? ['required', 'integer', 'exists:users,id'] : ['prohibited'],
            'plan' => ['required', 'string', 'max:255'],
            'status' => ['required', Rule::in(RemoteSubscription::STATUSES)],
            'started_on' => ['required', 'date'],
            'ends_on' => ['nullable', 'date', 'after_or_equal:started_on'],
            'included_minutes' => ['required', 'integer', 'min:0', 'max:1000000'],
            'price' => ['nullable', 'numeric', 'min:0', 'max:99999999'],
            'devices_count' => ['nullable', 'integer', 'min:0', 'max:100000'],
            'ninjaone_reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:5000'],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function present(RemoteSubscription $subscription): array
    {
        $used = (int) ($subscription->interventions_sum_duration_minutes ?? 0);
        $purchased = (int) ($subscription->time_purchases_sum_minutes ?? 0);
        $total = $subscription->included_minutes + $purchased;

        return [
            'id' => $subscription->id,
            'plan' => $subscription->plan,
            'status' => $subscription->status,
            'started_on' => $subscription->started_on?->toDateString(),
            'ends_on' => $subscription->ends_on?->toDateString(),
            'is_expired' => $subscription->isExpired(),
            'days_left' => $subscription->daysLeft(),
            'included_minutes' => $subscription->included_minutes,
            'purchased_minutes' => $purchased,
            'total_minutes' => $total,
            'used_minutes' => $used,
            'remaining_minutes' => $total - $used,
            'price' => $subscription->price,
            'devices_count' => $subscription->devices_count,
            'linked_devices_count' => (int) ($subscription->linked_devices_count ?? 0),
            'ninjaone_reference' => $subscription->ninjaone_reference,
            'notes' => $subscription->notes,
            'interventions_count' => (int) ($subscription->interventions_count ?? 0),
            'last_intervention_at' => $subscription->interventions_max_performed_at,
            'user' => $subscription->user ? [
                'id' => $subscription->user->id,
                'name' => $subscription->user->name,
                'email' => $subscription->user->email,
                'phone' => $subscription->user->phone,
            ] : null,
        ];
    }
}
