<?php

namespace App\Http\Controllers;

use App\Models\Devis;
use App\Models\Ticket;
use App\Models\User;
use App\Notifications\DevisMentionNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Inertia\Inertia;

class DevisController extends Controller
{
    private const STATUSES = ['draft', 'to_validate', 'sent', 'accepted', 'refused', 'expired'];

    private function normalizeMentionToken(string $value): string
    {
        return trim(Str::of($value)->ascii()->lower()->replaceMatches('/[^a-z0-9]/', '')->toString());
    }

    private function mentionedAgentIds(string $body): array
    {
        preg_match_all('/@([\pL\pN]+)/u', $body, $matches);
        $tokens = collect($matches[1] ?? [])->map(fn ($token) => $this->normalizeMentionToken((string) $token))->filter()->unique();
        $agents = User::query()->whereHas('agent', fn ($query) => $query->where('is_active', true))->get(['id', 'first_name', 'last_name']);

        return $agents->filter(function (User $agent) use ($tokens): bool {
            $alias = $this->normalizeMentionToken(($agent->first_name ?? '') . ($agent->last_name ?? ''));
            return $alias !== '' && $tokens->contains($alias);
        })->pluck('id')->all();
    }

    public function __construct()
    {
        $this->middleware('auth');
        $this->middleware(function ($request, $next) {
            $user = Auth::user();
            $isAdmin = (bool) ($user?->is_admin || $user?->agent?->is_admin);

            if (! $user?->agent && ! $isAdmin) {
                abort(403, 'Accès réservé aux agents et administrateurs.');
            }

            return $next($request);
        });
    }

    public function index(Request $request)
    {
        $status = $request->string('status')->toString();

        $devis = Devis::with([
            'user:id,first_name,last_name,email',
            'ticket:id,title,status',
        ])
            ->when(in_array($status, self::STATUSES, true), fn ($query) => $query->where('status', $status))
            ->latest()
            ->get();

        return Inertia::render('Devis/Index', [
            'devis' => $devis,
            'currentStatus' => in_array($status, self::STATUSES, true) ? $status : null,
        ]);
    }

