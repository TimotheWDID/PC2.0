<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Ticket;
use App\Models\Commande;
use App\Models\Device;
use App\Models\DeviceEvent;
use App\Models\TicketTimelineEvent;
use Coderflex\LaravelTicket\Models\Category;
use Illuminate\Support\Facades\Auth;
use App\Support\TicketLabelSettings;
use App\Support\TicketTimelineTemplateSettings;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TicketController extends Controller
{
    private const SPECIAL_TICKET_CATEGORIES = [
        'bug' => 'Bug',
        'improvement' => 'Amelioration',
    ];

    private const TRACKED_TICKET_FIELDS = [
        'title',
        'message',
        'status',
        'priority',
        'assignee_id',
        'device_id',
        'invoice_id',
        'notify_by',
        'contact_phone',
        'contact_email',
        'is_resolved',
        'is_locked',
    ];

    private const TRACKED_FIELD_LABELS = [
        'title' => 'Titre',
        'message' => 'Description',
        'status' => 'Statut',
        'priority' => 'Priorite',
        'assignee_id' => 'Agent assigne',
        'device_id' => 'Appareil',
        'invoice_id' => 'Numero de facture',
        'notify_by' => 'Notification',
        'contact_phone' => 'Telephone de contact',
        'contact_email' => 'Email de contact',
        'is_resolved' => 'Ticket resolu',
        'is_locked' => 'Ticket verrouille',
    ];

    private function supportsTicketKind(): bool
    {
        static $supports = null;

        if ($supports !== null) {
            return $supports;
        }

        $tableName = config('laravel_ticket.table_names.tickets', 'tickets');
        $supports = Schema::hasColumn($tableName, 'ticket_kind');

        return $supports;
    }

    private function getSpecialCategoryIds(): array
    {
        $names = array_values(self::SPECIAL_TICKET_CATEGORIES);

        return Category::query()
            ->whereIn('name', $names)
            ->pluck('id')
            ->map(fn($id) => (int) $id)
            ->all();
    }

    private function getOrCreateSpecialCategoryId(string $ticketKind): ?int
    {
        $name = self::SPECIAL_TICKET_CATEGORIES[$ticketKind] ?? null;

        if (!$name) {
            return null;
        }

        $category = Category::query()->firstOrCreate(
            ['name' => $name],
            [
                'slug' => Str::slug($name),
                'is_visible' => true,
            ]
        );

        return (int) $category->id;
    }

    private function inferTicketKindFromCategoryName(?string $categoryName): string
    {
        $normalized = Str::lower((string) $categoryName);

        if ($normalized === Str::lower(self::SPECIAL_TICKET_CATEGORIES['bug'])) {
            return 'bug';
        }

        if ($normalized === Str::lower(self::SPECIAL_TICKET_CATEGORIES['improvement'])) {
            return 'improvement';
        }

        return 'standard';
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

    private function isAgentContext(): bool
    {
        $user = Auth::user();

        if (! $user || ! $user->agent) {
            return false;
        }

        $previewAsNonAgent = (bool) request()->session()->get('preview_as_non_agent', false);

        return ! $previewAsNonAgent;
    }

    public function specialIndex(Request $request)
    {
        $request->merge([
            'special_only' => 1,
            'show_all' => 1,
        ]);

        return $this->index($request);
    }

    public function specialCreate(Request $request)
    {
        $request->merge([
            'special_only' => 1,
        ]);

        return $this->create($request);
    }

    private function formatTimelineValue(string $field, mixed $value): mixed
    {
        if ($field === 'is_resolved' || $field === 'is_locked') {
            return (bool) $value;
        }

        if ($field === 'assignee_id') {
            if (empty($value)) {
                return null;
            }

            $assignee = \App\Models\User::find($value);

            return $assignee ? $assignee->first_name . ' ' . $assignee->last_name : (string) $value;
        }

        if ($field === 'device_id') {
            if (empty($value)) {
                return null;
            }

            $device = Device::find($value);
            if (!$device) {
                return (string) $value;
            }

            return trim(($device->brand ?? '') . ' ' . ($device->model ?? '')) ?: ucfirst((string) $device->device_type);
        }

        return $value;
    }

    private function logTechnicianTimeline(Ticket $ticket, string $eventType, string $summary, array $details = []): void
    {
        $user = Auth::user();

        if (!$user || !$this->isAgentContext()) {
            return;
        }

        TicketTimelineEvent::create([
            'ticket_id' => $ticket->id,
            'technician_id' => $user->id,
            'event_type' => $eventType,
            'summary' => $summary,
            'details' => !empty($details) ? $details : null,
            'happened_at' => now(),
        ]);
    }

    private function ensureAgentOrAbort(): \App\Models\User
    {
        $user = Auth::user();

        if (!$user || !$this->isAgentContext()) {
            abort(403, 'Acces reserve aux techniciens.');
        }

        return $user;
    }

    private function serializeDevice(?Device $device): ?array
    {
        if (!$device) {
            return null;
        }

        return [
            'id' => $device->id,
            'device_type' => $device->device_type,
            'brand' => $device->brand,
            'model' => $device->model,
            'serial_number' => $device->serial_number,
            'asset_tag' => $device->asset_tag,
            'purchase_date' => $device->purchase_date?->toDateString(),
            'warranty_end_date' => $device->warranty_end_date?->toDateString(),
            'status' => $device->status,
            'display_name' => $device->display_name,
        ];
    }
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        $query = Ticket::query()->with(['user', 'category', 'device', 'assignee']);
        $user = Auth::user();
        $supportsTicketKind = $this->supportsTicketKind();
        $specialCategoryIds = $this->getSpecialCategoryIds();
        $selectedUserId = $request->integer('user_id');
        $selectedDeviceId = $request->integer('device_id');
        $showAllStatuses = $request->boolean('show_all');
        $specialOnly = $request->boolean('special_only');

        if (!$user) {
            abort(403, 'Acces non autorise.');
        }

        $isAgent = $this->isAgentContext();

        if (!$isAgent) {
            $query->where('user_id', $user->id);
        } elseif (!empty($selectedUserId)) {
            $query->where('user_id', $selectedUserId);
        }

        if ($specialOnly) {
            if ($supportsTicketKind) {
                $query->whereIn('ticket_kind', ['bug', 'improvement']);
            } else {
                if (!empty($specialCategoryIds)) {
                    $query->whereIn('category_id', $specialCategoryIds);
                } else {
                    $query->whereRaw('1 = 0');
                }
            }
        } else {
            if ($supportsTicketKind) {
                $query->where(function ($q) {
                    $q->whereNull('ticket_kind')->orWhere('ticket_kind', 'standard');
                });
            } elseif (!empty($specialCategoryIds)) {
                $query->where(function ($q) use ($specialCategoryIds) {
                    $q->whereNull('category_id')->orWhereNotIn('category_id', $specialCategoryIds);
                });
            }
        }

        // Filter by status if provided
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if (!empty($selectedDeviceId)) {
            $query->where('device_id', $selectedDeviceId);
        }

        $deviceQuery = trim((string) $request->query('device_query', ''));
        if ($deviceQuery !== '') {
            $query->whereHas('device', function ($q) use ($deviceQuery) {
                $q->where('serial_number', 'like', '%' . $deviceQuery . '%')
                    ->orWhere('asset_tag', 'like', '%' . $deviceQuery . '%')
                    ->orWhere('brand', 'like', '%' . $deviceQuery . '%')
                    ->orWhere('model', 'like', '%' . $deviceQuery . '%');
            });
        }

        $rawTickets = $query->get();

        $userDeviceMap = Device::query()
            ->whereIn('user_id', $rawTickets->pluck('user_id')->filter()->unique()->values())
            ->orderByDesc('id')
            ->get()
            ->groupBy('user_id');

        $linkedCommandes = Commande::select('id', 'ticket_id', 'nom')
            ->whereNotNull('ticket_id')
            ->whereIn('ticket_id', $rawTickets->pluck('id'))
            ->orderByDesc('created_at')
            ->get()
            ->groupBy('ticket_id')
            ->map(fn($group) => $group->first());

        $tickets = $rawTickets->map(function ($t) use ($linkedCommandes, $supportsTicketKind, $userDeviceMap) {
            $commande = $linkedCommandes->get($t->id);
            $userDevices = $userDeviceMap->get($t->user_id, collect());

            return [
                'id' => $t->id,
                'title' => $t->title ?? null,
                'ticket_kind' => $supportsTicketKind
                    ? ($t->ticket_kind ?? 'standard')
                    : $this->inferTicketKindFromCategoryName($t->category?->name),
                'status' => $t->status ?? null,
                'created_at' => $t->created_at ? $t->created_at->toDateTimeString() : null,
                'user' => $t->user ? [
                    'id' => $t->user->id,
                    'name' => $t->user->first_name . ' ' . $t->user->last_name,
                ] : null,
                'assignee' => $t->assignee ? [
                    'id' => $t->assignee->id,
                    'name' => $t->assignee->first_name . ' ' . $t->assignee->last_name,
                ] : null,
                'device' => $t->device ? [
                    'id' => $t->device->id,
                    'display_name' => $t->device->display_name,
                    'serial_number' => $t->device->serial_number,
                    'asset_tag' => $t->device->asset_tag,
                ] : null,
                'available_devices' => $userDevices->map(fn(Device $device) => [
                    'id' => $device->id,
                    'display_name' => $device->display_name,
                    'serial_number' => $device->serial_number,
                    'asset_tag' => $device->asset_tag,
                ])->values(),
                'commande' => $commande ? [
                    'id' => $commande->id,
                    'nom' => $commande->nom,
                ] : null,
            ];
        });

        $filteredUser = null;
        if (!empty($selectedUserId) && $isAgent) {
            $selectedUser = \App\Models\User::find($selectedUserId);
            if ($selectedUser) {
                $filteredUser = [
                    'id' => $selectedUser->id,
                    'name' => trim(($selectedUser->first_name ?? '') . ' ' . ($selectedUser->last_name ?? '')),
                ];
            }
        }

        $linkableCommandes = Commande::with('user:id,first_name,last_name,email')
            ->select('id', 'ticket_id', 'nom', 'fournisseur', 'command_number', 'user_id')
            ->whereNull('ticket_id')
            ->orderByDesc('created_at')
            ->limit(300)
            ->get()
            ->map(function ($commande) {
                return [
                    'id' => $commande->id,
                    'nom' => $commande->nom,
                    'fournisseur' => $commande->fournisseur,
                    'command_number' => $commande->command_number,
                    'user_name' => $commande->user ? $commande->user->name : null,
                    'user_email' => $commande->user ? $commande->user->email : null,
                ];
            });

        return Inertia::render('Tickets/Index', [
            'tickets' => $tickets,
            'linkableCommandes' => $linkableCommandes,
            'currentStatus' => $request->status ?? null,
            'showAllStatuses' => $showAllStatuses,
            'deviceQuery' => $deviceQuery,
            'selectedDeviceId' => !empty($selectedDeviceId) ? $selectedDeviceId : null,
            'filteredUser' => $filteredUser,
            'specialOnly' => $specialOnly,
            'ticketKindSupported' => $supportsTicketKind,
        ]);
    }

    /**
     * Link an existing commande to a ticket.
     */
    public function linkCommande(Request $request, Ticket $ticket)
    {
        $this->authorizeTicketAccess($ticket);

        $validated = $request->validate([
            'commande_id' => 'required|exists:commandes,id',
        ]);

        $commande = Commande::findOrFail($validated['commande_id']);

        if (!is_null($commande->ticket_id) && (int) $commande->ticket_id !== (int) $ticket->id) {
            return back()->withErrors([
                'commande_id' => 'Cette commande est deja liee a un autre ticket.',
            ]);
        }

        $commande->update([
            'ticket_id' => $ticket->id,
        ]);

        $this->logTechnicianTimeline(
            $ticket,
            'commande_linked',
            'Commande liee au ticket',
            [
                'commande_id' => $commande->id,
                'commande_nom' => $commande->nom,
                'command_number' => $commande->command_number,
            ]
        );

        return back()->with('success', 'Commande liee au ticket avec succes.');
    }

    public function attachDevice(Request $request, Ticket $ticket)
    {
        $this->authorizeTicketAccess($ticket);

        $validated = $request->validate([
            'device_id' => 'nullable|integer|exists:devices,id',
        ]);

        $previousDeviceId = $ticket->device_id;
        $nextDeviceId = $validated['device_id'] ?? null;

        if ($nextDeviceId) {
            $device = Device::query()
                ->where('id', $nextDeviceId)
                ->where('user_id', $ticket->user_id)
                ->first();

            if (!$device) {
                return back()->withErrors([
                    'device_id' => 'Cet appareil ne correspond pas au client du ticket.',
                ]);
            }

            $ticket->device_id = $device->id;
            $ticket->save();

            if ((int) $previousDeviceId !== (int) $ticket->device_id) {
                $this->logTechnicianTimeline(
                    $ticket,
                    'device_attached',
                    'Appareil lie au ticket',
                    [
                        'device_id' => $device->id,
                        'device_name' => $device->display_name,
                    ]
                );
            }

            return back()->with('success', 'Appareil lie au ticket.');
        }

        $ticket->device_id = null;
        $ticket->save();

        if (!is_null($previousDeviceId)) {
            $this->logTechnicianTimeline(
                $ticket,
                'device_detached',
                'Appareil retire du ticket'
            );
        }

        return back()->with('success', 'Appareil retire du ticket.');
    }

    public function createAndAttachDevice(Request $request, Ticket $ticket)
    {
        $this->authorizeTicketAccess($ticket);

        $data = $request->validate([
            'device_type' => 'required|in:computer,phone,tablet,other',
            'brand' => 'nullable|string|max:120',
            'model' => 'required|string|max:120',
            'serial_number' => 'nullable|string|max:120|unique:devices,serial_number',
            'asset_tag' => 'nullable|string|max:120|unique:devices,asset_tag',
            'purchase_date' => 'nullable|date',
            'warranty_end_date' => 'nullable|date|after_or_equal:purchase_date',
        ]);

        $device = Device::create([
            'user_id' => $ticket->user_id,
            'device_type' => $data['device_type'],
            'brand' => $data['brand'] ?? null,
            'model' => $data['model'],
            'serial_number' => $data['serial_number'] ?? null,
            'asset_tag' => $data['asset_tag'] ?? null,
            'purchase_date' => $data['purchase_date'] ?? null,
            'warranty_end_date' => $data['warranty_end_date'] ?? null,
            'status' => 'active',
        ]);

        $ticket->device_id = $device->id;
        $ticket->save();

        $this->logTechnicianTimeline(
            $ticket,
            'device_attached',
            'Nouvel appareil cree et lie au ticket',
            [
                'device_id' => $device->id,
                'device_name' => $device->display_name,
            ]
        );

        return back()->with('success', 'Appareil cree et lie au ticket.');
    }

    /**
     * Show the form for creating a new resource.
     */
    public function create(Request $request)
    {
        $categories = Category::all()->map(fn($c) => [
            'id' => $c->id,
            'name' => $c->name,
        ]);

        $currentUser = Auth::user();
        $isAgent = $this->isAgentContext();

        $users = [];
        if ($isAgent) {
            $users = \App\Models\User::whereDoesntHave('agent')
                ->with('devices')
                ->get()
                ->map(fn($u) => [
                    'id' => $u->id,
                    'name' => $u->first_name . ' ' . $u->last_name,
                    'email' => $u->email,
                    'devices' => $u->devices->map(fn(Device $device) => $this->serializeDevice($device))->values(),
                ])->toArray();
        }

        $currentUserDevices = [];
        if ($currentUser && !$isAgent) {
            $currentUserDevices = Device::query()
                ->where('user_id', $currentUser->id)
                ->orderByDesc('id')
                ->get()
                ->map(fn(Device $device) => $this->serializeDevice($device))
                ->values();
        }

        $supportsTicketKind = $this->supportsTicketKind();
        $specialOnly = $request->boolean('special_only');
        $requestedTicketKind = $request->query('ticket_kind', $specialOnly ? 'bug' : 'standard');
        $allowedKinds = $specialOnly ? ['bug', 'improvement'] : ['standard'];
        $defaultTicketKind = in_array($requestedTicketKind, $allowedKinds, true)
            ? $requestedTicketKind
            : ($specialOnly ? 'bug' : 'standard');

        return Inertia::render('Tickets/Create', [
            'categories' => $categories,
            'isAgent' => $isAgent,
            'users' => $users,
            'currentUserDevices' => $currentUserDevices,
            'defaultTicketKind' => $defaultTicketKind,
            'specialOnly' => $specialOnly,
            'ticketKindSupported' => $supportsTicketKind,
        ]);
    }

    /**
     * Public tablet (kiosk) form for creating tickets without authentication.
     */
    public function kioskCreate(Request $request)
    {
        $categories = Category::all()->map(fn($c) => [
            'id' => $c->id,
            'name' => $c->name,
        ]);

        return Inertia::render('Tickets/KioskCreate', [
            'categories' => $categories,
            'success' => $request->boolean('success'),
            'ticketId' => $request->query('ticket'),
        ]);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $currentUser = Auth::user();
        $isAgent = $this->isAgentContext();
        $supportsTicketKind = $this->supportsTicketKind();
        $specialOnly = $request->boolean('special_only');
        $allowedTicketKinds = $specialOnly ? ['bug', 'improvement'] : ['standard'];

        $rules = [
            'title' => 'required|string|max:255',
            'message' => 'nullable|string',
            'category_id' => 'nullable|integer',
            'ticket_kind' => ['nullable', Rule::in($allowedTicketKinds)],
            'device_id' => 'nullable|integer|exists:devices,id',
            'quick_add_device' => 'nullable|boolean',
            'quick_device_type' => 'nullable|in:computer,phone,tablet,other',
            'quick_device_brand' => 'nullable|string|max:120',
            'quick_device_model' => 'nullable|string|max:120',
            'quick_device_serial_number' => 'nullable|string|max:120|unique:devices,serial_number',
            'quick_device_asset_tag' => 'nullable|string|max:120|unique:devices,asset_tag',
            'quick_device_purchase_date' => 'nullable|date',
            'quick_device_warranty_end_date' => 'nullable|date|after_or_equal:quick_device_purchase_date',
        ];

        // Sur les tickets standards, un agent peut choisir le demandeur.
        if ($isAgent && !$specialOnly) {
            $rules['user_selection'] = 'required|in:existing,new';
            $rules['user_id'] = 'nullable|integer';
            $rules['user_email'] = 'nullable|email|max:255';
        }

        $data = $request->validate($rules);

        $ticket = new Ticket();

        // Déterminer l'user_id du ticket
        if ($specialOnly) {
            // Les tickets bug/amélioration appartiennent toujours à l'utilisateur connecté.
            $ticket->user_id = Auth::id() ?? 1;
        } elseif ($isAgent && ($data['user_selection'] ?? null) === 'new') {
            // Créer un nouvel utilisateur
            $address = $request->input('user_address', '');
            $postalCode = $request->input('user_postal_code', '');
            $city = $request->input('user_city', '');

            // Combiner les champs d'adresse
            $fullAddress = trim($address . ' ' . $postalCode . ' ' . $city);

            $email = $data['user_email'] ?? null;
            // Ne pas créer d'email automatique, laisser null si non fourni
            $email = !empty($email) ? $email : null;

            // Si email est fourni, vérifier s'il existe déjà
            if ($email) {
                $user = \App\Models\User::firstOrCreate(
                    ['email' => $email],
                    [
                        'first_name' => $request->input('user_first_name', 'Client'),
                        'last_name' => $request->input('user_last_name', ''),
                        'password' => bcrypt('defaultpassword'),
                        'phone' => $request->input('user_phone', ''),
                        'address' => $fullAddress,
                        'default_notification_preference' => 'Email',
                    ]
                );
            } else {
                // Créer sans email
                $user = \App\Models\User::create([
                    'first_name' => $request->input('user_first_name', 'Client'),
                    'last_name' => $request->input('user_last_name', ''),
                    'password' => bcrypt('defaultpassword'),
                    'phone' => $request->input('user_phone', ''),
                    'address' => $fullAddress,
                    'email' => null,
                    'default_notification_preference' => $request->input('user_phone') ? 'SMS' : 'None',
                ]);
            }
            $ticket->user_id = $user->id;
        } elseif ($isAgent && ($data['user_selection'] ?? null) === 'existing' && !empty($data['user_id'])) {
            // Utiliser un utilisateur existant
            $ticket->user_id = $data['user_id'];
        } else {
            // Utiliser l'utilisateur courant
            $ticket->user_id = Auth::id() ?? 1;
        }

        if (!empty($data['device_id'])) {
            $device = Device::query()
                ->where('id', $data['device_id'])
                ->where('user_id', $ticket->user_id)
                ->first();

            if (!$device) {
                return back()->withErrors([
                    'device_id' => 'Cet appareil ne correspond pas au client du ticket.',
                ])->withInput();
            }

            $ticket->device_id = $device->id;
        }

        $shouldQuickCreateDevice = $request->boolean('quick_add_device');
        if ($shouldQuickCreateDevice) {
            $request->validate([
                'quick_device_model' => 'required|string|max:120',
            ]);
        }

        $ticket->title = $data['title'];
        $ticket->message = $data['message'] ?? null;
        $ticketKind = $data['ticket_kind'] ?? ($specialOnly ? 'bug' : 'standard');
        if ($supportsTicketKind) {
            $ticket->ticket_kind = $ticketKind;
        }

        if ($specialOnly && !$supportsTicketKind) {
            $ticket->category_id = $this->getOrCreateSpecialCategoryId($ticketKind);
        }

        $ticket->priority = $request->input('priority', 'low');
        $ticket->status = $request->input('status', 'open');
        $ticket->save();

        if ($shouldQuickCreateDevice) {
            $quickDevice = Device::create([
                'user_id' => $ticket->user_id,
                'device_type' => (string) ($request->input('quick_device_type') ?: 'computer'),
                'brand' => $request->input('quick_device_brand'),
                'model' => (string) $request->input('quick_device_model'),
                'serial_number' => $request->input('quick_device_serial_number'),
                'asset_tag' => $request->input('quick_device_asset_tag'),
                'purchase_date' => $request->input('quick_device_purchase_date'),
                'warranty_end_date' => $request->input('quick_device_warranty_end_date'),
                'status' => 'active',
            ]);

            if (empty($ticket->device_id)) {
                $ticket->device_id = $quickDevice->id;
                $ticket->save();
            }

            $this->logTechnicianTimeline(
                $ticket,
                'device_attached',
                'Appareil ajoute et lie au ticket',
                [
                    'device_id' => $quickDevice->id,
                    'device_name' => $quickDevice->display_name,
                ]
            );
        }

        $this->logTechnicianTimeline(
            $ticket,
            'ticket_created_by_technician',
            'Ticket cree par un technicien',
            [
                'title' => $ticket->title,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
            ]
        );

        if (!empty($data['category_id']) && method_exists($ticket, 'categories')) {
            try {
                $ticket->categories()->attach($data['category_id']);
            } catch (\Exception $e) {
                // ignore attach failures
            }
        }

        if ($request->boolean('print_label')) {
            return redirect()->route('tickets.printLabel', $ticket->id);
        }

        // Redirect to dashboard after creating a ticket
        return redirect()->route('dashboard');
    }

    /**
     * Store a ticket from the public tablet (kiosk) flow.
     */
    public function kioskStore(Request $request)
    {
        $data = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name' => 'required|string|max:100',
            'phone' => 'nullable|string|max:30',
            'email' => 'nullable|email|max:255',
            'title' => 'required|string|max:255',
            'message' => 'required|string|max:3000',
            'category_id' => 'nullable|integer|exists:categories,id',
        ]);

        if (empty($data['phone']) && empty($data['email'])) {
            return back()->withErrors([
                'phone' => 'Merci de renseigner au moins un telephone ou un email.',
            ])->withInput();
        }

        $addressParts = [
            trim((string) $request->input('address', '')),
            trim((string) $request->input('postal_code', '')),
            trim((string) $request->input('city', '')),
        ];

        $fullAddress = trim(implode(' ', array_filter($addressParts)));
        $email = $data['email'] ?? null;

        if (!empty($email)) {
            $user = \App\Models\User::firstOrCreate(
                ['email' => $email],
                [
                    'first_name' => $data['first_name'],
                    'last_name' => $data['last_name'],
                    'password' => Hash::make(Str::random(32)),
                    'phone' => $data['phone'] ?? null,
                    'address' => $fullAddress !== '' ? $fullAddress : null,
                    'default_notification_preference' => 'Email',
                ]
            );
        } else {
            $user = \App\Models\User::create([
                'first_name' => $data['first_name'],
                'last_name' => $data['last_name'],
                'password' => Hash::make(Str::random(32)),
                'phone' => $data['phone'] ?? null,
                'address' => $fullAddress !== '' ? $fullAddress : null,
                'email' => null,
                'default_notification_preference' => !empty($data['phone']) ? 'SMS' : 'None',
            ]);
        }

        $ticket = new Ticket();
        $ticket->user_id = $user->id;
        $ticket->title = $data['title'];
        $ticket->message = $data['message'];
        $ticket->ticket_kind = 'standard';
        $ticket->priority = 'low';
        $ticket->status = 'open';
        $ticket->notify_by = !empty($email) ? 'Email' : (!empty($data['phone']) ? 'SMS' : 'None');
        $ticket->contact_phone = $data['phone'] ?? null;
        $ticket->contact_email = $email;
        if (!empty($data['category_id'])) {
            $ticket->category_id = $data['category_id'];
        }
        $ticket->save();

        return redirect()->route('kiosk.tickets.create', [
            'success' => 1,
            'ticket' => $ticket->id,
        ]);
    }

    /**
     * Printer settings page for ticket labels.
     */
    public function printSettings()
    {
        return Inertia::render('Tickets/PrinterSettings');
    }

    /**
     * Printable label view for a ticket.
     */
    public function printLabel(string $id)
    {
        $ticket = Ticket::with('user', 'category')->findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        return Inertia::render('Tickets/PrintLabel', [
            'ticket' => [
                'id' => $ticket->id,
                'title' => $ticket->title ?? null,
                'message' => $ticket->message ?? null,
                'created_at' => $ticket->created_at ? $ticket->created_at->format('d/m/Y H:i') : null,
                'priority' => $ticket->priority ?? null,
                'status' => $ticket->status ?? null,
                'user' => $ticket->user ? [
                    'name' => $ticket->user->first_name . ' ' . $ticket->user->last_name,
                    'email' => $ticket->user->email,
                    'phone' => $ticket->user->phone,
                    'address' => $ticket->user->address,
                ] : null,
                'category' => $ticket->category ? [
                    'name' => $ticket->category->name,
                ] : null,
                'qr_payload' => url(route('tickets.show', $ticket->id)),
            ],
            'labelSettings' => TicketLabelSettings::load(),
        ]);
    }

    /**
     * Display the specified resource.
     */
    public function show(string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);
        $ticket->load(['user.devices', 'assignee', 'category', 'device']);
        $viewer = Auth::user();

        $categories = Category::all()->map(fn($c) => [
            'id' => $c->id,
            'name' => $c->name,
        ]);

        $agents = \App\Models\User::whereHas('agent')->get()->map(fn($u) => [
            'id' => $u->id,
            'name' => $u->first_name . ' ' . $u->last_name,
        ]);

        // Récupérer les commandes liées à ce ticket
        $commandes = \App\Models\Commande::where('ticket_id', $ticket->id)
            ->with('user')
            ->orderBy('created_at', 'desc')
            ->get()
            ->map(fn($c) => [
                'id' => $c->id,
                'nom' => $c->nom,
                'fournisseur' => $c->fournisseur,
                'command_number' => $c->command_number,
                'invoice_id' => $c->invoice_id,
                'statut' => $c->statut,
                'created_at' => $c->created_at->toDateTimeString(),
                'user' => $c->user ? [
                    'id' => $c->user->id,
                    'name' => $c->user->first_name . ' ' . $c->user->last_name,
                ] : null,
            ]);

        $timelineEvents = [];
        if ($this->isAgentContext()) {
            $timelineEvents = $ticket->timelineEvents()
                ->withTrashed()
                ->with([
                    'technician:id,first_name,last_name,email',
                    'removedBy:id,first_name,last_name,email',
                    'restoredBy:id,first_name,last_name,email',
                ])
                ->orderByDesc('happened_at')
                ->limit(150)
                ->get()
                ->map(fn($event) => [
                    'id' => $event->id,
                    'event_type' => $event->event_type,
                    'summary' => $event->summary,
                    'details' => $event->details,
                    'happened_at' => $event->happened_at ? $event->happened_at->toDateTimeString() : null,
                    'is_removed' => !is_null($event->deleted_at),
                    'removed_at' => $event->removed_at ? $event->removed_at->toDateTimeString() : null,
                    'removed_reason' => $event->removed_reason,
                    'restored_at' => $event->restored_at ? $event->restored_at->toDateTimeString() : null,
                    'technician' => $event->technician ? [
                        'id' => $event->technician->id,
                        'name' => $event->technician->first_name . ' ' . $event->technician->last_name,
                        'email' => $event->technician->email,
                    ] : null,
                    'removed_by' => $event->removedBy ? [
                        'id' => $event->removedBy->id,
                        'name' => $event->removedBy->first_name . ' ' . $event->removedBy->last_name,
                        'email' => $event->removedBy->email,
                    ] : null,
                    'restored_by' => $event->restoredBy ? [
                        'id' => $event->restoredBy->id,
                        'name' => $event->restoredBy->first_name . ' ' . $event->restoredBy->last_name,
                        'email' => $event->restoredBy->email,
                    ] : null,
                ]);
        }

        $deviceEvents = [];
        if ($ticket->device_id) {
            $deviceEvents = DeviceEvent::query()
                ->with(['technician:id,first_name,last_name'])
                ->where('device_id', $ticket->device_id)
                ->orderByDesc('happened_at')
                ->limit(100)
                ->get()
                ->map(fn($event) => [
                    'id' => $event->id,
                    'event_type' => $event->event_type,
                    'summary' => $event->summary,
                    'details' => $event->details,
                    'happened_at' => $event->happened_at?->toDateTimeString(),
                    'ticket_id' => $event->ticket_id,
                    'technician' => $event->technician ? [
                        'id' => $event->technician->id,
                        'name' => trim(($event->technician->first_name ?? '') . ' ' . ($event->technician->last_name ?? '')),
                    ] : null,
                ]);
        }

        return Inertia::render('Tickets/Show', [
            'ticket' => [
                'id' => $ticket->id,
                'title' => $ticket->title,
                'ticket_kind' => $this->supportsTicketKind() ? ($ticket->ticket_kind ?? 'standard') : 'standard',
                'message' => $ticket->message,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
                'invoice_id' => $ticket->invoice_id,
                'notify_by' => $ticket->notify_by,
                'contact_phone' => $ticket->contact_phone,
                'contact_email' => $ticket->contact_email,
                'is_resolved' => $ticket->is_resolved,
                'is_locked' => $ticket->is_locked,
                'created_at' => $ticket->created_at ? $ticket->created_at->toDateTimeString() : null,
                'user' => $ticket->user ? [
                    'id' => $ticket->user->id,
                    'first_name' => $ticket->user->first_name,
                    'last_name' => $ticket->user->last_name,
                    'name' => $ticket->user->first_name . ' ' . $ticket->user->last_name,
                    'email' => $ticket->user->email,
                    'phone' => $ticket->user->phone ?? null,
                    'address' => $ticket->user->address ?? null,
                    'internal_note' => $ticket->user->internal_note ?? null,
                    'email_verified_at' => $ticket->user->email_verified_at ? $ticket->user->email_verified_at->toDateTimeString() : null,
                ] : null,
                'assignee' => $ticket->assignee ? [
                    'id' => $ticket->assignee->id,
                    'first_name' => $ticket->assignee->first_name,
                    'last_name' => $ticket->assignee->last_name,
                    'name' => $ticket->assignee->first_name . ' ' . $ticket->assignee->last_name,
                    'email' => $ticket->assignee->email,
                    'phone' => $ticket->assignee->phone ?? null,
                    'address' => $ticket->assignee->address ?? null,
                ] : null,
                'category' => $ticket->category ? [
                    'id' => $ticket->category->id,
                    'name' => $ticket->category->name,
                ] : null,
                'device' => $this->serializeDevice($ticket->device),
            ],
            'categories' => $categories,
            'agents' => $agents,
            'commandes' => $commandes,
            'userDevices' => $ticket->user ? $ticket->user->devices->map(fn(Device $device) => $this->serializeDevice($device))->values() : [],
            'timelineEvents' => $timelineEvents,
            'deviceEvents' => $deviceEvents,
            'timelineTemplateSettings' => $this->isAgentContext() ? TicketTimelineTemplateSettings::load() : ['templates' => []],
        ]);
    }

    /**
     * Show the form for editing the specified resource.
     */
    public function edit(string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);
        $ticket->load('user.devices');
        $categories = Category::all()->map(fn($c) => [
            'id' => $c->id,
            'name' => $c->name,
        ]);

        $agents = \App\Models\User::whereHas('agent')->get()->map(fn($u) => [
            'id' => $u->id,
            'name' => $u->first_name . ' ' . $u->last_name,
        ]);

        return Inertia::render('Tickets/Edit', [
            'ticket' => [
                'id' => $ticket->id,
                'title' => $ticket->title,
                'message' => $ticket->message,
                'status' => $ticket->status,
                'priority' => $ticket->priority,
                'category_id' => $ticket->category_id,
                'assignee_id' => $ticket->assignee_id,
                'device_id' => $ticket->device_id,
                'invoice_id' => $ticket->invoice_id,
                'notify_by' => $ticket->notify_by,
                'contact_phone' => $ticket->contact_phone,
                'contact_email' => $ticket->contact_email,
                'is_resolved' => $ticket->is_resolved,
                'is_locked' => $ticket->is_locked,
            ],
            'categories' => $categories,
            'agents' => $agents,
            'userDevices' => $ticket->user ? $ticket->user->devices->map(fn(Device $device) => $this->serializeDevice($device))->values() : [],
        ]);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $originalValues = [];
        foreach (self::TRACKED_TICKET_FIELDS as $field) {
            $originalValues[$field] = $ticket->{$field};
        }

        $data = $request->validate([
            'title' => 'required|string|max:255',
            'message' => 'nullable|string',
            'category_id' => 'nullable|integer',
            'assignee_id' => 'nullable|integer',
            'device_id' => 'nullable|integer|exists:devices,id',
            'invoice_id' => 'nullable|string|max:255',
            'notify_by' => 'nullable|in:SMS,Email,None',
            'contact_phone' => 'nullable|string|max:255',
            'contact_email' => 'nullable|email|max:255',
            'is_resolved' => 'nullable|boolean',
            'is_locked' => 'nullable|boolean',
        ]);

        $ticket->title = $data['title'];
        $ticket->message = $data['message'] ?? null;
        $ticket->priority = $request->input('priority', $ticket->priority);
        $ticket->status = $request->input('status', $ticket->status);
        $ticket->assignee_id = $data['assignee_id'] ?? null;
        $ticket->device_id = $data['device_id'] ?? null;
        $ticket->invoice_id = $data['invoice_id'] ?? null;
        $ticket->notify_by = $data['notify_by'] ?? 'None';
        $ticket->contact_phone = $data['contact_phone'] ?? null;
        $ticket->contact_email = $data['contact_email'] ?? null;
        $ticket->is_resolved = $data['is_resolved'] ?? false;
        $ticket->is_locked = $data['is_locked'] ?? false;

        // Si assignee_id est 0 (Aucun), le mettre à null
        if ($ticket->assignee_id == 0) {
            $ticket->assignee_id = null;
        }

        if (!empty($ticket->device_id)) {
            $device = Device::query()
                ->where('id', $ticket->device_id)
                ->where('user_id', $ticket->user_id)
                ->first();

            if (!$device) {
                return back()->withErrors([
                    'device_id' => 'Cet appareil ne correspond pas au client du ticket.',
                ])->withInput();
            }
        }

        $ticket->save();

        if (isset($data['category_id']) && method_exists($ticket, 'categories')) {
            try {
                $ticket->categories()->sync([$data['category_id']]);
            } catch (\Exception $e) {
                // ignore
            }
        }

        $changes = [];
        foreach (self::TRACKED_TICKET_FIELDS as $field) {
            if (!$ticket->wasChanged($field)) {
                continue;
            }

            $changes[] = [
                'field' => $field,
                'label' => self::TRACKED_FIELD_LABELS[$field] ?? $field,
                'before' => $this->formatTimelineValue($field, $originalValues[$field] ?? null),
                'after' => $this->formatTimelineValue($field, $ticket->{$field}),
            ];
        }

        if (!empty($changes)) {
            $summary = count($changes) === 1
                ? 'Mise a jour du ticket: ' . ($changes[0]['label'] ?? 'champ modifie')
                : 'Mise a jour du ticket (' . count($changes) . ' changements)';

            $this->logTechnicianTimeline(
                $ticket,
                'ticket_updated',
                $summary,
                ['changes' => $changes]
            );
        }

        return redirect()->route('tickets.show', $ticket->id);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy(string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);
        $ticket->delete();

        return redirect()->route('tickets.index');
    }

    /**
     * Update ticket status only
     */
    public function updateStatus(Request $request, string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $data = $request->validate([
            'status' => 'required|in:open,in_progress,pending,resolved,closed',
        ]);

        $previousStatus = $ticket->status;
        $ticket->status = $data['status'];
        $ticket->save();

        if ($previousStatus !== $ticket->status) {
            $this->logTechnicianTimeline(
                $ticket,
                'status_changed',
                'Statut du ticket modifie',
                [
                    'before' => $previousStatus,
                    'after' => $ticket->status,
                ]
            );
        }

        return back();
    }

    /**
     * Update ticket priority only
     */
    public function updatePriority(Request $request, string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $data = $request->validate([
            'priority' => 'required|in:low,medium,high',
        ]);

        $previousPriority = $ticket->priority;
        $ticket->priority = $data['priority'];
        $ticket->save();

        if ($previousPriority !== $ticket->priority) {
            $this->logTechnicianTimeline(
                $ticket,
                'priority_changed',
                'Priorite du ticket modifiee',
                [
                    'before' => $previousPriority,
                    'after' => $ticket->priority,
                ]
            );
        }

        return back();
    }

    /**
     * Assign the authenticated agent user to a ticket in one click.
     */
    public function selfAssign(string $id)
    {
        $agentUser = $this->ensureAgentOrAbort();
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        if (!empty($ticket->assignee_id) && (int) $ticket->assignee_id !== (int) $agentUser->id) {
            return back()->withErrors([
                'assignee_id' => 'Ce ticket est deja attribue a un autre agent.',
            ]);
        }

        if ((int) $ticket->assignee_id === (int) $agentUser->id) {
            return back();
        }

        $previousAssigneeId = $ticket->assignee_id;
        $ticket->assignee_id = $agentUser->id;
        $ticket->save();

        $this->logTechnicianTimeline(
            $ticket,
            'assignee_changed',
            'Agent attribue au ticket',
            [
                'before' => $this->formatTimelineValue('assignee_id', $previousAssigneeId),
                'after' => $this->formatTimelineValue('assignee_id', $ticket->assignee_id),
            ]
        );

        return back()->with('success', 'Ticket attribue.');
    }

    /**
     * Store a manual timeline event created by a technician.
     */
    public function storeTimelineEvent(Request $request, string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $user = $this->ensureAgentOrAbort();

        $data = $request->validate([
            'event_type' => ['required', 'string', Rule::in(TicketTimelineTemplateSettings::allowedEventTypes())],
            'summary' => 'required|string|max:500',
            'details' => 'nullable|string|max:3000',
            'happened_at' => 'nullable|date',
            'prerequisites' => 'nullable|array|max:20',
            'prerequisites.*.name' => 'required_with:prerequisites|string|max:160',
            'prerequisites.*.met' => 'nullable|boolean',
        ]);

        $details = [];
        if (!empty($data['details'])) {
            $details['note'] = $data['details'];
        }

        if (!empty($data['prerequisites']) && is_array($data['prerequisites'])) {
            $details['prerequisites'] = collect($data['prerequisites'])
                ->filter(fn($p) => is_array($p) && !empty(trim((string) ($p['name'] ?? ''))))
                ->map(fn($p) => [
                    'name' => trim((string) ($p['name'] ?? '')),
                    'met' => (bool) ($p['met'] ?? false),
                ])
                ->values()
                ->all();
        }

        $details['source'] = 'manual';

        TicketTimelineEvent::create([
            'ticket_id' => $ticket->id,
            'technician_id' => $user->id,
            'event_type' => $data['event_type'],
            'summary' => $data['summary'],
            'details' => !empty($details) ? $details : null,
            'happened_at' => $data['happened_at'] ?? now(),
        ]);

        return back()->with('success', 'Evenement ajoute au suivi du ticket.');
    }

    public function storeDeviceEvent(Request $request, string $id)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $user = $this->ensureAgentOrAbort();

        if (!$ticket->device_id) {
            return back()->withErrors([
                'device' => 'Aucun appareil n\'est associe a ce ticket.',
            ]);
        }

        $data = $request->validate([
            'event_type' => 'required|in:battery_replaced,screen_replaced,storage_upgraded,diagnostic,maintenance,note',
            'summary' => 'required|string|max:500',
            'details' => 'nullable|string|max:3000',
            'happened_at' => 'nullable|date',
        ]);

        $deviceEvent = DeviceEvent::create([
            'device_id' => $ticket->device_id,
            'ticket_id' => $ticket->id,
            'technician_id' => $user->id,
            'event_type' => $data['event_type'],
            'summary' => $data['summary'],
            'details' => !empty($data['details']) ? ['note' => $data['details']] : null,
            'happened_at' => $data['happened_at'] ?? now(),
        ]);

        $this->logTechnicianTimeline(
            $ticket,
            'device_event_added',
            'Intervention enregistree sur appareil',
            [
                'device_event_id' => $deviceEvent->id,
                'event_type' => $deviceEvent->event_type,
                'summary' => $deviceEvent->summary,
                'happened_at' => $deviceEvent->happened_at?->toDateTimeString(),
            ]
        );

        return back()->with('success', 'Intervention appareil ajoutee.');
    }

    public function removeTimelineEvent(Request $request, string $id, string $event)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $user = $this->ensureAgentOrAbort();

        $data = $request->validate([
            'reason' => 'nullable|string|max:500',
        ]);

        $timelineEvent = TicketTimelineEvent::where('ticket_id', $ticket->id)->findOrFail($event);

        if ($timelineEvent->trashed()) {
            return back()->withErrors(['event' => 'Cet evenement est deja retire.']);
        }

        $timelineEvent->removed_by_id = $user->id;
        $timelineEvent->removed_reason = $data['reason'] ?? null;
        $timelineEvent->removed_at = now();
        $timelineEvent->save();
        $timelineEvent->delete();

        return back()->with('success', 'Evenement retire.');
    }

    public function restoreTimelineEvent(Request $request, string $id, string $event)
    {
        $ticket = Ticket::findOrFail($id);
        $this->authorizeTicketAccess($ticket);

        $user = $this->ensureAgentOrAbort();

        $timelineEvent = TicketTimelineEvent::withTrashed()
            ->where('ticket_id', $ticket->id)
            ->findOrFail($event);

        if (!$timelineEvent->trashed()) {
            return back()->withErrors(['event' => 'Cet evenement est deja actif.']);
        }

        $timelineEvent->restore();
        $timelineEvent->restored_by_id = $user->id;
        $timelineEvent->restored_at = now();
        $timelineEvent->save();

        return back()->with('success', 'Evenement restaure.');
    }
}