    public function create(Request $request)
    {
        return Inertia::render('Devis/Create', [
            'users' => User::query()
                ->select('id', 'first_name', 'last_name', 'email')
                ->orderBy('last_name')
                ->orderBy('first_name')
                ->get(),
            'tickets' => Ticket::query()
                ->select('id', 'user_id', 'title', 'status')
                ->with('user:id,first_name,last_name,email')
                ->latest()
                ->limit(300)
                ->get(),
            'ticketId' => $request->integer('ticket_id') ?: null,
        ]);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'ticket_id' => ['nullable', 'exists:tickets,id'],
            'title' => ['required', 'string', 'max:255'],
            'status' => ['required', 'in:' . implode(',', self::STATUSES)],
            'hiboutik_id' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:10000'],
            'pdf' => ['nullable', 'file', 'mimes:pdf', 'max:20480'],
        ]);

        $devis = new Devis($validated);
        unset($devis->pdf);

        if ($request->hasFile('pdf')) {
            $file = $request->file('pdf');
            $devis->pdf_path = $file->store('devis', 'local');
            $devis->pdf_original_name = $file->getClientOriginalName();
        }

        $devis->save();

        return redirect()->route('devis.show', $devis)->with('success', 'Devis créé avec succès.');
    }

    public function show(Devis $devis)
    {
        $devis->load([
            'user:id,first_name,last_name,email,phone',
            'ticket:id,title,status,user_id,hiboutik_quote_number',
            'messages' => fn ($query) => $query->with('user:id,first_name,last_name')->oldest(),
        ]);

        $agents = User::query()
            ->whereHas('agent', fn ($query) => $query->where('is_active', true))
            ->select('id', 'first_name', 'last_name')
            ->with('agent:id,user_id,is_active')
            ->orderBy('first_name')
            ->orderBy('last_name')
            ->get();

        return Inertia::render('Devis/Show', [
            'devis' => $devis,
            'agents' => $agents,
        ]);
    }

    public function update(Request $request, Devis $devis)
    {
        $validated = $request->validate([
            'status' => ['required', 'in:' . implode(',', self::STATUSES)],
            'hiboutik_id' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:10000'],
        ]);

        $devis->update($validated);

        return back()->with('success', 'Devis mis à jour.');
    }

    public function accept(Request $request, Devis $devis)
    {
        $validated = $request->validate([
            'hiboutik_id' => ['nullable', 'string', 'max:255'],
        ]);

        if ($request->has('hiboutik_id')) {
            $devis->hiboutik_id = $validated['hiboutik_id'] ?? null;
        }

        $ticket = $devis->ticket;
        $hiboutikTitle = $devis->hiboutik_id
            ? 'Devis Hiboutik #' . $devis->hiboutik_id . ' - ' . $devis->title
            : 'Devis - ' . $devis->title;

        if (! $ticket) {
            $ticket = Ticket::create([
                'user_id' => $devis->user_id,
                'title' => $hiboutikTitle,
                'hiboutik_quote_number' => $devis->hiboutik_id,
                'status' => 'open',
                'ticket_kind' => 'standard',
            ]);

            $devis->ticket_id = $ticket->id;
        } else {
            $ticket->hiboutik_quote_number = $devis->hiboutik_id;

            if (Str::startsWith((string) $ticket->title, ['Réparation - ', 'Devis - '])) {
                $ticket->title = $hiboutikTitle;
            }

            $ticket->save();
        }

        if ($devis->status !== 'accepted') {
            $devis->status = 'accepted';
            $devis->accepted_at = now();
        }
        $devis->save();

        return redirect()->route('devis.show', $devis)->with('success', 'Devis accepté et réparation liée.');
    }

    public function download(Devis $devis)
    {
        abort_unless($devis->pdf_path && Storage::disk('local')->exists($devis->pdf_path), 404);

        return response()->download(
            Storage::disk('local')->path($devis->pdf_path),
            $devis->pdf_original_name ?: 'devis-' . $devis->id . '.pdf'
        );
    }

    public function preview(Devis $devis)
    {
        abort_unless($devis->pdf_path && Storage::disk('local')->exists($devis->pdf_path), 404);

        return response()->file(Storage::disk('local')->path($devis->pdf_path), [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . addslashes($devis->pdf_original_name ?: 'devis-' . $devis->id . '.pdf') . '"',
        ]);
    }

    public function uploadPdf(Request $request, Devis $devis)
    {
        $validated = $request->validate([
            'pdf' => ['required', 'file', 'mimes:pdf', 'max:20480'],
        ]);

        $file = $validated['pdf'];
        $newPath = $file->store('devis', 'local');
        $oldPath = $devis->pdf_path;

        $devis->update([
            'pdf_path' => $newPath,
            'pdf_original_name' => $file->getClientOriginalName(),
        ]);

        if ($oldPath && $oldPath !== $newPath) {
            Storage::disk('local')->delete($oldPath);
        }

        return back()->with('success', 'PDF du devis ajouté.');
    }

    public function storeMessage(Request $request, Devis $devis)
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
        ]);

        $message = $devis->messages()->create([
            'user_id' => $request->user()->id,
            'body' => trim($validated['body']),
        ]);

        $message->load('user:id,first_name,last_name');
        $authorName = trim(($request->user()->first_name ?? '') . ' ' . ($request->user()->last_name ?? '')) ?: 'Un agent';
        $mentionedIds = collect($this->mentionedAgentIds($message->body))
            ->reject(fn ($id) => (int) $id === (int) $request->user()->id);

        User::query()->whereIn('id', $mentionedIds->all())->get()->each(
            fn (User $recipient) => $recipient->notify(new DevisMentionNotification($devis, $message, $authorName))
        );

        return back()->with('success', 'Message ajouté au devis.');
    }
}
